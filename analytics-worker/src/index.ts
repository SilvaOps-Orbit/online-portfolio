interface Env {
  DB: D1Database;
  ANALYTICS_PEPPER: string;
  ALLOWED_ORIGIN: string;
}

interface VisitorPayload {
  visitorId?: unknown;
  browser?: unknown;
  device?: unknown;
  achievementId?: unknown;
  egg_id?: unknown;
  action?: unknown;
  path?: unknown;
  referrer?: unknown;
}

interface CountRow { count: number; }
interface UpdatedRow { updated_at: string | null; }
interface BreakdownRow { label: string; count: number; }

const BROWSERS = new Set(["Chrome", "Edge", "Firefox", "Opera", "Safari", "Samsung Internet", "Other"]);
const DEVICES = new Set(["Desktop", "Mobile", "Tablet", "Unknown"]);
const ACHIEVEMENTS = new Map([
  ["console", "Local Operator"],
  ["integrity", "Integrity Analyst"],
  ["architecture", "Systems Mapper"],
  ["snake", "Packet Wrangler"]
]);

function permittedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get("Origin") || "";
  if (origin === env.ALLOWED_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    if (["127.0.0.1", "localhost"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)) return origin;
  } catch { /* invalid origins are denied */ }
  return "";
}

function responseHeaders(origin: string): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
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

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin) });
}

async function parsePayload(request: Request): Promise<VisitorPayload | null> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 2048) return null;
  try {
    const text = await request.text();
    if (!text || text.length > 2048) return null;
    const value = JSON.parse(text) as VisitorPayload;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function normalizePayload(payload: VisitorPayload) {
  const visitorId = typeof payload.visitorId === "string" && /^[a-f0-9-]{32,64}$/i.test(payload.visitorId)
    ? payload.visitorId.toLowerCase()
    : "";
  const browser = typeof payload.browser === "string" && BROWSERS.has(payload.browser) ? payload.browser : "Other";
  const device = typeof payload.device === "string" && DEVICES.has(payload.device) ? payload.device : "Unknown";
  const requestedAchievement = typeof payload.achievementId === "string"
    ? payload.achievementId
    : typeof payload.egg_id === "string"
      ? payload.egg_id
      : "";
  const action = typeof payload.action === "string" ? payload.action : "";
  const achievementId = (!action || action === "unlocked") && ACHIEVEMENTS.has(requestedAchievement) ? requestedAchievement : "";
  return { visitorId, browser, device, achievementId };
}

async function hashVisitor(visitorId: string, pepper: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${pepper}:${visitorId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function upsertVisitor(env: Env, hash: string, browser: string, device: string, now: string): D1PreparedStatement {
  return env.DB.prepare(`
    INSERT INTO visitors (visitor_hash, first_seen, last_seen, browser, device)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(visitor_hash) DO UPDATE SET
      last_seen = excluded.last_seen,
      browser = excluded.browser,
      device = excluded.device
  `).bind(hash, now, now, browser, device);
}

async function breakdown(env: Env, column: "browser" | "device", total: number) {
  const result = await env.DB.prepare(`SELECT ${column} AS label, COUNT(*) AS count FROM visitors GROUP BY ${column} ORDER BY count DESC`).all<BreakdownRow>();
  return (result.results || []).map((row) => ({
    label: row.label,
    count: Number(row.count || 0),
    percent: total ? (Number(row.count || 0) / total) * 100 : 0
  }));
}

async function getStats(env: Env) {
  const [visitors, views, finders, completions, updated, achievementRows] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM visitors").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM daily_views").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM visitors WHERE is_egg_finder = 1").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM visitors WHERE completed_vault = 1").first<CountRow>(),
    env.DB.prepare("SELECT MAX(last_seen) AS updated_at FROM visitors").first<UpdatedRow>(),
    env.DB.prepare("SELECT achievement_id AS label, COUNT(*) AS count FROM achievements GROUP BY achievement_id").all<BreakdownRow>()
  ]);
  const uniqueVisitors = Number(visitors?.count || 0);
  const counts = new Map((achievementRows.results || []).map((row) => [row.label, Number(row.count || 0)]));
  return {
    uniqueVisitors,
    totalViews: Number(views?.count || 0),
    easterEggFinders: Number(finders?.count || 0),
    vaultCompletions: Number(completions?.count || 0),
    browsers: await breakdown(env, "browser", uniqueVisitors),
    devices: await breakdown(env, "device", uniqueVisitors),
    achievements: Array.from(ACHIEVEMENTS, ([id, label]) => ({ id, label, count: counts.get(id) || 0 })),
    updatedAt: updated?.updated_at || new Date().toISOString(),
    viewProvider: "Cloudflare D1 daily dedupe"
  };
}

async function recordView(request: Request, env: Env, origin: string): Promise<Response> {
  const payload = await parsePayload(request);
  if (!payload) return json({ error: "Invalid JSON payload" }, 400, origin);
  const value = normalizePayload(payload);
  if (!value.visitorId) return json({ error: "Invalid anonymous browser identifier" }, 400, origin);
  const now = new Date().toISOString();
  const hash = await hashVisitor(value.visitorId, env.ANALYTICS_PEPPER);
  await upsertVisitor(env, hash, value.browser, value.device, now).run();
  await env.DB.prepare("INSERT OR IGNORE INTO daily_views (visitor_hash, view_date, viewed_at) VALUES (?, ?, ?)").bind(hash, now.slice(0, 10), now).run();
  return json({ stats: await getStats(env) }, 200, origin);
}

async function recordAchievement(request: Request, env: Env, origin: string): Promise<Response> {
  const payload = await parsePayload(request);
  if (!payload) return json({ error: "Invalid JSON payload" }, 400, origin);
  const value = normalizePayload(payload);
  if (!value.visitorId || !value.achievementId) return json({ error: "Invalid discovery payload" }, 400, origin);
  const now = new Date().toISOString();
  const hash = await hashVisitor(value.visitorId, env.ANALYTICS_PEPPER);
  await env.DB.batch([
    upsertVisitor(env, hash, value.browser, value.device, now),
    env.DB.prepare("INSERT OR IGNORE INTO achievements (visitor_hash, achievement_id, discovered_at) VALUES (?, ?, ?)").bind(hash, value.achievementId, now),
    env.DB.prepare("UPDATE visitors SET is_egg_finder = 1 WHERE visitor_hash = ?").bind(hash)
  ]);
  const found = await env.DB.prepare("SELECT COUNT(*) AS count FROM achievements WHERE visitor_hash = ?").bind(hash).first<CountRow>();
  if (Number(found?.count || 0) >= ACHIEVEMENTS.size) {
    await env.DB.prepare("UPDATE visitors SET completed_vault = 1 WHERE visitor_hash = ?").bind(hash).run();
  }
  return json({ stats: await getStats(env) }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = permittedOrigin(request, env);
    if (!origin) return json({ error: "Origin not allowed" }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && path === "/api/stats") return json({ stats: await getStats(env) }, 200, origin);
    if (request.method === "POST" && ["/api/track", "/api/view"].includes(path)) return recordView(request, env, origin);
    if (request.method === "POST" && ["/api/easter-egg", "/api/achievement"].includes(path)) return recordAchievement(request, env, origin);
    return json({ error: "Not found" }, 404, origin);
  }
} satisfies ExportedHandler<Env>;
