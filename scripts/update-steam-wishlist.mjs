import { mkdir, readFile, writeFile } from "node:fs/promises";

const steamId = process.env.STEAM_ID || "76561199192411740";
const steamApiKey = process.env.STEAM_API_KEY || "";
const wishlistUrl = process.env.STEAM_WISHLIST_URL
  || `https://store.steampowered.com/wishlist/profiles/${steamId}/`;
const syncEndpoint = String(process.env.GAME_SUGGESTION_ENDPOINT || "").replace(/\/+$/, "");
const syncToken = process.env.WISHLIST_SYNC_TOKEN || "";
const outputPath = new URL("../data/steam-wishlist.json", import.meta.url);
const storeBatchSize = 100;

const GENRE_RULES = [
  ["Action", /^action$/i],
  ["Adventure", /^adventure$/i],
  ["Arcade", /^arcade$/i],
  ["Battle Royale", /^battle royale$/i],
  ["Card & Board", /^(card game|board game|deckbuilding)$/i],
  ["Casual", /^casual$/i],
  ["Fighting", /^(fighting|martial arts)$/i],
  ["Free to Play", /^free to play$/i],
  ["Horror", /horror/i],
  ["Indie", /^indie$/i],
  ["Massively Multiplayer", /^(massively multiplayer|mmo|mmorpg)$/i],
  ["Metroidvania", /^metroidvania$/i],
  ["Music & Rhythm", /^(music|rhythm)$/i],
  ["Party", /^party game$/i],
  ["Platformer", /platformer/i],
  ["Puzzle", /puzzle/i],
  ["Racing", /racing/i],
  ["Roguelike", /rogue-?li/i],
  ["RPG", /(^rpg$|role-?playing|action rpg|jrpg|crpg)/i],
  ["Sandbox", /^sandbox$/i],
  ["Shooter", /(shooter|^fps$)/i],
  ["Simulation", /(simulation|simulator)/i],
  ["Sports", /^sports$/i],
  ["Stealth", /^stealth$/i],
  ["Strategy", /(strategy|^rts$|^4x$|tower defense|^moba$)/i],
  ["Survival", /^survival$/i],
  ["Tactical", /^tactical$/i],
  ["Turn-Based", /^turn-based/i],
  ["Visual Novel", /^visual novel$/i]
];

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "EchoOps portfolio Steam wishlist refresh"
      }
    });
    if (response.ok) return response.json();
    lastStatus = response.status;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
  }
  throw new Error(`Steam returned ${lastStatus || "an error"} for ${new URL(url).pathname}`);
}

async function loadTagNames() {
  const tags = await fetchJson("https://store.steampowered.com/tagdata/populartags/english");
  return new Map((Array.isArray(tags) ? tags : [])
    .map((tag) => [Number(tag?.tagid || 0), String(tag?.name || "").trim()])
    .filter(([tagid, name]) => tagid && name));
}

function broadGenres(tags) {
  const genres = [];
  for (const [genre, pattern] of GENRE_RULES) {
    if (tags.some((tag) => pattern.test(tag))) genres.push(genre);
  }
  return genres.slice(0, 8);
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );
}

function storeArtwork(item, appid) {
  const format = String(item?.assets?.asset_url_format || "").trim();
  const filename = item?.assets?.header || item?.assets?.main_capsule || "header.jpg";
  if (format && filename) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/${format.replace("${FILENAME}", filename)}`;
  }
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
}

async function loadStoreDetails(appids, tagNames) {
  const details = new Map();
  for (const batch of chunks(appids, storeBatchSize)) {
    try {
      const input = {
        ids: batch.map((appid) => ({ appid })),
        context: { language: "english", country_code: "AU", steam_realm: 1 },
        data_request: {
          include_basic_info: true,
          include_assets: true,
          include_all_purchase_options: true,
          include_tag_count: 20,
          include_reviews: true
        }
      };
      const payload = await fetchJson(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`
      );
      const items = Array.isArray(payload?.response?.store_items)
        ? payload.response.store_items
        : [];
      items.forEach((item) => {
        const appid = Number(item.appid || 0);
        if (!appid) return;
        const option = item.best_purchase_option
          || (Array.isArray(item.purchase_options)
            ? item.purchase_options
              .filter((entry) => Number.isFinite(Number(entry?.final_price_in_cents)))
              .sort((a, b) => Number(a.final_price_in_cents) - Number(b.final_price_in_cents))[0]
            : null);
        const review = item.reviews?.summary_filtered || item.reviews?.summary_language_specific || null;
        const tags = (Array.isArray(item.tags) ? item.tags : [])
          .map((tag) => tagNames.get(Number(tag?.tagid || 0)))
          .filter(Boolean);
        details.set(appid, {
          title: String(item.name || "").trim(),
          image: storeArtwork(item, appid),
          priceCents: option ? Number(option.final_price_in_cents) : null,
          priceLabel: option?.formatted_final_price || null,
          originalPriceCents: option?.original_price_in_cents
            ? Number(option.original_price_in_cents)
            : null,
          originalPriceLabel: option?.formatted_original_price || null,
          discountPercent: Number(option?.discount_pct || 0),
          genres: broadGenres(tags),
          reviewPercent: Number.isFinite(Number(review?.percent_positive))
            ? Number(review.percent_positive)
            : null,
          reviewCount: Number.isFinite(Number(review?.review_count))
            ? Number(review.review_count)
            : null,
          reviewSummary: String(review?.review_score_label || "").trim() || null
        });
      });
    } catch (error) {
      console.warn(`Store details unavailable for a ${batch.length}-game wishlist batch.`, error);
    }
  }
  return details;
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

  let tagNames = new Map();
  try {
    tagNames = await loadTagNames();
  } catch (error) {
    console.warn("Steam tag dictionary unavailable; prices will still refresh.", error);
  }
  const storeDetails = await loadStoreDetails(
    wishlistItems.map((item) => Number(item.appid || 0)).filter(Boolean),
    tagNames
  );

  return wishlistItems
    .map((item) => {
      const appid = Number(item.appid || 0);
      if (!appid) return null;
      const store = storeDetails.get(appid) || {};
      return {
        appid,
        title: store.title || catalog.get(appid) || `Steam App ${appid}`,
        priority: Number(item.priority || 0),
        addedAt: Number(item.date_added || 0)
          ? new Date(Number(item.date_added) * 1000).toISOString()
          : null,
        image: store.image || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
        priceCents: store.priceCents ?? null,
        priceLabel: store.priceLabel || null,
        originalPriceCents: store.originalPriceCents ?? null,
        originalPriceLabel: store.originalPriceLabel || null,
        discountPercent: Number(store.discountPercent || 0),
        genres: Array.isArray(store.genres) ? store.genres : [],
        reviewPercent: store.reviewPercent ?? null,
        reviewCount: store.reviewCount ?? null,
        reviewSummary: store.reviewSummary || null,
        url: `https://store.steampowered.com/app/${appid}/`
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const discountOrder = Number(b.discountPercent || 0) - Number(a.discountPercent || 0);
      if (discountOrder) return discountOrder;
      const aPrice = Number.isFinite(a.priceCents) ? a.priceCents : Number.POSITIVE_INFINITY;
      const bPrice = Number.isFinite(b.priceCents) ? b.priceCents : Number.POSITIVE_INFINITY;
      return aPrice - bPrice
        || a.priority - b.priority
        || String(b.addedAt || "").localeCompare(String(a.addedAt || ""));
    });
}

async function syncSuggestions(games) {
  if (!syncEndpoint || !syncToken) {
    console.warn("Wishlist suggestion sync skipped because its endpoint or private token is unavailable.");
    return false;
  }
  const syncGames = games.map(({
    appid,
    title,
    image,
    priceCents,
    priceLabel,
    genres,
    reviewPercent,
    reviewCount,
    reviewSummary,
    url
  }) => ({
    appid,
    title,
    image,
    priceCents,
    priceLabel,
    currency: "AUD",
    genres,
    reviewPercent,
    reviewCount,
    reviewSummary,
    storeUrl: url
  }));
  const response = await fetch(`${syncEndpoint}/api/internal/wishlist-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${syncToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ games: syncGames })
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
      schemaVersion: 2,
      generatedAt,
      lastGoodAt: generatedAt,
      source: "Steam IWishlistService + IStoreService catalog + IStoreBrowseService pricing",
      status: synced
        ? `${games.length} wishlist games refreshed and synced to the suggestion board.`
        : `${games.length} wishlist games refreshed; suggestion sync is queued for retry.`,
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
