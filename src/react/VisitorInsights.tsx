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
  const provider = String(window.PORTFOLIO_CONFIG?.analytics?.provider || "Cloudflare Worker + D1");
  const technologyLabel = `React + TypeScript + ${provider}`;
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
          <div><span className="react-api-tech-label">{technologyLabel}</span><h4 id="visitor-insights-title">Anonymous site reach</h4></div>
          <span className="visitor-live-state is-pending">Worker URL needed</span>
        </div>
        <p className="visitor-setup-copy">The dashboard is ready for a private Cloudflare D1 binding. GitHub Pages sends no API key; the Worker validates the site origin and stores only anonymous aggregate fields.</p>
        <div className="visitor-setup-flow" aria-label="Analytics connection status"><span><b>01</b> Browser sends coarse categories</span><span><b>02</b> Worker validates the origin</span><span><b>03</b> D1 records qualified views</span></div>
        <p className="visitor-privacy-note">It counts unique browsers, not verified people. No raw IP address, full user-agent string, cookies, or fingerprinting profile is stored.</p>
      </section>
    );
  }

  const basic = stats?.dataMode === "basic";

  return (
    <section className="visitor-insights" aria-labelledby="visitor-insights-title" aria-busy={loading}>
      <div className="visitor-insights-header">
        <div><span className="react-api-tech-label">{technologyLabel}</span><h4 id="visitor-insights-title">Anonymous site reach</h4><p>{loading && !stats ? "Loading aggregate audience data..." : "Privacy-preserving totals from the portfolio analytics Worker."}</p></div>
        <span className={`visitor-live-state${live ? " is-live" : " is-cached"}`}>{live ? "Live aggregate" : "Last saved"}</span>
      </div>
      {stats ? (
        <>
          {basic ? (
            <div className="visitor-metric-grid">
              <article><span>Page views</span><strong>{stats.totalViews.toLocaleString("en-AU")}</strong><small>{stats.viewProvider}</small></article>
              <article><span>Referrer records</span><strong>{(stats.referrerCount || 0).toLocaleString("en-AU")}</strong><small>Aggregate source entries</small></article>
              <article className="is-discovery"><span>Easter egg unlocks</span><strong>{(stats.easterEggUnlocks || 0).toLocaleString("en-AU")}</strong><small>Recorded discoveries</small></article>
              <article className="is-mastery"><span>Client access</span><strong className="visitor-text-value">No key</strong><small>Public Worker endpoint</small></article>
            </div>
          ) : (
            <div className="visitor-metric-grid">
              <article><span>Unique browsers</span><strong>{stats.uniqueVisitors.toLocaleString("en-AU")}</strong><small>Anonymous local IDs</small></article>
              <article><span>Qualified views</span><strong>{stats.totalViews.toLocaleString("en-AU")}</strong><small>{stats.viewProvider || "One per browser each day"}</small></article>
              <article className="is-discovery"><span>Easter egg finders</span><strong>{stats.easterEggFinders.toLocaleString("en-AU")}</strong><small>Found at least one</small></article>
              <article className="is-mastery"><span>Vault completions</span><strong>{stats.vaultCompletions.toLocaleString("en-AU")}</strong><small>Found all four</small></article>
            </div>
          )}
          {basic ? (
            <p className="visitor-capability-note">The current Worker returns page-view, referrer, and Easter egg totals. Device, browser, and unique-browser cards appear automatically when those aggregate fields are added to its stats response.</p>
          ) : <div className="visitor-breakdown-grid"><Breakdown title="Device mix" items={stats.devices} /><Breakdown title="Browser mix" items={stats.browsers} /></div>}
          <div className="visitor-achievement-strip" aria-label="Easter egg discovery totals">
            {stats.achievements.length
              ? stats.achievements.map((item) => <span key={item.id}><b>{item.count.toLocaleString("en-AU")}</b>{item.label}</span>)
              : <p className="visitor-empty">No Easter egg discoveries recorded yet.</p>}
          </div>
          <p className="visitor-insights-footer">Checked {formatUpdatedAt(stats.updatedAt)}. {basic ? "These are aggregate Worker totals, not a verified count of individual people." : "Clearing site storage or using another browser creates a new anonymous browser count, so this is not an exact count of human beings."}</p>
        </>
      ) : <div className="react-api-status-fallback is-error" role="status">The analytics service is temporarily unavailable and no last-good aggregate is saved on this browser yet.</div>}
      <p className="visitor-privacy-note">The browser sends no API key. It submits the page path, referrer origin, an anonymous local ID, and coarse browser and device categories; the public panel renders only aggregate totals returned by the Worker.</p>
    </section>
  );
}

export function mountVisitorInsights(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Visitor insights"><VisitorInsights /></IslandBoundary></StrictMode>);
}
