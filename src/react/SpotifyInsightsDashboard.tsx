import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Clock3, Compass, Disc3, ListMusic, Radar, Sparkles } from "lucide-react";
import { IslandBoundary } from "./IslandBoundary";
import type { SpotifyData, SpotifyItem } from "./portfolio-types";
import { getPortfolioConfig } from "./portfolio-types";

type ViewId = "taste" | "timeline" | "analytics" | "discovery";
const views: Array<{ id: ViewId; label: string; icon: typeof Disc3 }> = [
  { id: "taste", label: "Taste", icon: Disc3 },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "analytics", label: "Playlists", icon: ListMusic },
  { id: "discovery", label: "Discover", icon: Radar }
];
const fallback = getPortfolioConfig().spotify || {};

function mergeData(base: SpotifyData, live?: SpotifyData | null): SpotifyData {
  if (!live) return base;
  return {
    ...base,
    ...live,
    profile: { ...(base.profile || {}), ...(live.profile || {}) },
    insights: { ...(base.insights || {}), ...(live.insights || {}) },
    playlists: live.playlists?.length ? live.playlists : base.playlists
  };
}

function formatTime(value?: string): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" })
    : "Recently played";
}

function Art({ item, fallbackText = "SP" }: { item: SpotifyItem; fallbackText?: string }) {
  return item.image
    ? <img className="insight-art" src={item.image} alt={`${item.title || item.name || "Music"} artwork`} loading="lazy" decoding="async" />
    : <span className="insight-art insight-art-fallback" aria-hidden="true">{fallbackText}</span>;
}

function MiniList({ items, empty }: { items: SpotifyItem[]; empty: string }) {
  if (!items.length) return <p className="insight-empty">{empty}</p>;
  return <ol className="insight-mini-list">{items.slice(0, 5).map((item, index) => <li key={item.id || `${item.title}-${index}`}><span className="insight-rank">{String(index + 1).padStart(2, "0")}</span><Art item={item} /><span><strong>{item.title || item.name}</strong><small>{item.meta || item.artists?.join(", ") || item.note || "Spotify"}</small></span></li>)}</ol>;
}

function MeterList({ items }: { items: Array<{ label?: string; value?: number }> }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return <div className="insight-meter-list">{items.slice(0, 6).map((item) => <div key={item.label}><span><b>{item.label}</b><small>{Number(item.value || 0).toLocaleString("en-AU")}</small></span><i><em style={{ width: `${Math.max(7, Number(item.value || 0) / max * 100)}%` }} /></i></div>)}</div>;
}

function TasteView({ data }: { data: SpotifyData }) {
  const [range, setRange] = useState("shortTerm");
  const taste = data.insights?.taste || {};
  const selected = taste[range] || taste.mediumTerm || taste.longTerm || {};
  const playlists = data.playlists || [];
  const artists = selected.artists?.length ? selected.artists : playlists.slice(0, 5).map((item) => ({ ...item, meta: "Playlist signal" }));
  const tracks = selected.tracks?.length ? selected.tracks : playlists.slice(5, 10).map((item) => ({ ...item, meta: "Playlist signal" }));
  return <div className="insight-view-grid"><div><div className="insight-subhead"><span>Top artists</span><div className="insight-segments" aria-label="Taste time range">{[["shortTerm", "4W"], ["mediumTerm", "6M"], ["longTerm", "All"]].map(([id, label]) => <button key={id} type="button" className={range === id ? "is-active" : ""} onClick={() => setRange(id)}>{label}</button>)}</div></div><MiniList items={artists} empty="Top artists will appear after the next scoped Spotify refresh." /></div><div><div className="insight-subhead"><span>Top tracks</span><small>{data.insights?.scopesReady ? "Spotify history" : "Playlist fallback"}</small></div><MiniList items={tracks} empty="Top tracks will appear after the next scoped Spotify refresh." /></div></div>;
}

function TimelineView({ data }: { data: SpotifyData }) {
  const isUsefulTrack = (item?: SpotifyItem) => Boolean(item?.title && !/nothing playing|not connected yet/i.test(item.title));
  const recent = (data.insights?.recentlyPlayed || []).filter(isUsefulTrack);

  return <div className={`timeline-view${recent.length ? "" : " is-empty"}`}><div className="insight-subhead"><span>Recently played songs</span><small>Spotify playback history</small></div>{recent.length ? <div className="listening-timeline">{recent.slice(0, 10).map((item, index) => <a href={item.url || "#spotify"} target={item.url ? "_blank" : undefined} rel={item.url ? "noopener noreferrer" : undefined} key={`${item.id || item.title}-${item.playedAt || index}`}><Art item={item} /><span className="timeline-copy"><strong>{item.title || item.name || "Spotify track"}</strong><small className="timeline-artist">{item.artists?.join(", ") || item.meta || "Spotify artist"}</small><small className="timeline-context">{item.contextType || "Album"}: {item.contextTitle || item.albumTitle || "Context unavailable"}</small></span><time>{formatTime(item.playedAt)}</time></a>)}</div> : <div className="timeline-empty"><Clock3 aria-hidden="true" /><span><strong>Recent listening is waiting for Spotify history access.</strong><small>The connected account returned no recently played songs during the latest refresh.</small></span></div>}</div>;
}

function AnalyticsView({ data }: { data: SpotifyData }) {
  const analytics = data.insights?.playlistAnalytics || {};
  const playlistCount = analytics.playlistCount ?? data.playlists?.length ?? 0;
  const trackCount = analytics.trackCount ?? (data.playlists || []).reduce((sum, item) => sum + Number(String(item.meta || "").match(/\d+/)?.[0] || 0), 0);
  return <><div className="insight-stat-row"><div><strong>{playlistCount.toLocaleString("en-AU")}</strong><span>public playlists</span></div><div><strong>{trackCount.toLocaleString("en-AU")}</strong><span>listed tracks</span></div><div><strong>{Number(analytics.estimatedHours || 0).toLocaleString("en-AU", { maximumFractionDigits: 1 })}</strong><span>estimated hours</span></div></div><div className="insight-view-grid"><div><div className="insight-subhead"><span>Recurring artists</span><small>sampled playlists</small></div><MiniList items={analytics.recurringArtists || []} empty="Artist frequency will appear after playlist sampling." /></div><div className="insight-split-meters"><div><div className="insight-subhead"><span>Genres</span></div><MeterList items={analytics.genres || []} /></div><div><div className="insight-subhead"><span>Release decades</span></div><MeterList items={analytics.decades || []} /></div></div></div></>;
}

function DiscoveryView({ data }: { data: SpotifyData }) {
  const discovery = data.insights?.discovery || [];
  return <div className="discovery-radar"><div className="discovery-orbit" aria-hidden="true"><Compass /><i /><i /><i /></div><div><div className="insight-subhead"><span>Release radar</span><small>artists already in your orbit</small></div><div className="discovery-grid">{discovery.slice(0, 6).map((item, index) => <a href={item.url || "#spotify"} target={item.url ? "_blank" : undefined} rel={item.url ? "noopener noreferrer" : undefined} key={`${item.id || item.title}-${index}`}><Art item={item} /><span><strong>{item.title || item.name}</strong><small>{item.meta || item.releaseDate || "Spotify release"}</small></span></a>)}{!discovery.length && <p className="insight-empty">Discovery Radar will use your top artists after the next scoped refresh.</p>}</div></div></div>;
}

function SpotifyInsightsDashboard() {
  const [data, setData] = useState<SpotifyData>(fallback);
  const [active, setActive] = useState<ViewId>("taste");
  useEffect(() => {
    const controller = new AbortController();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const paths = isLocal
      ? ["https://silvaops-orbit.github.io/online-portfolio/data/spotify.json", "data/spotify.json"]
      : ["data/spotify.json"];
    const loadSnapshot = async () => {
      for (const path of paths) {
        try {
          const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-cache", credentials: path.startsWith("http") ? "omit" : "same-origin", referrerPolicy: "no-referrer", signal: controller.signal });
          if (!response.ok) continue;
          setData(mergeData(fallback, await response.json() as SpotifyData));
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
        }
      }
      console.warn("Spotify insights snapshot unavailable");
    };
    void loadSnapshot();
    return () => controller.abort();
  }, []);
  const panel = useMemo(() => active === "taste" ? <TasteView data={data} /> : active === "timeline" ? <TimelineView data={data} /> : active === "analytics" ? <AnalyticsView data={data} /> : <DiscoveryView data={data} />, [active, data]);
  return <section className="insight-deck spotify-insight-deck" aria-labelledby="spotify-insights-title"><div className="insight-deck-heading"><div><span className="spotify-label"><Sparkles aria-hidden="true" /> Music intelligence</span><h3 id="spotify-insights-title">Inside the listening signal</h3><p>Four compact views, one stable panel. Live Spotify data when available, saved snapshot between refreshes.</p></div></div><div className="insight-tabs" role="tablist" aria-label="Spotify insight views">{views.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? "is-active" : ""} onClick={() => setActive(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}</div><div className={`insight-panel${active === "timeline" ? " spotify-timeline-panel" : ""}`} role="tabpanel" key={active}>{panel}</div></section>;
}

export function mountSpotifyInsightsDashboard(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Spotify insights dashboard"><SpotifyInsightsDashboard /></IslandBoundary></StrictMode>);
}
