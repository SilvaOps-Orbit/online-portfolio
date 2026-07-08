import { randomBytes } from "node:crypto";

const clientId = process.env.SPOTIFY_CLIENT_ID || process.argv[2] || "";
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000";
const scopes = process.env.SPOTIFY_SCOPES || "user-read-currently-playing user-read-playback-state playlist-read-private";

if (!clientId) {
  console.error("Set SPOTIFY_CLIENT_ID or pass the client ID as the first argument.");
  process.exit(1);
}

const url = new URL("https://accounts.spotify.com/authorize");
url.search = new URLSearchParams({
  client_id: clientId,
  response_type: "code",
  redirect_uri: redirectUri,
  scope: scopes,
  state: randomBytes(16).toString("hex")
}).toString();

console.log(url.toString());
