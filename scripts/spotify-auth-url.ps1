param(
  [string]$ClientId = $env:SPOTIFY_CLIENT_ID,
  [string]$RedirectUri = $(if ($env:SPOTIFY_REDIRECT_URI) { $env:SPOTIFY_REDIRECT_URI } else { "http://127.0.0.1:3000" }),
  [string]$Scopes = $(if ($env:SPOTIFY_SCOPES) { $env:SPOTIFY_SCOPES } else { "user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read user-follow-read playlist-read-private" })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Encode-SpotifyQueryValue {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  throw "Set SPOTIFY_CLIENT_ID first, or pass -ClientId `"your-client-id`"."
}

$state = [guid]::NewGuid().ToString("N")
$query = @(
  "client_id=$(Encode-SpotifyQueryValue $ClientId)"
  "response_type=code"
  "redirect_uri=$(Encode-SpotifyQueryValue $RedirectUri)"
  "scope=$(Encode-SpotifyQueryValue $Scopes)"
  "state=$(Encode-SpotifyQueryValue $state)"
) -join "&"

Write-Host ""
Write-Host "Open this Spotify authorization URL:" -ForegroundColor Cyan
Write-Host "https://accounts.spotify.com/authorize?$query"
Write-Host ""
Write-Host "After approving, Spotify redirects to $RedirectUri."
Write-Host "Copy only the code value from the browser address bar."
