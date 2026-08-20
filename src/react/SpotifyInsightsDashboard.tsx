import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AudioLines, CalendarDays, Clock3, Disc3, LibraryBig, ListMusic, Sparkles } from "lucide-react";
import { IslandBoundary } from "./IslandBoundary";
import { SpotifyWrappedScene } from "./SpotifyWrappedScene";
import type { SpotifyArchiveData, SpotifyData, SpotifyItem, SpotifyWeeklySnapshot } from "./portfolio-types";
import { getPortfolioConfig } from "./portfolio-types";

type ViewId = "taste" | "timeline" | "analytics" | "discovery";
const views: Array<{ id: ViewId; label: string; icon: typeof Disc3 }> = [
  { id: "taste", label: "Taste", icon: Disc3 },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "analytics", label: "Library", icon: LibraryBig },
  { id: "discovery", label: "Moments", icon: CalendarDays }
];
const fallback = getPortfolioConfig().spotify || {};
const chapterCopy: Record<ViewId, { number: string; kicker: string; title: string; note: string }> = {
  taste: { number: "01", kicker: "Sound DNA", title: "Your sound has a shape.", note: "Artists and tracks, ranked across the time ranges that matter." },
  timeline: { number: "02", kicker: "Replay trail", title: "Every listen leaves a signal.", note: "A chronological pulse of the songs, artists, and contexts behind each play." },
  analytics: { number: "03", kicker: "Library gravity", title: "Your saved sound has weight.", note: "Public playlists, library totals, recurring artists, genres, and release eras." },
  discovery: { number: "04", kicker: "Sound Capsule", title: "The year left a trail.", note: "A private archive, reduced to public moments, rhythm, and a Wrapped year in sound." }
};

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

function mergeArchive(data: SpotifyData, archive?: SpotifyArchiveData | null): SpotifyData {
  const latest = (archive?.snapshots || []).slice().sort((a, b) => String(b.periodEnd || "").localeCompare(String(a.periodEnd || "")))[0];
  const archiveData = archive?.archive;
  if (!latest && !archiveData) return data;
  const insights = data.insights || {};
  const taste = insights.taste || {};
  const shortTerm = taste.shortTerm || {};
  const useArchiveRankings = insights.scopesReady !== true;
  return {
    ...data,
    listeningAge: archiveData?.wrapped?.listeningAge
      ? { value: archiveData.wrapped.listeningAge, source: "Spotify Wrapped archive", note: "Based on Spotify's listening-age summary." }
      : data.listeningAge,
    insights: {
      ...insights,
      weeklySnapshot: useArchiveRankings && latest ? latest : insights.weeklySnapshot,
      recentlyPlayed: insights.recentlyPlayed?.length ? insights.recentlyPlayed : archiveData?.recentlyPlayed,
      playlistAnalytics: insights.playlistAnalytics?.sampledTracks
        ? insights.playlistAnalytics
        : {
            ...insights.playlistAnalytics,
            playlistCount: archiveData?.playlists?.count,
            trackCount: archiveData?.playlists?.tracks
          },
      taste: {
        ...taste,
        shortTerm: {
          ...shortTerm,
          artists: useArchiveRankings || !shortTerm.artists?.length ? archiveData?.taste?.topArtists || latest?.topArtists || [] : shortTerm.artists,
          tracks: useArchiveRankings || !shortTerm.tracks?.length ? archiveData?.taste?.topTracks || latest?.topTracks || [] : shortTerm.tracks
        }
      }
    }
  };
}

async function fetchFirst<T>(paths: string[], signal: AbortSignal): Promise<T | null> {
  for (const path of paths) {
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-cache", credentials: path.startsWith("http") ? "omit" : "same-origin", referrerPolicy: "no-referrer", signal });
      if (response.ok) return await response.json() as T;
    } catch {
      if (signal.aborted) return null;
    }
  }
  return null;
}

function formatTime(value?: string): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" })
    : "Recently played";
}

function cleanInsightCopy(value?: string): string {
  return String(value || "").replace(/\*\*/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function capsuleTitle(value?: string): string {
  const normalized = cleanInsightCopy(value).toUpperCase();
  const labels: Record<string, string> = {
    "PROPORTION LISTENING ENTITY": "Listening milestone",
    "UNLIKE COMBINATION": "Unexpected combination",
    MILESTONE: "Listening milestone",
    STREAKS: "Listening streak",
    "FIRST TO DISCOVER": "Early discovery"
  };
  return labels[normalized] || cleanInsightCopy(value) || "Sound Capsule moment";
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

function TasteView({ data, archive }: { data: SpotifyData; archive?: SpotifyArchiveData | null }) {
  const [range, setRange] = useState("shortTerm");
  const taste = data.insights?.taste || {};
  const selected = taste[range] || taste.mediumTerm || taste.longTerm || {};
  const artists = selected.artists || [];
  const tracks = selected.tracks || [];
  const listeningAge = data.listeningAge;
  const archiveTaste = archive?.archive?.taste;
  const weekly = data.insights?.weeklySnapshot as SpotifyWeeklySnapshot | undefined;
  const weeklyNote = weekly && range === "shortTerm" ? `${weekly.periodLabel || "Latest weekly snapshot"} · ${Number(weekly.minutes || 0).toLocaleString("en-AU")} minutes` : "Spotify listening data";
  return <><div className="spotify-listening-age"><span className="spotify-age-icon"><AudioLines aria-hidden="true" /></span><span className="spotify-age-copy"><small>{listeningAge?.source || "Listening profile"}</small><strong>Listening age <b>{Number(listeningAge?.value || 22)}</b></strong><p>{listeningAge?.note || "A personal estimate that can be refined when Spotify archive history is available."}</p></span><span className="spotify-age-signal" aria-hidden="true"><i /><i /><i /><i /><i /></span></div>{(archiveTaste?.musicalIdentity || archiveTaste?.contentRhythms) && <div className="spotify-taste-profile"><article><span>Alvis's music taste</span><p>{cleanInsightCopy(archiveTaste.musicalIdentity)}</p></article><article><span>Alvis's listening rhythm</span><p>{cleanInsightCopy(archiveTaste.contentRhythms)}</p></article></div>}<div className="insight-view-grid"><div><div className="insight-subhead"><span>Top artists</span><div className="insight-segments" aria-label="Taste time range">{[["shortTerm", "4W"], ["mediumTerm", "6M"], ["longTerm", "All"]].map(([id, label]) => <button key={id} type="button" className={range === id ? "is-active" : ""} onClick={() => setRange(id)}>{label}</button>)}</div></div><MiniList items={artists} empty="Top artists need renewed Spotify listening-history access." /></div><div><div className="insight-subhead"><span>Top tracks</span><small>{weeklyNote}</small></div><MiniList items={tracks} empty="Top tracks need renewed Spotify listening-history access." />{weekly?.sourceUrl && range === "shortTerm" ? <a className="spotify-weekly-source" href={weekly.sourceUrl} target="_blank" rel="noopener noreferrer">Official weekly Spotify snapshot</a> : null}</div></div></>;
}

function TimelineView({ data, archive }: { data: SpotifyData; archive?: SpotifyArchiveData | null }) {
  const isUsefulTrack = (item?: SpotifyItem) => Boolean(item?.title && !/nothing playing|not connected yet/i.test(item.title));
  const liveRecent = (data.insights?.recentlyPlayed || []).filter(isUsefulTrack);
  const archiveRecent = (archive?.archive?.recentlyPlayed || []).filter(isUsefulTrack);
  const recent = liveRecent.length ? liveRecent : archiveRecent;
  const source = liveRecent.length ? "Spotify playback history" : "Curated archive replay";

  return <div className={`timeline-view${recent.length ? "" : " is-empty"}`}><div className="insight-subhead"><span>Recently played songs</span><small>{source}</small></div>{recent.length ? <div className="listening-timeline">{recent.slice(0, 10).map((item, index) => <a href={item.url || "#spotify"} target={item.url ? "_blank" : undefined} rel={item.url ? "noopener noreferrer" : undefined} key={`${item.id || item.title}-${item.playedAt || index}`}><Art item={item} /><span className="timeline-copy"><strong>{item.title || item.name || "Spotify track"}</strong><small className="timeline-artist">{item.artists?.join(", ") || item.meta || "Spotify artist"}</small><small className="timeline-context">{item.contextType || "Album"}: {item.contextTitle || item.albumTitle || "Context unavailable"}</small></span><time>{formatTime(item.playedAt)}</time></a>)}</div> : <div className="timeline-empty"><Clock3 aria-hidden="true" /><span><strong>Recent listening is waiting for Spotify history access.</strong><small>The connected account returned no recently played songs during the latest refresh.</small></span></div>}</div>;
}

function AnalyticsView({ data, archive }: { data: SpotifyData; archive?: SpotifyArchiveData | null }) {
  const analytics = data.insights?.playlistAnalytics || {};
  const archiveData = archive?.archive;
  const playlistCount = analytics.playlistCount ?? archiveData?.playlists?.count ?? data.playlists?.length ?? 0;
  const trackCount = analytics.trackCount ?? archiveData?.playlists?.tracks ?? (data.playlists || []).reduce((sum, item) => sum + Number(String(item.meta || "").match(/\d+/)?.[0] || 0), 0);
  const savedTracks = archiveData?.library?.savedTracks || 0;
  const savedArtists = archiveData?.library?.savedArtists || 0;
  return <><div className="insight-stat-row"><div><strong>{playlistCount.toLocaleString("en-AU")}</strong><span>public playlists</span></div><div><strong>{trackCount.toLocaleString("en-AU")}</strong><span>listed tracks</span></div><div><strong>{savedTracks.toLocaleString("en-AU")}</strong><span>saved tracks</span></div></div><div className="spotify-library-strip"><ListMusic aria-hidden="true" /><span><b>{savedArtists.toLocaleString("en-AU")} saved artists</b><small>Library totals are published as counts only.</small></span><span><b>{Number(archiveData?.podcasts?.hours || 0).toLocaleString("en-AU", { maximumFractionDigits: 2 })} hrs</b><small>podcast listening</small></span></div><div className="insight-view-grid"><div><div className="insight-subhead"><span>Recurring artists</span><small>sampled playlists</small></div><MiniList items={analytics.recurringArtists || archiveData?.taste?.topArtists || []} empty="Artist frequency will appear after playlist sampling." /></div><div className="insight-split-meters"><div><div className="insight-subhead"><span>Genres</span></div><MeterList items={analytics.genres || []} /></div><div><div className="insight-subhead"><span>Release decades</span></div><MeterList items={analytics.decades || []} /></div></div></div></>;
}

function MomentsView({ archive }: { archive?: SpotifyArchiveData | null }) {
  const archiveData = archive?.archive;
  const wrapped = archiveData?.wrapped;
  const heatmap = archiveData?.heatmap;
  const moments = archiveData?.soundCapsule || [];
  const max = Math.max(1, Number(heatmap?.maxMinutes || 0));
  return <div className="spotify-moments"><div className="spotify-wrapped-year"><div><span>Spotify Wrapped</span><strong>{wrapped?.year || "Archive"}</strong><small>{Number(wrapped?.minutes || 0).toLocaleString("en-AU")} minutes listened</small></div><div className="spotify-wrapped-metrics"><span><b>{Number(wrapped?.uniqueArtists || 0).toLocaleString("en-AU")}</b> artists</span><span><b>{Number(wrapped?.uniqueTracks || 0).toLocaleString("en-AU")}</b> tracks</span><span><b>{Number(wrapped?.uniqueGenres || 0).toLocaleString("en-AU")}</b> genres</span></div></div><div className="spotify-heatmap-wrap"><div className="insight-subhead"><span>Listening hour / day</span><small>archive playtime intensity</small></div>{heatmap?.cells?.length ? <div className="spotify-heatmap" style={{ gridTemplateColumns: `54px repeat(${heatmap.hours?.length || 24}, minmax(10px, 1fr))` }}><span className="spotify-heatmap-corner" />{heatmap.hours?.map((hour) => <span key={hour} className="spotify-heatmap-hour">{hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}{heatmap.cells.map((day, dayIndex) => <>{<span className="spotify-heatmap-day" key={`day-${dayIndex}`}>{heatmap.labels?.[dayIndex]}</span>}{day.map((minutes, hour) => <span key={`${dayIndex}-${hour}`} className="spotify-heatmap-cell" style={{ "--heat": Math.max(0.08, minutes / max) } as React.CSSProperties} title={`${heatmap.labels?.[dayIndex]} ${String(hour).padStart(2, "0")}:00 - ${minutes} minutes`} />)}</>)}</div> : <p className="insight-empty">Listening rhythm will appear after the archive snapshot is refreshed.</p>}</div><div className="spotify-capsule"><div className="insight-subhead"><span>Sound Capsule highlights</span><small>{moments.length} saved moments</small></div><div className="spotify-capsule-list">{moments.map((moment, index) => <article key={moment.id || `${moment.date}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{capsuleTitle(moment.title)}</strong><small>{moment.note || "Spotify Sound Capsule highlight"}</small></div><time>{moment.date}</time></article>)}</div></div></div>;
}

function SpotifyInsightsDashboard() {
  const [data, setData] = useState<SpotifyData>(fallback);
  const [archive, setArchive] = useState<SpotifyArchiveData | null>(null);
  const [active, setActive] = useState<ViewId>("taste");
  useEffect(() => {
    const controller = new AbortController();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const livePaths = isLocal
      ? ["https://silvaops-orbit.github.io/online-portfolio/data/spotify.json", "data/spotify.json"]
      : ["data/spotify.json"];
    const archivePaths = isLocal
      ? ["data/spotify-history.json", "https://silvaops-orbit.github.io/online-portfolio/data/spotify-history.json"]
      : ["data/spotify-history.json"];
    const loadSnapshot = async () => {
      const [live, archive] = await Promise.all([
        fetchFirst<SpotifyData>(livePaths, controller.signal),
        fetchFirst<SpotifyArchiveData>(archivePaths, controller.signal)
      ]);
      if (controller.signal.aborted) return;
      setArchive(archive);
      setData(mergeArchive(mergeData(fallback, live), archive));
      if (!live && !archive) console.warn("Spotify live and archive snapshots unavailable");
    };
    void loadSnapshot();
    return () => controller.abort();
  }, []);
  const panel = useMemo(() => active === "taste" ? <TasteView data={data} archive={archive} /> : active === "timeline" ? <TimelineView data={data} archive={archive} /> : active === "analytics" ? <AnalyticsView data={data} archive={archive} /> : <MomentsView archive={archive} />, [active, archive, data]);
  const panelClass = `insight-panel${active === "timeline" ? " spotify-timeline-panel" : ""}${active === "taste" && !data.insights?.scopesReady ? " spotify-taste-panel is-empty" : ""}`;
  const chapter = chapterCopy[active];
  return <section className={`insight-deck spotify-insight-deck spotify-wrapped spotify-wrapped-${active}`} data-view={active} aria-labelledby="spotify-insights-title"><SpotifyWrappedScene view={active} /><div className="spotify-wrapped-grid" aria-hidden="true" /><div className="spotify-wrapped-content"><div className="insight-deck-heading spotify-wrapped-heading"><div><span className="spotify-label"><Sparkles aria-hidden="true" /> Music intelligence</span><div className="spotify-chapter-mark"><b>{chapter.number}</b><span>{chapter.kicker}</span></div><h3 id="spotify-insights-title">{chapter.title}</h3><p>{chapter.note}</p></div><span className="spotify-signal-badge"><i /> Live + cached signal</span></div><div className="insight-tabs" role="tablist" aria-label="Spotify insight views">{views.map(({ id, label, icon: Icon }, index) => <button id={`spotify-insight-tab-${id}`} key={id} type="button" role="tab" aria-controls="spotify-insight-panel" aria-selected={active === id} className={active === id ? "is-active" : ""} onClick={() => setActive(id)}><small>0{index + 1}</small><Icon aria-hidden="true" /><span>{label}</span></button>)}</div><div id="spotify-insight-panel" className={panelClass} role="tabpanel" aria-labelledby={`spotify-insight-tab-${active}`} key={active}>{panel}</div></div></section>;
}

export function mountSpotifyInsightsDashboard(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Spotify insights dashboard"><SpotifyInsightsDashboard /></IslandBoundary></StrictMode>);
}
