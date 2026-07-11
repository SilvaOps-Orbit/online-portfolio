export type IntegrationState = "checking" | "live" | "cached" | "partial" | "offline";

export interface IntegrationStatus {
  id: string;
  label: string;
  state: IntegrationState;
  source: string;
  updatedAt: string | null;
  detail: string;
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

const SNAPSHOT_DEFINITIONS: SnapshotDefinition[] = [
  { id: "steam", label: "Steam", path: "data/steam.json" },
  { id: "spotify", label: "Spotify", path: "data/spotify.json" },
  { id: "market", label: "Markets", path: "data/market.json" },
  { id: "news", label: "News", path: "data/news.json" },
  { id: "github", label: "GitHub", path: "data/github.json" }
];

const SETUP_PATTERN = /needs? key|add .*secret|not connected|ready for api secrets/i;

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
  const source = String(payload.source || "generated snapshot");
  const updatedAt = payload.lastGoodAt || payload.generatedAt || null;
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
