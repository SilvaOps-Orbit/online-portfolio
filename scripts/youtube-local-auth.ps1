param(
  [string]$ClientId = $env:YOUTUBE_CLIENT_ID,
  [string]$ClientSecret = $env:YOUTUBE_CLIENT_SECRET,
  [string]$CredentialsPath = $env:YOUTUBE_OAUTH_CREDENTIALS,
  [string]$RedirectUri = $env:YOUTUBE_REDIRECT_URI,
  [string]$Scopes = $(if ($env:YOUTUBE_SCOPES) { $env:YOUTUBE_SCOPES } else { "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly" })
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

  $safeTitle = [Net.WebUtility]::HtmlEncode($Title)
  $safeMessage = [Net.WebUtility]::HtmlEncode($Message)
  $html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>$safeTitle</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1115; color: #f7f2e8; font-family: Segoe UI, sans-serif; }
      main { width: min(90vw, 560px); padding: 32px; border: 1px solid rgba(247,242,232,.18); border-radius: 8px; background: #181d22; box-shadow: 0 24px 70px rgba(0,0,0,.34); }
      h1 { margin-top: 0; color: #54d6be; }
      p { color: #b9b3a7; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>$safeTitle</h1>
      <p>$safeMessage</p>
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

if (![string]::IsNullOrWhiteSpace($CredentialsPath)) {
  $resolvedCredentialsPath = Resolve-Path -LiteralPath $CredentialsPath -ErrorAction Stop
  $credentialsJson = Get-Content -LiteralPath $resolvedCredentialsPath -Raw | ConvertFrom-Json
  $credentials = if ($credentialsJson.PSObject.Properties.Name -contains "web") {
    $credentialsJson.web
  } elseif ($credentialsJson.PSObject.Properties.Name -contains "installed") {
    $credentialsJson.installed
  } else {
    throw "The Google credentials JSON must contain a 'web' or 'installed' credentials object."
  }

  if ([string]::IsNullOrWhiteSpace($ClientId)) {
    $ClientId = [string]$credentials.client_id
  }
  if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
    $ClientSecret = [string]$credentials.client_secret
  }
  if ([string]::IsNullOrWhiteSpace($RedirectUri)) {
    $localRedirect = @($credentials.redirect_uris) |
      Where-Object { $_ -match "^http://(127\.0\.0\.1|localhost)(:\d+)?/" } |
      Select-Object -First 1
    if ($localRedirect) {
      $RedirectUri = [string]$localRedirect
    }
  }

  Write-Host "Loaded Google OAuth credentials from the local JSON file." -ForegroundColor Cyan
}

if ([string]::IsNullOrWhiteSpace($RedirectUri)) {
  $RedirectUri = "http://127.0.0.1:8888/oauth2callback"
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  $ClientId = Read-Host "YouTube OAuth Client ID"
}
if ([string]::IsNullOrWhiteSpace($ClientId)) {
  throw "A YouTube OAuth Client ID is required."
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  $secureClientSecret = Read-Host "YouTube OAuth Client Secret (input hidden)" -AsSecureString
  $ClientSecret = [Net.NetworkCredential]::new("", $secureClientSecret).Password
}
if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  throw "A YouTube OAuth Client Secret is required."
}

$redirect = [Uri]$RedirectUri
if ($redirect.Scheme -ne "http" -or $redirect.Host -notin @("127.0.0.1", "localhost")) {
  throw "RedirectUri must be a local HTTP URL such as http://127.0.0.1:8888/oauth2callback."
}

$state = [guid]::NewGuid().ToString("N")
$query = @(
  "client_id=$(Encode-QueryValue $ClientId)"
  "response_type=code"
  "redirect_uri=$(Encode-QueryValue $RedirectUri)"
  "scope=$(Encode-QueryValue $Scopes)"
  "access_type=offline"
  "include_granted_scopes=true"
  "prompt=consent"
  "state=$(Encode-QueryValue $state)"
) -join "&"
$authUrl = "https://accounts.google.com/o/oauth2/v2/auth?$query"

$address = if ($redirect.Host -eq "localhost") { [Net.IPAddress]::Loopback } else { [Net.IPAddress]::Parse($redirect.Host) }
$listener = [Net.Sockets.TcpListener]::new($address, $redirect.Port)

try {
  $listener.Start()
  Write-Host ""
  Write-Host "Listening for the Google redirect on $RedirectUri ..." -ForegroundColor Cyan
  Write-Host "Opening YouTube authorization..."
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
      Write-CallbackResponse -Client $client -Title "YouTube authorization failed" -Message $params["error"]
      throw "Google returned error: $($params["error"])"
    }
    if (!$params.ContainsKey("state") -or $params["state"] -ne $state) {
      Write-CallbackResponse -Client $client -Title "YouTube authorization blocked" -Message "The returned state did not match the request."
      throw "Google callback state did not match. Try again."
    }
    if (!$params.ContainsKey("code") -or [string]::IsNullOrWhiteSpace($params["code"])) {
      Write-CallbackResponse -Client $client -Title "YouTube authorization missing code" -Message "No authorization code was returned."
      throw "Google callback did not include a code."
    }

    $tokenResponse = Invoke-RestMethod `
      -Uri "https://oauth2.googleapis.com/token" `
      -Method Post `
      -ContentType "application/x-www-form-urlencoded" `
      -Body @{
        client_id = $ClientId
        client_secret = $ClientSecret
        code = $params["code"]
        grant_type = "authorization_code"
        redirect_uri = $RedirectUri
      }

    Write-CallbackResponse -Client $client -Title "YouTube connected" -Message "The refresh token was created successfully."
    if ([string]::IsNullOrWhiteSpace($tokenResponse.refresh_token)) {
      throw "Google did not return a refresh token. Revoke the app grant, then run this helper again and approve access."
    }

    Write-Host ""
    Write-Host "Add this value to GitHub repository secrets as YOUTUBE_REFRESH_TOKEN:" -ForegroundColor Cyan
    Write-Host $tokenResponse.refresh_token
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
