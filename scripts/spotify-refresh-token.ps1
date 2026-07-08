param(
  [string]$ClientId = $env:SPOTIFY_CLIENT_ID,
  [string]$ClientSecret = $env:SPOTIFY_CLIENT_SECRET,
  [string]$AuthCode = $env:SPOTIFY_AUTH_CODE,
  [string]$RedirectUri = $(if ($env:SPOTIFY_REDIRECT_URI) { $env:SPOTIFY_REDIRECT_URI } else { "http://127.0.0.1:3000" })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  throw "Set SPOTIFY_CLIENT_ID first."
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  throw "Set SPOTIFY_CLIENT_SECRET first. Do not paste the secret into chat."
}

if ([string]::IsNullOrWhiteSpace($AuthCode)) {
  throw "Set SPOTIFY_AUTH_CODE to the code value from the redirected URL."
}

$basicToken = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${ClientId}:${ClientSecret}"))
$body = @{
  grant_type = "authorization_code"
  code = $AuthCode
  redirect_uri = $RedirectUri
}

try {
  $response = Invoke-RestMethod `
    -Uri "https://accounts.spotify.com/api/token" `
    -Method Post `
    -Headers @{ Authorization = "Basic $basicToken" } `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $body
} catch {
  Write-Error "Spotify token request failed. Check that the auth code is fresh, redirect URI matches exactly, and client secret is correct. Details: $($_.Exception.Message)"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($response.refresh_token)) {
  throw "Spotify did not return a refresh token. Re-run the auth URL step and approve the app again."
}

Write-Host ""
Write-Host "Add this value to GitHub repository secrets as SPOTIFY_REFRESH_TOKEN:" -ForegroundColor Cyan
Write-Host $response.refresh_token
Write-Host ""
Write-Host "Keep it private. Do not commit it or paste it into chat."
