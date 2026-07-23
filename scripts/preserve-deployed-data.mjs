import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseUrl = (process.env.PRESERVE_DATA_BASE_URL || "").replace(/\/+$/, "");
const files = (process.env.PRESERVE_DATA_FILES || "steam.json").split(",").map((file) => file.trim()).filter(Boolean);

function isPlaceholderText(value) {
  return /pending|not connected|needs key|api refresh|connect market data|fallback|tbc/i.test(String(value || ""));
}

function usefulSteamItem(item) {
  if (!item || typeof item !== "object") return false;
  const title = String(item.title || item.name || "");
  return Boolean(title) && !isPlaceholderText(`${title} ${item.meta || ""} ${item.note || ""} ${item.price || ""}`);
}

function usefulNewsItem(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(item.title && item.url) && !isPlaceholderText(`${item.title} ${item.snippet || ""}`);
}

function usefulMarketItem(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(item.symbol) && !isPlaceholderText(`${item.price || ""} ${item.change || ""} ${item.reason || ""}`);
}

function usefulSpotifyData(data) {
  const current = data?.current || {};
  const currentUseful = Boolean(current.title) && !isPlaceholderText(`${current.title} ${current.meta || ""} ${current.note || ""}`);
  const playlistsUseful = Array.isArray(data?.playlists) && data.playlists.some((item) => item?.title && !isPlaceholderText(item.title));
  return currentUseful || playlistsUseful;
}

function hasUsefulData(file, data) {
  if (!data || typeof data !== "object") return false;

  if (file === "steam.json") {
    return ["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch"]
      .some((key) => Array.isArray(data[key]) && data[key].some(usefulSteamItem));
  }

  if (file === "news.json") {
    return Array.isArray(data.items) && data.items.some(usefulNewsItem);
  }

  if (file === "market.json") {
    return ["indexes", "stocks"].some((key) => Array.isArray(data[key]) && data[key].some(usefulMarketItem));
  }

  if (file === "spotify.json") {
    return usefulSpotifyData(data);
  }

  if (file === "github.json") {
    return Array.isArray(data.repositories) && data.repositories.some((repo) => repo?.name && repo?.html_url);
  }

  return true;
}

async function readLocalData(file) {
  try {
    return JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"));
  } catch (error) {
    return null;
  }
}

async function preserve(file) {
  if (!baseUrl) {
    return;
  }

  const deployedUrl = new URL(`${baseUrl}/data/${file}`);
  deployedUrl.searchParams.set("preserve", Date.now().toString());
  const response = await fetch(deployedUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    return;
  }

  const text = await response.text();
  const deployed = JSON.parse(text);
  const local = await readLocalData(file);
  if (!hasUsefulData(file, deployed) && hasUsefulData(file, local)) {
    console.log(`Kept local data/${file}; deployed copy was a placeholder.`);
    return;
  }

  if (!hasUsefulData(file, deployed)) {
    console.log(`Skipped deployed data/${file}; no useful snapshot found yet.`);
    return;
  }

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../data/${file}`, import.meta.url), `${text.trim()}\n`, "utf8");
  console.log(`Preserved deployed data/${file}`);
}

await Promise.all(files.map((file) => preserve(file).catch(() => undefined)));
