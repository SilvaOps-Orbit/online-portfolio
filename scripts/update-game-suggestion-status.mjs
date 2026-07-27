import { mkdir, readFile, writeFile } from "node:fs/promises";

const dataDirectory = new URL("../data/", import.meta.url);
const outputPath = new URL("game-suggestion-status.json", dataDirectory);
const steamPath = new URL("steam.json", dataDirectory);
const youtubePath = new URL("youtube.json", dataDirectory);
const suggestionEndpoint = String(
  process.env.GAME_SUGGESTIONS_ENDPOINT || "https://echoops-game-suggestions.alvis-dev.workers.dev"
).replace(/\/+$/, "");
const siteOrigin = process.env.PORTFOLIO_ORIGIN || "https://silvaops-orbit.github.io";

function cleanText(value, maxLength = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalize(value) {
  return cleanText(value, 240)
    .toLocaleLowerCase("en-AU")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function videoMatchesGame(video, game) {
  const gameName = normalize(game.title);
  const videoTitle = normalize(video.title);
  const videoDescription = normalize(video.description);
  if (!gameName || !videoTitle) return false;
  if (videoTitle.includes(gameName)) return true;

  const ignored = new Set(["the", "and", "for", "with", "game", "edition", "remastered", "tm"]);
  const tokens = gameName.split(" ").filter((token) => token.length >= 3 && !ignored.has(token));
  if (!tokens.length) return false;
  if (tokens.length > 1 && videoDescription.includes(gameName)) return true;
  const titleTokens = videoTitle.split(" ");
  const matched = tokens.filter((token) => titleTokens.includes(token)).length;
  return matched >= Math.min(3, tokens.length) && matched / tokens.length >= 0.7;
}

function sanitizeVideo(video) {
  const id = cleanText(video.id, 80);
  const url = cleanText(video.url, 500);
  return {
    id,
    title: cleanText(video.title),
    publishedAt: cleanText(video.publishedAt, 40),
    image: cleanText(video.image, 500),
    url: url || (id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "")
  };
}

async function loadSuggestions(existingGames) {
  try {
    const response = await fetch(`${suggestionEndpoint}/api/game-suggestions`, {
      headers: { Accept: "application/json", Origin: siteOrigin },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`Suggestion service returned ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload.suggestions) ? payload.suggestions : [];
  } catch (error) {
    console.warn(`Suggestion refresh failed; preserving the last good list. ${error.message}`);
    return existingGames;
  }
}

const [steam, youtube, existing] = await Promise.all([
  readJson(steamPath, {}),
  readJson(youtubePath, {}),
  readJson(outputPath, { games: [] })
]);
const existingGames = Array.isArray(existing.games) ? existing.games : [];
const suggestions = await loadSuggestions(existingGames);
const ownedGames = Array.isArray(steam?.insights?.ownedGames) ? steam.insights.ownedGames : [];
const videos = Array.isArray(youtube?.latestVideos) ? youtube.latestVideos : [];
const ownedIds = new Set(ownedGames.map((game) => Number(game.appid || 0)).filter(Boolean));
const ownedTitles = new Set(ownedGames.map((game) => normalize(game.title || game.name)).filter(Boolean));
const previousByKey = new Map(existingGames.map((game) => [String(game.key || `steam-${game.appid || ""}`), game]));
const now = new Date().toISOString();

const games = suggestions.map((suggestion) => {
  const key = cleanText(suggestion.key || `steam-${suggestion.appid || ""}`, 120);
  const appid = Number(suggestion.appid || 0) || null;
  const title = cleanText(suggestion.title);
  const previous = previousByKey.get(key) || {};
  const bought = Boolean((appid && ownedIds.has(appid)) || ownedTitles.has(normalize(title)));
  const matchedVideos = videos.filter((video) => videoMatchesGame(video, { title })).map(sanitizeVideo);
  return {
    key,
    appid,
    title,
    bought,
    boughtDetectedAt: bought ? cleanText(previous.boughtDetectedAt, 40) || now : null,
    videos: matchedVideos,
    checkedAt: now
  };
});

await mkdir(dataDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: now,
  source: "Steam owned library + YouTube uploads + community suggestion queue",
  games
}, null, 2)}\n`, "utf8");
console.log(`Updated suggestion ownership and videos for ${games.length} games.`);
