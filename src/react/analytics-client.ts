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
}

interface AnalyticsResponse {
  stats: AnalyticsStats;
}

interface AchievementState {
  unlocks?: Record<string, string>;
}

const VISITOR_KEY = "echoops-anonymous-browser-v1";
const STATS_CACHE_KEY = "echoops-analytics-stats-v1";
const ACHIEVEMENT_KEY = "echoops-technical-achievements-v1";
const ANALYTICS_EVENT = "echoops:analytics-updated";
const ALLOWED_ACHIEVEMENTS = new Set(["console", "integrity", "architecture"]);
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
  return {
    visitorId: visitorId(),
    browser: browserCategory(),
    device: deviceCategory()
  };
}

function publishStats(stats: AnalyticsStats) {
  try { localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(stats)); } catch { /* storage is optional */ }
  document.dispatchEvent(new CustomEvent<AnalyticsStats>(ANALYTICS_EVENT, { detail: stats }));
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
    const data = await response.json() as AnalyticsResponse;
    if (!data?.stats) return null;
    publishStats(data.stats);
    return data.stats;
  } catch (error) {
    console.warn("Anonymous analytics update was unavailable", error);
    return null;
  }
}

async function recordAchievement(id: string) {
  if (!ALLOWED_ACHIEVEMENTS.has(id)) return;
  await analyticsRequest("/api/achievement", { ...clientContext(), achievementId: id });
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
    return value && Number.isFinite(value.uniqueVisitors) ? value : null;
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

  void analyticsRequest("/api/view", clientContext());
  existingAchievementIds().forEach((id) => void recordAchievement(id));
  document.addEventListener("echoops:achievement-unlocked", (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (id) void recordAchievement(id);
  });
}

export const analyticsUpdatedEvent = ANALYTICS_EVENT;
