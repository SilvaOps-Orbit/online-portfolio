param(
  [string]$ClientId = $env:SPOTIFY_CLIENT_ID,
  [string]$ClientSecret = $env:SPOTIFY_CLIENT_SECRET,
  [string]$RedirectUri = $(if ($env:SPOTIFY_REDIRECT_URI) { $env:SPOTIFY_REDIRECT_URI } else { "http://127.0.0.1:3000" }),
  [string]$Scopes = $(if ($env:SPOTIFY_SCOPES) { $env:SPOTIFY_SCOPES } else { "user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read user-follow-read playlist-read-private" })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Encode-QueryValue {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

function Read-QueryString {
  param([string]$Query)

  $values = @{}
  foreach ($part in $Query.TrimStart("?").Split("&", [System.StringSplitOptions]::RemoveEmptyEntries)) {
    $keyValue = $part.Split("=", 2)
    $key = [System.Uri]::UnescapeDataString($keyValue[0].Replace("+", " "))
    $value = if ($keyValue.Count -gt 1) { [System.Uri]::UnescapeDataString($keyValue[1].Replace("+", " ")) } else { "" }
    $values[$key] = $value
  }
  return $values
}

function Write-CallbackResponse {
  param(
    [Parameter(Mandatory = $true)]$Client,
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>$Title</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1115; color: #f7f2e8; font-family: Segoe UI, sans-serif; }
      main { width: min(90vw, 560px); padding: 32px; border: 1px solid rgba(247,242,232,.18); border-radius: 8px; background: #181d22; box-shadow: 0 24px 70px rgba(0,0,0,.34); }
      h1 { margin-top: 0; color: #54d6be; }
      p { color: #b9b3a7; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>$Title</h1>
      <p>$Message</p>
      <p>You can close this browser tab and return to PowerShell.</p>
    </main>
  </body>
</html>
"@

  $body = [Text.Encoding]::UTF8.GetBytes($html)
  $headers = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
  $stream = $Client.GetStream()
  $stream.Write($headers, 0, $headers.Length)
  $stream.Write($body, 0, $body.Length)
  $stream.Flush()
}

function Get-SpotifyRefreshToken {
  param(
    [Parameter(Mandatory = $true)][string]$Code
  )

  $basicToken = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${ClientId}:${ClientSecret}"))
  $body = @{
    grant_type = "authorization_code"
    code = $Code
    redirect_uri = $RedirectUri
  }

  return Invoke-RestMethod `
    -Uri "https://accounts.spotify.com/api/token" `
    -Method Post `
    -Headers @{ Authorization = "Basic $basicToken" } `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $body
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  $ClientId = Read-Host "Spotify Client ID"
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  throw "A Spotify Client ID is required. Find it in your Spotify developer app settings."
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  $secureClientSecret = Read-Host "Spotify Client Secret (input hidden)" -AsSecureString
  $ClientSecret = [Net.NetworkCredential]::new("", $secureClientSecret).Password
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  throw "A Spotify Client Secret is required. Find it in your Spotify developer app settings."
}

$redirect = [Uri]$RedirectUri
if ($redirect.Scheme -ne "http" -or $redirect.Host -notin @("127.0.0.1", "localhost")) {
  throw "RedirectUri must be a local HTTP URL such as http://127.0.0.1:3000."
}

$state = [guid]::NewGuid().ToString("N")
$query = @(
  "client_id=$(Encode-QueryValue $ClientId)"
  "response_type=code"
  "redirect_uri=$(Encode-QueryValue $RedirectUri)"
  "scope=$(Encode-QueryValue $Scopes)"
  "state=$(Encode-QueryValue $state)"
) -join "&"
$authUrl = "https://accounts.spotify.com/authorize?$query"

$address = if ($redirect.Host -eq "localhost") { [Net.IPAddress]::Loopback } else { [Net.IPAddress]::Parse($redirect.Host) }
$listener = [Net.Sockets.TcpListener]::new($address, $redirect.Port)

try {
  $listener.Start()
  Write-Host ""
  Write-Host "Listening for Spotify redirect on $RedirectUri ..." -ForegroundColor Cyan
  Write-Host "Opening Spotify authorization page..."
  Start-Process $authUrl

  $client = $listener.AcceptTcpClient()
  try {
    $reader = [IO.StreamReader]::new($client.GetStream(), [Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while ($reader.ReadLine()) { }

    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      throw "No callback request was received."
    }

    $target = $requestLine.Split(" ")[1]
    $callbackUri = [Uri]"http://$($redirect.Host):$($redirect.Port)$target"
    $params = Read-QueryString $callbackUri.Query

    if ($params.ContainsKey("error")) {
      Write-CallbackResponse -Client $client -Title "Spotify authorization failed" -Message $params["error"]
      throw "Spotify returned error: $($params["error"])"
    }

    if (!$params.ContainsKey("state") -or $params["state"] -ne $state) {
      Write-CallbackResponse -Client $client -Title "Spotify authorization blocked" -Message "The returned state did not match the request."
      throw "Spotify callback state did not match. Try again."
    }

    if (!$params.ContainsKey("code") -or [string]::IsNullOrWhiteSpace($params["code"])) {
      Write-CallbackResponse -Client $client -Title "Spotify authorization missing code" -Message "No authorization code was returned."
      throw "Spotify callback did not include a code."
    }

    Write-CallbackResponse -Client $client -Title "Spotify connected" -Message "Authorization code captured successfully."
    $response = Get-SpotifyRefreshToken -Code $params["code"]

    if ([string]::IsNullOrWhiteSpace($response.refresh_token)) {
      throw "Spotify did not return a refresh token. Re-run this script and approve the app again."
    }

    Write-Host ""
    Write-Host "Add this value to GitHub repository secrets as SPOTIFY_REFRESH_TOKEN:" -ForegroundColor Cyan
    Write-Host $response.refresh_token
    Write-Host ""
    Write-Host "Keep it private. Do not commit it or paste it into chat."
  } finally {
    if ($client) {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
