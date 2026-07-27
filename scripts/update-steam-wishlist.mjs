import { mkdir, readFile, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const steamApiKey = process.env.STEAM_API_KEY || "";
const wishlistUrl = process.env.STEAM_WISHLIST_URL
  || `https://store.steampowered.com/wishlist/profiles/${steamId}/`;
const syncEndpoint = String(process.env.GAME_SUGGESTION_ENDPOINT || "").replace(/\/+$/, "");
const syncToken = process.env.WISHLIST_SYNC_TOKEN || "";
const outputPath = new URL("../data/steam-wishlist.json", import.meta.url);

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "EchoOps portfolio Steam wishlist refresh"
    }
  });
  if (!response.ok) throw new Error(`Steam returned ${response.status} for ${new URL(url).pathname}`);
  return response.json();
}

async function loadWishlist(existing) {
  const wishlistPayload = await fetchJson(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${encodeURIComponent(steamId)}`);
  const wishlistItems = Array.isArray(wishlistPayload?.response?.items)
    ? wishlistPayload.response.items
    : [];
  if (!wishlistItems.length) return [];

  const catalog = new Map(
    (Array.isArray(existing?.games) ? existing.games : [])
      .map((game) => [Number(game.appid), String(game.title || "").trim()])
      .filter(([appid, title]) => appid && title)
  );
  if (wishlistItems.some((item) => !catalog.has(Number(item.appid)))) {
    if (!steamApiKey) throw new Error("STEAM_API_KEY is required to resolve wishlist game names.");
    const highestWishlistAppid = Math.max(...wishlistItems.map((item) => Number(item.appid || 0)));
    let lastAppid = 0;
    do {
      const input = {
        include_games: true,
        include_dlc: false,
        include_software: false,
        include_videos: false,
        include_hardware: false,
        max_results: 50000,
        last_appid: lastAppid
      };
      const page = await fetchJson(`https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${encodeURIComponent(steamApiKey)}&input_json=${encodeURIComponent(JSON.stringify(input))}`);
      const apps = Array.isArray(page?.response?.apps) ? page.response.apps : [];
      if (!apps.length) break;
      apps.forEach((app) => {
        const appid = Number(app.appid || 0);
        const title = String(app.name || "").trim();
        if (appid && title) catalog.set(appid, title);
      });
      const nextAppid = Number(page?.response?.last_appid || apps.at(-1)?.appid || 0);
      if (!nextAppid || nextAppid <= lastAppid) break;
      lastAppid = nextAppid;
    } while (lastAppid < highestWishlistAppid);
  }

  return wishlistItems
    .map((item) => {
      const appid = Number(item.appid || 0);
      if (!appid) return null;
      return {
        appid,
        title: catalog.get(appid) || `Steam App ${appid}`,
        priority: Number(item.priority || 0),
        addedAt: Number(item.date_added || 0)
          ? new Date(Number(item.date_added) * 1000).toISOString()
          : null,
        image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
        url: `https://store.steampowered.com/app/${appid}/`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
}

async function syncSuggestions(games) {
  if (!syncEndpoint || !syncToken) {
    console.warn("Wishlist suggestion sync skipped because its endpoint or private token is unavailable.");
    return false;
  }
  const response = await fetch(`${syncEndpoint}/api/internal/wishlist-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${syncToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ games })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Wishlist suggestion sync returned ${response.status}: ${detail.slice(0, 180)}`);
  }
  return true;
}

async function main() {
  const existing = await readExisting();
  try {
    const games = await loadWishlist(existing);
    if (!games.length) throw new Error("Steam returned an empty wishlist.");
    let synced = false;
    try {
      synced = await syncSuggestions(games);
    } catch (syncError) {
      console.warn("Wishlist games were refreshed, but suggestion-board sync will retry later.", syncError);
    }
    const generatedAt = new Date().toISOString();
    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt,
      lastGoodAt: generatedAt,
      source: "Steam IWishlistService + ISteamApps catalog",
      status: synced
        ? `${games.length} wishlist games refreshed and synced to the suggestion board.`
        : `${games.length} wishlist games refreshed; suggestion sync is waiting for its private token.`,
      stale: false,
      profileUrl: wishlistUrl,
      recommenderLabel: "Steam Wishlist",
      games
    }, null, 2)}\n`, "utf8");
    console.log(`Updated data/steam-wishlist.json with ${games.length} games${synced ? " and synced suggestions" : ""}.`);
  } catch (error) {
    if (!existing?.games?.length) throw error;
    const fallback = {
      ...existing,
      generatedAt: new Date().toISOString(),
      source: existing.source || "last successful Steam wishlist snapshot",
      status: `Wishlist refresh unavailable; showing ${existing.games.length} last saved games.`,
      stale: true
    };
    await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    console.warn(fallback.status, error);
  }
}

await main();
