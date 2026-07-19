interface Env {
  RAPIDAPI_KEY: string;
  ALLOWED_ORIGIN: string;
}

interface TranslationPayload {
  texts?: unknown;
  source?: unknown;
  target?: unknown;
}

const RAPIDAPI_HOST = "advanced-multilanguage-ai-translator-api-with-fast-responses.p.rapidapi.com";
const RAPIDAPI_URL = `https://${RAPIDAPI_HOST}/translate.php`;
const LANGUAGES = new Set([
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese", "Japanese", "Korean", "Arabic", "Hindi"
]);

function permittedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get("Origin") || "";
  if (origin === env.ALLOWED_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)) return origin;
  } catch { /* Invalid origins are denied. */ }
  return "";
}

function responseHeaders(origin: string, maxAge = 0): Headers {
  const headers = new Headers({
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    "Content-Security-Policy": "default-src 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function json(data: unknown, status: number, origin: string, maxAge = 0): Response {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin, maxAge) });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

async function parsePayload(request: Request): Promise<{ texts: string[]; source: string; target: string } | null> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > 12_000) return null;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 12_000) return null;
    const payload = JSON.parse(raw) as TranslationPayload;
    const target = cleanText(payload.target, 40);
    const source = cleanText(payload.source, 40) || "English";
    const texts = Array.isArray(payload.texts)
      ? payload.texts.map((value) => cleanText(value, 1000)).filter(Boolean)
      : [];
    const totalLength = texts.reduce((total, value) => total + value.length + 14, 0);
    if (!LANGUAGES.has(target) || !LANGUAGES.has(source) || !texts.length || texts.length > 8 || totalLength > 900) return null;
    return { texts, source, target };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callTranslator(text: string, source: string, target: string, env: Env): Promise<string> {
  const response = await fetch(RAPIDAPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Host": RAPIDAPI_HOST,
      "X-RapidAPI-Key": env.RAPIDAPI_KEY
    },
    body: JSON.stringify({ text, source, target }),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`RapidAPI returned ${response.status}`);
  const payload = await response.json() as { ok?: boolean; translation?: unknown };
  const translation = cleanText(payload.translation, 10_000);
  if (!payload.ok || !translation) throw new Error("RapidAPI returned an invalid translation");
  return translation;
}

function groupedInput(texts: string[]): string {
  return texts.map((text, index) => `[[[E${index}]]] ${text}`).join("\n");
}

function parseGroupedTranslation(value: string, count: number): string[] | null {
  const translations = Array.from({ length: count }, () => "");
  const pattern = /\[\[\[E(\d+)\]\]\]\s*([\s\S]*?)(?=\s*\[\[\[E\d+\]\]\]|$)/g;
  let match = pattern.exec(value);
  while (match) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 0 && index < count) translations[index] = cleanText(match[2], 1000);
    match = pattern.exec(value);
  }
  return translations.every(Boolean) ? translations : null;
}

async function translate(payload: { texts: string[]; source: string; target: string }, env: Env): Promise<string[]> {
  const grouped = await callTranslator(groupedInput(payload.texts), payload.source, payload.target, env);
  const parsed = parseGroupedTranslation(grouped, payload.texts.length);
  if (parsed) return parsed;
  const translations = [];
  for (const text of payload.texts) translations.push(await callTranslator(text, payload.source, payload.target, env));
  return translations;
}

async function handleTranslation(request: Request, env: Env, origin: string): Promise<Response> {
  if (!env.RAPIDAPI_KEY) return json({ error: "Translation secret is not configured" }, 503, origin);
  const payload = await parsePayload(request);
  if (!payload) return json({ error: "Invalid translation payload" }, 400, origin);

  const cacheKey = await sha256(JSON.stringify(payload));
  const cacheRequest = new Request(`${new URL(request.url).origin}/__translation-cache/${cacheKey}`, { method: "GET" });
  const cache = await caches.open("echoops-translations-v1");
  const cached = await cache.match(cacheRequest);
  if (cached) return json(await cached.json(), 200, origin, 86_400);

  try {
    const data = { translations: await translate(payload, env), source: payload.source, target: payload.target };
    await cache.put(cacheRequest, new Response(JSON.stringify(data), {
      headers: { "Cache-Control": "public, max-age=2592000", "Content-Type": "application/json; charset=utf-8" }
    }));
    return json(data, 200, origin, 86_400);
  } catch (error) {
    console.error("Translation provider failed", error);
    return json({ error: "Translation provider unavailable" }, 502, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = permittedOrigin(request, env);
    if (!origin) return json({ error: "Origin not allowed" }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "POST" && path === "/api/translate") return handleTranslation(request, env, origin);
    return json({ error: "Not found" }, 404, origin);
  }
} satisfies ExportedHandler<Env>;
