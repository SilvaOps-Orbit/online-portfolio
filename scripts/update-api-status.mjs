import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/api-status.json", import.meta.url);
const statusEndpoint = "https://apistatuscheck.com/api/status";

const providers = [
  { id: "github", label: "GitHub", role: "Repositories and activity", slug: "github", coverage: "external" },
  { id: "cloudflare", label: "Cloudflare", role: "Workers and D1", slug: "cloudflare", coverage: "external" },
  { id: "steam", label: "Steam", role: "Profile and game data", slug: "steam", coverage: "external" },
  { id: "spotify", label: "Spotify", role: "Playback and playlists", slug: "spotify", coverage: "external" },
  { id: "discord", label: "Discord", role: "Community connection", slug: "discord", coverage: "external" },
  { id: "finnhub", label: "Finnhub", role: "Market quotes", snapshot: "market.json", coverage: "snapshot" },
  { id: "yfinance", label: "yfinance", role: "Market cross-reference", snapshot: "market.json", coverage: "snapshot" },
  { id: "newsapi", label: "NewsAPI", role: "News aggregation", snapshot: "news.json", coverage: "snapshot" },
  { id: "mediastack", label: "MediaStack", role: "News cross-reference", snapshot: "news.json", coverage: "snapshot" },
  { id: "hacker-news", label: "Hacker News", role: "Technology news", snapshot: "news.json", requiredSource: "Hacker News", coverage: "snapshot" },
  { id: "rss", label: "RSS feeds", role: "Publisher fallbacks", snapshot: "news.json", coverage: "snapshot" },
  { id: "genius", label: "Genius", role: "Song and artist context", snapshot: "spotify.json", coverage: "snapshot" },
  { id: "audiodb", label: "TheAudioDB", role: "Artist cross-reference", snapshot: "spotify.json", coverage: "snapshot" },
  { id: "jokeapi", label: "JokeAPI", role: "Ops Console jokes", coverage: "browser" },
  { id: "uselessfacts", label: "Useless Facts", role: "Daily fact", coverage: "browser" },
  { id: "counterapi", label: "CounterAPI", role: "Credential-isolated raw counter", coverage: "browser" },
  { id: "abacus", label: "Abacus", role: "Raw-hit cross-check", coverage: "browser" },
  { id: "rapidapi", label: "RapidAPI Translator", role: "Site language gateway", coverage: "setup" }
];

function cleanText(value, maxLength = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return null;
  }
}

function normalizeStatus(value) {
  const status = cleanText(value, 30).toLowerCase();
  if (["up", "operational"].includes(status)) return "up";
  if (["degraded", "partial", "maintenance"].includes(status)) return "degraded";
  if (["down", "outage", "offline"].includes(status)) return "down";
  return "unknown";
}

function snapshotStatus(snapshot, provider) {
  if (!snapshot) return "unknown";
  if (provider.requiredSource) {
    const hasRequiredSource = Array.isArray(snapshot.items) && snapshot.items.some((item) => {
      const sources = [
        item?.sourceGroup,
        ...(Array.isArray(item?.sourceGroups) ? item.sourceGroups : []),
        ...(Array.isArray(item?.sourceApis) ? item.sourceApis : [])
      ];
      return sources.includes(provider.requiredSource);
    });
    if (!hasRequiredSource) return "unknown";
  }
  if (snapshot.stale === true) return "degraded";
  return snapshot.lastGoodAt || snapshot.generatedAt ? "up" : "unknown";
}

async function buildSnapshot(existing) {
  const response = await fetch(statusEndpoint, {
    headers: { "User-Agent": "EchoOps-Portfolio-Status-Snapshot" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`API Status Check returned ${response.status}`);
  const payload = await response.json();
  const statusRows = Array.isArray(payload?.apis) ? payload.apis : [];
  const statusBySlug = new Map(statusRows.map((item) => [cleanText(item?.slug, 80), item]));
  const snapshotFiles = new Map();
  for (const provider of providers.filter((item) => item.snapshot)) {
    if (!snapshotFiles.has(provider.snapshot)) {
      snapshotFiles.set(provider.snapshot, await readJson(new URL(`../data/${provider.snapshot}`, import.meta.url)));
    }
  }

  const checkedAt = cleanText(payload?.lastUpdated, 60) || new Date().toISOString();
  const rows = providers.map((provider) => {
    if (provider.coverage === "external") {
      const external = statusBySlug.get(provider.slug);
      return {
        ...provider,
        status: normalizeStatus(external?.status),
        checkedAt,
        source: external ? "API Status Check" : "API Status Check listing unavailable",
        statusUrl: external ? `https://apistatuscheck.com/api/${encodeURIComponent(provider.slug)}` : ""
      };
    }
    if (provider.coverage === "snapshot") {
      const snapshot = snapshotFiles.get(provider.snapshot);
      return {
        ...provider,
        status: snapshotStatus(snapshot, provider),
        checkedAt: cleanText(snapshot?.lastGoodAt || snapshot?.generatedAt, 60) || null,
        source: `${provider.snapshot} generated snapshot`,
        statusUrl: ""
      };
    }
    return {
      ...provider,
      status: "unknown",
      checkedAt: null,
      source: provider.coverage === "browser" ? "Checked by the browser when used" : "Secure gateway setup pending",
      statusUrl: ""
    };
  });

  const monitored = rows.filter((item) => item.coverage === "external");
  const up = monitored.filter((item) => item.status === "up").length;
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    generatedAt: now,
    lastGoodAt: now,
    source: "API Status Check public JSON plus portfolio snapshot coverage",
    status: `${up} of ${monitored.length} externally monitored providers currently report up.`,
    stale: false,
    externalLastUpdated: checkedAt,
    providers: rows
  };
}

const existing = await readJson(outputPath);

try {
  const snapshot = await buildSnapshot(existing);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated data/api-status.json with ${snapshot.providers.length} provider records.`);
} catch (error) {
  if (!Array.isArray(existing?.providers) || !existing.providers.length) throw error;
  const fallback = {
    ...existing,
    source: existing.source || "last successful API status snapshot",
    status: `Last successful API status snapshot preserved: ${cleanText(error.message, 160)}`,
    stale: true
  };
  await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.warn(fallback.status);
}
