import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";
import {
  analyticsEndpoint,
  analyticsUpdatedEvent,
  fetchAnalyticsStats,
  readCachedAnalyticsStats,
  type AnalyticsBreakdown,
  type AnalyticsStats
} from "./analytics-client";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No timestamp"
    : date.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function Breakdown({ title, items }: { title: string; items: AnalyticsBreakdown[] }) {
  return (
    <section className="visitor-breakdown" aria-label={title}>
      <h5>{title}</h5>
      <div className="visitor-breakdown-list">
        {items.length ? items.map((item) => (
          <div className="visitor-breakdown-row" key={item.label}>
            <div><strong>{item.label}</strong><span>{item.count.toLocaleString("en-AU")} browsers</span></div>
            <div className="visitor-breakdown-track" role="progressbar" aria-label={`${item.label}: ${item.percent.toFixed(1)} percent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.percent)}>
              <span style={{ width: `${Math.max(2, Math.min(100, item.percent))}%` }} />
            </div>
            <b>{item.percent.toFixed(1)}%</b>
          </div>
        )) : <p className="visitor-empty">No aggregate data yet.</p>}
      </div>
    </section>
  );
}

function VisitorInsights() {
  const endpoint = analyticsEndpoint();
  const [stats, setStats] = useState<AnalyticsStats | null>(readCachedAnalyticsStats);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!endpoint) return;
    const receive = (event: Event) => {
      setStats((event as CustomEvent<AnalyticsStats>).detail);
      setLive(true);
      setLoading(false);
    };
    document.addEventListener(analyticsUpdatedEvent, receive);
    void fetchAnalyticsStats().then((value) => {
      if (value) { setStats(value); setLive(true); }
      setLoading(false);
    });
    const refreshMs = Math.max(60_000, Number(window.PORTFOLIO_CONFIG?.analytics?.refreshMs || 120_000));
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchAnalyticsStats();
    }, refreshMs);
    return () => {
      document.removeEventListener(analyticsUpdatedEvent, receive);
      window.clearInterval(timer);
    };
  }, [endpoint]);

  if (!endpoint) {
    return (
      <section className="visitor-insights is-setup" aria-labelledby="visitor-insights-title">
        <div className="visitor-insights-header">
          <div><span className="react-api-tech-label">React + TypeScript + D1</span><h4 id="visitor-insights-title">Anonymous site reach</h4></div>
          <span className="visitor-live-state is-pending">Setup pending</span>
        </div>
        <p className="visitor-setup-copy">The dashboard and private analytics backend are ready. Add the deployed Worker URL to <code>analytics.endpoint</code> in <code>portfolio.config.js</code> to begin collecting aggregate counts.</p>
        <p className="visitor-privacy-note">It counts unique browsers, not verified people. No raw IP address, full user-agent string, cookies, or fingerprinting profile is stored.</p>
      </section>
    );
  }

  return (
    <section className="visitor-insights" aria-labelledby="visitor-insights-title" aria-busy={loading}>
      <div className="visitor-insights-header">
        <div><span className="react-api-tech-label">React + TypeScript + D1</span><h4 id="visitor-insights-title">Anonymous site reach</h4><p>{loading && !stats ? "Loading aggregate audience data..." : "Privacy-preserving totals from the portfolio analytics Worker."}</p></div>
        <span className={`visitor-live-state${live ? " is-live" : " is-cached"}`}>{live ? "Live aggregate" : "Last saved"}</span>
      </div>
      {stats ? (
        <>
          <div className="visitor-metric-grid">
            <article><span>Unique browsers</span><strong>{stats.uniqueVisitors.toLocaleString("en-AU")}</strong><small>Anonymous local IDs</small></article>
            <article><span>Daily visits</span><strong>{stats.totalViews.toLocaleString("en-AU")}</strong><small>One per browser each day</small></article>
            <article className="is-discovery"><span>Easter egg finders</span><strong>{stats.easterEggFinders.toLocaleString("en-AU")}</strong><small>Found at least one</small></article>
            <article className="is-mastery"><span>Vault completions</span><strong>{stats.vaultCompletions.toLocaleString("en-AU")}</strong><small>Found all three</small></article>
          </div>
          <div className="visitor-breakdown-grid"><Breakdown title="Device mix" items={stats.devices} /><Breakdown title="Browser mix" items={stats.browsers} /></div>
          <div className="visitor-achievement-strip" aria-label="Easter egg discovery totals">
            {stats.achievements.map((item) => <span key={item.id}><b>{item.count.toLocaleString("en-AU")}</b>{item.label}</span>)}
          </div>
          <p className="visitor-insights-footer">Updated {formatUpdatedAt(stats.updatedAt)}. Clearing site storage or using another browser creates a new anonymous browser count, so this is not an exact count of human beings.</p>
        </>
      ) : <div className="react-api-status-fallback is-error" role="status">The analytics service is temporarily unavailable and no last-good aggregate is saved on this browser yet.</div>}
      <p className="visitor-privacy-note">Only coarse browser and device categories are sent. The server stores a secret-peppered SHA-256 identifier and aggregate discovery state, never the raw browser identifier.</p>
    </section>
  );
}

export function mountVisitorInsights(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Visitor insights"><VisitorInsights /></IslandBoundary></StrictMode>);
}
