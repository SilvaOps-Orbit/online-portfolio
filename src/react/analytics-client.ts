export type DeviceCategory = "Desktop" | "Mobile" | "Tablet" | "Unknown";
export type BrowserCategory = "Chrome" | "Edge" | "Firefox" | "Opera" | "Safari" | "Samsung Internet" | "Other";

export interface AnalyticsBreakdown {
  label: string;
  count: number;
  percent: number;
}

export interface AchievementBreakdown {
  id: string;
  label: string;
  count: number;
}

export interface AnalyticsStats {
  uniqueVisitors: number;
  totalViews: number;
  easterEggFinders: number;
  vaultCompletions: number;
  browsers: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  achievements: AchievementBreakdown[];
  updatedAt: string;
  viewProvider?: string;
  dataMode?: "extended" | "basic";
  referrerCount?: number;
  easterEggUnlocks?: number;
}

interface AchievementState {
  unlocks?: Record<string, string>;
}

const VISITOR_KEY = "echoops-anonymous-browser-v1";
const STATS_CACHE_KEY = "echoops-analytics-stats-v2";
const ACHIEVEMENT_KEY = "echoops-technical-achievements-v1";
const ANALYTICS_EVENT = "echoops:analytics-updated";
const ALLOWED_ACHIEVEMENTS = new Set(["console", "integrity", "architecture", "snake"]);
const ACHIEVEMENT_LABELS = new Map([
  ["console", "Ops Console"],
  ["integrity", "Integrity sequence"],
  ["architecture", "Architecture trace"],
  ["snake", "Snake protocol"]
]);
let initialized = false;

function configuredEndpoint(): string {
  const value = String(window.PORTFOLIO_CONFIG?.analytics?.endpoint || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    const local = ["127.0.0.1", "localhost"].includes(url.hostname);
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.href.replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

function createVisitorId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function visitorId(): string {
  try {
    const current = localStorage.getItem(VISITOR_KEY);
    if (current && /^[a-f0-9-]{32,64}$/i.test(current)) return current;
    const next = createVisitorId();
    localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return createVisitorId();
  }
}

function browserCategory(userAgent = navigator.userAgent): BrowserCategory {
  if (/SamsungBrowser\//i.test(userAgent)) return "Samsung Internet";
  if (/(?:Edg|Edge)\//i.test(userAgent)) return "Edge";
  if (/(?:OPR|Opera)\//i.test(userAgent)) return "Opera";
  if (/(?:Firefox|FxiOS)\//i.test(userAgent)) return "Firefox";
  if (/(?:Chrome|CriOS)\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Other";
}

function deviceCategory(userAgent = navigator.userAgent): DeviceCategory {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return "Tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent)) return "Mobile";
  if (userAgent) return "Desktop";
  return "Unknown";
}

function clientContext() {
  let referrer = "";
  try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch { /* omit malformed referrers */ }
  return {
    visitorId: visitorId(),
    browser: browserCategory(),
    device: deviceCategory(),
    path: location.pathname,
    referrer
  };
}

function publishStats(stats: AnalyticsStats) {
  try { localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(stats)); } catch { /* storage is optional */ }
  document.dispatchEvent(new CustomEvent<AnalyticsStats>(ANALYTICS_EVENT, { detail: stats }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function normalizeBreakdown(value: unknown): AnalyticsBreakdown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = asRecord(entry);
    const label = typeof item?.label === "string" ? item.label.trim() : "";
    if (!item || !label) return [];
    return [{ label, count: safeCount(item.count), percent: safeCount(item.percent) }];
  });
}

function normalizeAchievements(value: unknown): AchievementBreakdown[] {
  const entries = Array.isArray(value)
    ? value
    : asRecord(value)
      ? Object.entries(value as Record<string, unknown>).map(([id, count]) => ({ id, count }))
      : [];

  return entries.flatMap((entry) => {
    if (typeof entry === "string") {
      const id = entry.trim();
      return id ? [{ id, label: ACHIEVEMENT_LABELS.get(id) || id, count: 1 }] : [];
    }
    const item = asRecord(entry);
    if (!item) return [];
    const idValue = item.id ?? item.egg_id ?? item.achievement_id ?? item.name;
    const id = typeof idValue === "string" ? idValue.trim() : "";
    if (!id) return [];
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : ACHIEVEMENT_LABELS.get(id) || id;
    return [{ id, label, count: safeCount(item.count ?? item.total ?? item.unlocks ?? 1) }];
  });
}

function normalizeStats(payload: unknown): AnalyticsStats | null {
  const root = asRecord(payload);
  if (!root) return null;
  const wrapped = asRecord(root.stats);
  const value = wrapped || root;

  if ("totalViews" in value || "uniqueVisitors" in value) {
    const achievements = normalizeAchievements(value.achievements);
    return {
      uniqueVisitors: safeCount(value.uniqueVisitors),
      totalViews: safeCount(value.totalViews),
      easterEggFinders: safeCount(value.easterEggFinders),
      vaultCompletions: safeCount(value.vaultCompletions),
      browsers: normalizeBreakdown(value.browsers),
      devices: normalizeBreakdown(value.devices),
      achievements,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
      viewProvider: typeof value.viewProvider === "string" ? value.viewProvider : "Cloudflare D1",
      dataMode: "extended",
      easterEggUnlocks: achievements.reduce((total, item) => total + item.count, 0)
    };
  }

  const views = asRecord(root.views);
  if (!views) return null;
  const achievements = normalizeAchievements(root.easter_eggs);
  return {
    uniqueVisitors: 0,
    totalViews: safeCount(views.total),
    easterEggFinders: 0,
    vaultCompletions: 0,
    browsers: [],
    devices: [],
    achievements,
    updatedAt: new Date().toISOString(),
    viewProvider: "Cloudflare D1 live totals",
    dataMode: "basic",
    referrerCount: safeCount(views.referrers),
    easterEggUnlocks: achievements.reduce((total, item) => total + item.count, 0)
  };
}

async function analyticsRequest(path: string, body?: Record<string, unknown>): Promise<AnalyticsStats | null> {
  const endpoint = configuredEndpoint();
  if (!endpoint) return null;
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`Analytics endpoint returned ${response.status}`);
    const stats = normalizeStats(await response.json());
    if (!stats) return null;
    publishStats(stats);
    return stats;
  } catch (error) {
    console.warn("Anonymous analytics update was unavailable", error);
    return null;
  }
}

async function recordAchievement(id: string) {
  if (!ALLOWED_ACHIEVEMENTS.has(id)) return;
  await analyticsRequest("/api/easter-egg", {
    ...clientContext(),
    achievementId: id,
    egg_id: id,
    action: "unlocked"
  });
}

function existingAchievementIds(): string[] {
  try {
    const state = JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY) || "null") as AchievementState | null;
    return Object.keys(state?.unlocks || {}).filter((id) => ALLOWED_ACHIEVEMENTS.has(id));
  } catch {
    return [];
  }
}

export function readCachedAnalyticsStats(): AnalyticsStats | null {
  try {
    const value = JSON.parse(localStorage.getItem(STATS_CACHE_KEY) || "null") as AnalyticsStats | null;
    return value && Number.isFinite(value.totalViews) ? value : null;
  } catch {
    return null;
  }
}

export function analyticsEndpoint(): string {
  return configuredEndpoint();
}

export async function fetchAnalyticsStats(): Promise<AnalyticsStats | null> {
  return analyticsRequest("/api/stats");
}

export function initVisitorAnalytics() {
  if (initialized) return;
  initialized = true;
  if (!configuredEndpoint()) return;

  void analyticsRequest("/api/track", clientContext());
  existingAchievementIds().forEach((id) => void recordAchievement(id));
  document.addEventListener("echoops:achievement-unlocked", (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (id) void recordAchievement(id);
  });
}

export const analyticsUpdatedEvent = ANALYTICS_EVENT;
