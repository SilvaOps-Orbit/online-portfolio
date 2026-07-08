const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000";
const authCode = process.env.SPOTIFY_AUTH_CODE || process.argv[2] || "";

if (!clientId || !clientSecret || !authCode) {
  console.error("Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_AUTH_CODE.");
  console.error("You can also pass the authorization code as the first argument.");
  process.exit(1);
}

const response = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: redirectUri
  })
});

const data = await response.json();

if (!response.ok) {
  throw new Error(`Spotify authorization failed: ${data.error_description || data.error || response.status}`);
}

console.log("Add this to GitHub repository secrets:");
console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);
