const WORKSPACE_PATTERN = /^[a-zA-Z0-9._ -]{1,80}$/;
const COUNTER_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;

function permittedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin === env.ALLOWED_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    if (["127.0.0.1", "localhost"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)) return origin;
  } catch {
    // Invalid or missing origins stay denied.
  }
  return "";
}

function responseHeaders(origin) {
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

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin) });
}

function counterValue(payload) {
  const values = [
    payload?.value,
    payload?.count,
    payload?.data?.value,
    payload?.data?.count,
    payload?.data?.up_count,
    payload?.data?.counter?.value,
    payload?.data?.counter?.count
  ];
  const value = values.map(Number).find((candidate) => Number.isFinite(candidate) && candidate >= 0);
  if (!Number.isFinite(value)) throw new Error("CounterAPI returned an invalid value");
  return Math.floor(value);
}

async function requestCounter(env, action) {
  if (!env.COUNTERAPI_TOKEN) throw new Error("CounterAPI token is not configured");
  if (!WORKSPACE_PATTERN.test(env.COUNTERAPI_WORKSPACE || "") || !COUNTER_PATTERN.test(env.COUNTERAPI_COUNTER || "")) {
    throw new Error("CounterAPI workspace or counter name is invalid");
  }

  const suffix = action === "up" ? "/up" : "";
  const url = `https://api.counterapi.dev/v2/${encodeURIComponent(env.COUNTERAPI_WORKSPACE)}/${encodeURIComponent(env.COUNTERAPI_COUNTER)}${suffix}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.COUNTERAPI_TOKEN}`
    },
    redirect: "error"
  });
  if (!response.ok) throw new Error(`CounterAPI returned ${response.status}`);
  return counterValue(await response.json());
}

export default {
  async fetch(request, env) {
    const origin = permittedOrigin(request, env);
    if (!origin) return json({ error: "Origin not allowed" }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const track = request.method === "POST" && path === "/api/track";
    const read = request.method === "GET" && path === "/api/value";
    if (!track && !read) return json({ error: "Not found" }, 404, origin);

    try {
      const value = await requestCounter(env, track ? "up" : "get");
      return json({
        value,
        provider: "CounterAPI V2",
        updatedAt: new Date().toISOString()
      }, 200, origin);
    } catch (error) {
      console.error("CounterAPI gateway request failed", error);
      return json({ error: "Counter service unavailable" }, 502, origin);
    }
  }
};
