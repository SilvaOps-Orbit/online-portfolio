export type IntegrationState = "checking" | "live" | "cached" | "partial" | "offline";

export interface IntegrationStatus {
  id: string;
  label: string;
  state: IntegrationState;
  source: string;
  updatedAt: string | null;
  detail: string;
}

export type ProviderCoverage = "external" | "snapshot" | "browser" | "setup";
export type ProviderState = "up" | "degraded" | "down" | "unknown";

export interface ProviderStatus {
  id: string;
  label: string;
  role: string;
  coverage: ProviderCoverage;
  status: ProviderState;
  source: string;
  checkedAt: string | null;
  statusUrl: string;
}

interface SnapshotDefinition {
  id: string;
  label: string;
  path: string;
}

interface SnapshotPayload {
  generatedAt?: string;
  lastGoodAt?: string;
  source?: string;
  status?: string;
  stale?: boolean;
  stats?: Array<{ label?: string; value?: string; note?: string }>;
}

interface GitHubHourlyCache {
  checkedAt?: number;
  nextCheckAt?: number;
  status?: "checking" | "live" | "error";
  repositories?: unknown[];
  remaining?: number;
}

interface ProviderSnapshotPayload {
  providers?: unknown[];
}

const SNAPSHOT_DEFINITIONS: SnapshotDefinition[] = [
  { id: "steam", label: "Steam", path: "data/steam.json" },
  { id: "spotify", label: "Spotify", path: "data/spotify.json" },
  { id: "market", label: "Markets", path: "data/market.json" },
  { id: "news", label: "News", path: "data/news.json" },
  { id: "github", label: "GitHub", path: "data/github.json" }
];

const SETUP_PATTERN = /needs? key|add .*secret|not connected|ready for api secrets/i;
const GITHUB_HOURLY_CACHE_KEY = "echoops-github-hourly-cache-v1";

function readGitHubHourlyCache(): GitHubHourlyCache | null {
  if (typeof window === "undefined" || !("localStorage" in window)) return null;
  try {
    return JSON.parse(window.localStorage.getItem(GITHUB_HOURLY_CACHE_KEY) || "null") as GitHubHourlyCache | null;
  } catch (error) {
    return null;
  }
}

function timestampAgeHours(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

function compactDetail(value: string, fallback: string): string {
  const text = value.trim() || fallback;
  return text.length > 150 ? `${text.slice(0, 147).trim()}...` : text;
}

function snapshotToStatus(definition: SnapshotDefinition, payload: SnapshotPayload): IntegrationStatus {
  let source = String(payload.source || "generated snapshot");
  let updatedAt = payload.lastGoodAt || payload.generatedAt || null;
  const statText = (payload.stats || [])
    .map((item) => [item.label, item.value, item.note].filter(Boolean).join(" "))
    .join(" ");
  const statusText = [payload.status, statText].filter(Boolean).join(" ");
  const needsSetup = SETUP_PATTERN.test(statusText);
  const fallbackSource = /fallback/i.test(source);
  const ageHours = timestampAgeHours(updatedAt);

  let state: IntegrationState = "live";
  if (needsSetup) state = "partial";
  else if (payload.stale || fallbackSource || ageHours === null || ageHours > 48) state = "cached";

  let detail = payload.status || `${definition.label} snapshot loaded successfully.`;
  if (definition.id === "steam" && needsSetup) {
    detail = "Steam Store data is available; private profile activity still needs its configured API key.";
  }
  if (definition.id === "github") {
    const hourlyCache = readGitHubHourlyCache();
    const hourlyCacheCurrent = Number(hourlyCache?.nextCheckAt || 0) > Date.now();
    if (hourlyCacheCurrent && hourlyCache?.status === "live") {
      const repositoryCount = Array.isArray(hourlyCache.repositories) ? hourlyCache.repositories.length : 0;
      state = "live";
      source = "hourly public GitHub API + Actions snapshot";
      updatedAt = hourlyCache.checkedAt ? new Date(hourlyCache.checkedAt).toISOString() : updatedAt;
      detail = `${repositoryCount} public repositories checked without a browser token. The Actions snapshot remains the primary fallback.`;
    } else if (hourlyCacheCurrent && hourlyCache?.status === "error") {
      state = "cached";
      source = "GitHub Actions snapshot";
      detail = "The hourly public API check could not refresh, so the last good Actions snapshot remains active.";
    }
  }

  return {
    id: definition.id,
    label: definition.label,
    state,
    source,
    updatedAt,
    detail: compactDetail(detail, `${definition.label} snapshot loaded.`)
  };
}

async function loadSnapshot(definition: SnapshotDefinition, signal: AbortSignal): Promise<IntegrationStatus> {
  try {
    const response = await fetch(definition.path, {
      cache: "no-store",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return snapshotToStatus(definition, (await response.json()) as SnapshotPayload);
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      id: definition.id,
      label: definition.label,
      state: "offline",
      source: "unavailable",
      updatedAt: null,
      detail: "The latest local snapshot could not be read. The rest of the portfolio remains available."
    };
  }
}

export function createCheckingStatuses(): IntegrationStatus[] {
  return SNAPSHOT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    state: "checking" as const,
    source: "checking snapshot",
    updatedAt: null,
    detail: "Checking the latest public status..."
  }));
}

export async function loadIntegrationStatuses(signal: AbortSignal): Promise<IntegrationStatus[]> {
  return Promise.all(SNAPSHOT_DEFINITIONS.map((definition) => loadSnapshot(definition, signal)));
}

function providerStatus(value: unknown): ProviderStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim().slice(0, 80) : "";
  const label = typeof item.label === "string" ? item.label.trim().slice(0, 100) : "";
  const role = typeof item.role === "string" ? item.role.trim().slice(0, 160) : "";
  const coverage = ["external", "snapshot", "browser", "setup"].includes(String(item.coverage))
    ? item.coverage as ProviderCoverage
    : "browser";
  const status = ["up", "degraded", "down", "unknown"].includes(String(item.status))
    ? item.status as ProviderState
    : "unknown";
  const source = typeof item.source === "string" ? item.source.trim().slice(0, 180) : "Status source unavailable";
  const checkedAt = typeof item.checkedAt === "string" && item.checkedAt.trim() ? item.checkedAt : null;
  const statusUrl = typeof item.statusUrl === "string" && /^https:\/\/apistatuscheck\.com\//.test(item.statusUrl)
    ? item.statusUrl
    : "";
  return id && label ? { id, label, role, coverage, status, source, checkedAt, statusUrl } : null;
}

export async function loadProviderStatuses(signal: AbortSignal): Promise<ProviderStatus[]> {
  try {
    const response = await fetch("data/api-status.json", {
      cache: "no-store",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as ProviderSnapshotPayload;
    return Array.isArray(payload.providers)
      ? payload.providers.flatMap((item) => providerStatus(item) || [])
      : [];
  } catch (error) {
    if (signal.aborted) throw error;
    return [];
  }
}

export function formatRelativeTime(value: string | null): string {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Timestamp unavailable";

  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en-AU", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
