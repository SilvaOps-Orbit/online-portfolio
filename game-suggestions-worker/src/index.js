const GAME_PATTERN = /^[\p{L}\p{N}\s:'!&+.,()\-\u2122\u00ae]{2,100}$/u;
const USERNAME_PATTERN = /^[\p{L}\p{N} _.-]{1,18}$/u;
const CLIENT_PATTERN = /^[a-f0-9-]{32,64}$/i;
const MAX_REQUESTS_PER_HOUR = 6;

function permittedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin === env.ALLOWED_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    if (["127.0.0.1", "localhost"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)) return origin;
  } catch {
    // Missing or malformed browser origins stay denied.
  }
  return "";
}

function responseHeaders(origin, cache = "no-store") {
  const headers = new Headers({
    "Cache-Control": cache,
    "Content-Security-Policy": "default-src 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function json(data, status, origin, cache) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin, cache) });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parseJson(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 4096) return null;
  try {
    const text = await request.text();
    if (!text || text.length > 4096) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function cleanGameInput(value) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  const appMatch = text.match(/store\.steampowered\.com\/app\/(\d+)/i);
  if (appMatch) return { query: text, appid: Number(appMatch[1]) };
  return GAME_PATTERN.test(text) ? { query: text, appid: null } : null;
}

function cleanUsername(value, anonymous) {
  if (anonymous) return null;
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return USERNAME_PATTERN.test(text) ? text : null;
}

function normalizeKey(value) {
  return value.toLocaleLowerCase("en-AU").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

async function ensureSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key TEXT NOT NULL,
      steam_app_id INTEGER,
      title TEXT NOT NULL,
      username TEXT,
      is_anonymous INTEGER NOT NULL DEFAULT 1 CHECK (is_anonymous IN (0, 1)),
      recommender_hash TEXT NOT NULL,
      price_cents INTEGER,
      price_label TEXT,
      currency TEXT,
      genres_json TEXT NOT NULL DEFAULT '[]',
      dlc_count INTEGER,
      review_percent REAL,
      review_count INTEGER,
      review_summary TEXT,
      image_url TEXT,
      store_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(game_key, recommender_hash)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_game_suggestions_key ON game_suggestions(game_key)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_game_suggestions_updated ON game_suggestions(updated_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS suggestion_rate_limits (
      requester_hash TEXT NOT NULL,
      hour_bucket TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (requester_hash, hour_bucket)
    )`)
  ]);
}

async function rateLimit(request, env, now) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const bucket = now.slice(0, 13);
  const requesterHash = await digest(`echoops-suggestions:${bucket}:${ip}`);
  await env.DB.prepare(`
    INSERT INTO suggestion_rate_limits (requester_hash, hour_bucket, request_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(requester_hash, hour_bucket) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = excluded.updated_at
  `).bind(requesterHash, bucket, now).run();
  const row = await env.DB.prepare("SELECT request_count FROM suggestion_rate_limits WHERE requester_hash = ? AND hour_bucket = ?")
    .bind(requesterHash, bucket).first();
  return Number(row?.request_count || 0) <= MAX_REQUESTS_PER_HOUR;
}

async function steamJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 1800 }
  });
  if (!response.ok) throw new Error(`Steam returned ${response.status}`);
  return response.json();
}

async function findSteamApp(input) {
  let appid = input.appid;
  if (!appid) {
    const search = await steamJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(input.query)}&l=english&cc=AU`);
    appid = Number(search?.items?.[0]?.id || 0);
  }
  if (!appid) return null;

  const [detailsResult, reviewResult] = await Promise.allSettled([
    steamJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=AU&l=en`),
    steamJson(`https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`)
  ]);
  const details = detailsResult.status === "fulfilled" ? detailsResult.value?.[appid]?.data : null;
  if (!details) return null;
  const summary = reviewResult.status === "fulfilled" ? reviewResult.value?.query_summary : null;
  const totalReviews = Number(summary?.total_reviews || 0);
  const totalPositive = Number(summary?.total_positive || 0);
  return {
    appid,
    title: String(details.name || input.query).slice(0, 100),
    priceCents: details.price_overview?.final ?? (details.is_free ? 0 : null),
    priceLabel: details.is_free ? "Free" : details.price_overview?.final_formatted || null,
    currency: details.price_overview?.currency || "AUD",
    genres: Array.isArray(details.genres) ? details.genres.map((genre) => String(genre.description || "")).filter(Boolean).slice(0, 8) : [],
    dlcCount: Array.isArray(details.dlc) ? details.dlc.length : 0,
    reviewPercent: totalReviews ? Math.round(totalPositive / totalReviews * 1000) / 10 : null,
    reviewCount: totalReviews || Number(details.recommendations?.total || 0) || null,
    reviewSummary: summary?.review_score_desc || null,
    imageUrl: details.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    storeUrl: `https://store.steampowered.com/app/${appid}/`
  };
}

function publicGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    let group = groups.get(row.game_key);
    if (!group) {
      let genres = [];
      try { genres = JSON.parse(row.genres_json || "[]"); } catch { genres = []; }
      group = {
        key: row.game_key,
        appid: row.steam_app_id || null,
        title: row.title,
        priceCents: row.price_cents ?? null,
        priceLabel: row.price_label || null,
        currency: row.currency || "AUD",
        genres,
        dlcCount: row.dlc_count ?? null,
        reviewPercent: row.review_percent ?? null,
        reviewCount: row.review_count ?? null,
        reviewSummary: row.review_summary || null,
        imageUrl: row.image_url || null,
        storeUrl: row.store_url || null,
        recommenders: [],
        recommendedAt: row.updated_at
      };
      groups.set(row.game_key, group);
    }
    const anonymousNumber = group.recommenders.filter((name) => name.startsWith("Anonymous #")).length + 1;
    group.recommenders.push(row.is_anonymous ? `Anonymous #${anonymousNumber}` : row.username || `Anonymous #${anonymousNumber}`);
    if (row.updated_at > group.recommendedAt) group.recommendedAt = row.updated_at;
  }
  return Array.from(groups.values()).map((group) => ({ ...group, recommendationCount: group.recommenders.length }));
}

async function listSuggestions(env, origin) {
  await ensureSchema(env);
  const result = await env.DB.prepare(`
    SELECT game_key, steam_app_id, title, username, is_anonymous, price_cents, price_label,
      currency, genres_json, dlc_count, review_percent, review_count, review_summary,
      image_url, store_url, updated_at
    FROM game_suggestions
    ORDER BY updated_at DESC
    LIMIT 300
  `).all();
  return json({ suggestions: publicGroups(result.results || []), updatedAt: new Date().toISOString() }, 200, origin, "public, max-age=30");
}

async function addSuggestion(request, env, origin) {
  const payload = await parseJson(request);
  const input = cleanGameInput(payload?.game);
  const anonymous = payload?.anonymous !== false;
  const username = cleanUsername(payload?.username, anonymous);
  const clientId = typeof payload?.clientId === "string" && CLIENT_PATTERN.test(payload.clientId) ? payload.clientId.toLowerCase() : "";
  if (!payload || !input || !clientId || (!anonymous && !username)) {
    return json({ error: "Enter a valid game and an optional 1-18 character username." }, 400, origin);
  }

  await ensureSchema(env);
  const now = new Date().toISOString();
  if (!(await rateLimit(request, env, now))) return json({ error: "Suggestion limit reached. Try again next hour." }, 429, origin);

  let metadata = null;
  try { metadata = await findSteamApp(input); } catch (error) { console.warn("Steam metadata lookup failed", error); }
  const title = metadata?.title || input.query.slice(0, 100);
  const normalizedTitle = normalizeKey(title);
  const gameKey = metadata?.appid
    ? `steam-${metadata.appid}`
    : `title-${normalizedTitle || (await digest(title)).slice(0, 24)}`;
  const recommenderHash = await digest(`echoops-game-recommender:${clientId}`);
  await env.DB.prepare(`
    INSERT INTO game_suggestions (
      game_key, steam_app_id, title, username, is_anonymous, recommender_hash,
      price_cents, price_label, currency, genres_json, dlc_count, review_percent,
      review_count, review_summary, image_url, store_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_key, recommender_hash) DO UPDATE SET
      username = excluded.username,
      is_anonymous = excluded.is_anonymous,
      price_cents = excluded.price_cents,
      price_label = excluded.price_label,
      currency = excluded.currency,
      genres_json = excluded.genres_json,
      dlc_count = excluded.dlc_count,
      review_percent = excluded.review_percent,
      review_count = excluded.review_count,
      review_summary = excluded.review_summary,
      image_url = excluded.image_url,
      store_url = excluded.store_url,
      updated_at = excluded.updated_at
  `).bind(
    gameKey, metadata?.appid || null, title, username, anonymous ? 1 : 0, recommenderHash,
    metadata?.priceCents ?? null, metadata?.priceLabel || null, metadata?.currency || "AUD",
    JSON.stringify(metadata?.genres || []), metadata?.dlcCount ?? null, metadata?.reviewPercent ?? null,
    metadata?.reviewCount ?? null, metadata?.reviewSummary || null, metadata?.imageUrl || null,
    metadata?.storeUrl || null, now, now
  ).run();
  return listSuggestions(env, origin);
}

export default {
  async fetch(request, env) {
    const origin = permittedOrigin(request, env);
    if (!origin) return json({ error: "Origin not allowed" }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && path === "/api/game-suggestions") return listSuggestions(env, origin);
    if (request.method === "POST" && path === "/api/game-suggestions") return addSuggestion(request, env, origin);
    return json({ error: "Not found" }, 404, origin);
  }
};
