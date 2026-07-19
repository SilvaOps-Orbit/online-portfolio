import { StrictMode, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { CalendarClock, Clock3, Coins, Dice5, Flame, Gamepad2, Grid3X3, Keyboard, Layers3, LibraryBig, Mouse, Sparkles, TrendingUp, Trophy, WalletCards } from "lucide-react";
import { IslandBoundary } from "./IslandBoundary";
import type { SteamData, SteamItem } from "./portfolio-types";
import { getPortfolioConfig } from "./portfolio-types";

const LIST_INTERVAL = 4800;
const steamFallback = getPortfolioConfig().steam || {};

function mergeSteamData(fallback: SteamData, live?: SteamData | null): SteamData {
  if (!live) return fallback;
  const merged: SteamData = {
    ...fallback,
    ...live,
    profile: { ...(fallback.profile || {}), ...(live.profile || {}) },
    replay: { ...(fallback.replay || {}), ...(live.replay || {}) },
    insights: { ...(fallback.insights || {}), ...(live.insights || {}) },
    accountValue: fallback.accountValue?.manual ? fallback.accountValue : { ...(fallback.accountValue || {}), ...(live.accountValue || {}) }
  };
  (["currentlyPlaying", "mostPlayed", "achievements", "completedGames", "storeHighlights", "preorderWatch", "stats"] as const).forEach((key) => {
    const liveValue = live[key];
    if (!Array.isArray(liveValue) || !liveValue.length) merged[key] = fallback[key] as never;
  });
  return merged;
}

type SteamInsightView = "pulse" | "cabinet" | "playstyle" | "picker";

function InsightMeterList({ items = [] }: { items?: Array<{ label?: string; value?: number; note?: string }> }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return <div className="insight-meter-list">{items.slice(0, 7).map((item) => <div key={item.label}><span><b>{item.label}</b><small>{item.note || Number(item.value || 0).toLocaleString("en-AU")}</small></span><i><em style={{ width: `${Math.max(7, Number(item.value || 0) / max * 100)}%` }} /></i></div>)}</div>;
}

function money(value: number | null | undefined, currency = "AUD"): string {
  if (value === null || value === undefined) return "Not logged";
  if (!Number.isFinite(Number(value))) return "Not logged";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

function GenreFingerprint({ genres = [] }: { genres?: Array<{ label?: string; value?: number }> }) {
  const palette = ["#55d5c4", "#ffbf5a", "#ff5b61", "#5f9cff", "#78d96b", "#d47cff"];
  const visible = genres.slice(0, 6);
  const total = Math.max(1, visible.reduce((sum, genre) => sum + Number(genre.value || 0), 0));
  let cursor = 0;
  const segments = visible.map((genre, index) => {
    const start = cursor;
    cursor += Number(genre.value || 0) / total * 100;
    return `${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  const top = visible[0];
  return <div className="genre-fingerprint"><div className="genre-ring" style={{ "--genre-ring": visible.length ? `conic-gradient(${segments.join(",")})` : "conic-gradient(var(--line) 0 100%)" } as CSSProperties}><span><small>Top genre</small><strong>{top?.label || "Building"}</strong><b>{top ? `${Math.round(Number(top.value || 0) / total * 100)}%` : "--"}</b></span></div><div className="genre-legend">{visible.map((genre, index) => <div key={genre.label}><i style={{ background: palette[index % palette.length] }} /><span><strong>{genre.label}</strong><small>{Number(genre.value || 0).toLocaleString("en-AU")} sampled hrs</small></span><b>{Math.round(Number(genre.value || 0) / total * 100)}%</b></div>)}</div></div>;
}

function PlaystyleView({ steam }: { steam: SteamData }) {
  const insights = steam.insights || {};
  const spending = steam.spending || {};
  const currency = spending.currency || "AUD";
  const loggedGames = (spending.games || []).filter((game) => game.title && Number.isFinite(Number(game.amount)));
  const highestLogged = spending.highestGame?.title
    ? spending.highestGame
    : [...loggedGames].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const controller = Number(steam.replay?.controllerPercent || 0);
  const playstyle = insights.playstyle?.length ? insights.playstyle : [
    { label: "Controller", value: controller, note: `${controller}% of Replay` },
    { label: "Keyboard, mouse + other", value: 100 - controller, note: `${100 - controller}% of Replay` }
  ];
  const habitStats = [
    { icon: Clock3, value: `${Number(insights.averageHoursPerGame || 0)} hrs`, label: "Average per owned game", note: "Total public playtime divided by owned games." },
    { icon: Flame, value: Number(insights.deepDiveGames || 0).toLocaleString("en-AU"), label: "Deep-dive games", note: "Games with at least 100 hours played." },
    { icon: LibraryBig, value: Number(insights.lowPlaytimeGames || 0).toLocaleString("en-AU"), label: "Low-playtime library", note: "Games with under two hours recorded." },
    { icon: Layers3, value: Number(insights.availableDlcCount || 0).toLocaleString("en-AU"), label: "DLC listings detected", note: `Available across ${insights.metadataSampleSize || 0} sampled Store pages, not confirmed purchases.` }
  ];
  return <div className="steam-playstyle-profile"><section className="playstyle-block"><div className="insight-subhead"><span>Genre fingerprint</span><small>weighted by playtime across sampled Store metadata</small></div><GenreFingerprint genres={insights.genreMix} /></section><section className="playstyle-block"><div className="insight-subhead"><span>How the library gets played</span><small>Steam public playtime + Replay input data</small></div><div className="playstyle-balance"><div className="steam-playstyle-visual"><Gamepad2 aria-hidden="true" /><span><strong>{controller}%</strong><small>controller playtime in Replay</small></span></div><InsightMeterList items={playstyle} /></div></section><section className="playstyle-habit-grid">{habitStats.map(({ icon: Icon, value, label, note }) => <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><b>{label}</b><small>{note}</small></span></article>)}</section><section className="playstyle-lower-grid"><div className="dlc-profile"><div className="insight-subhead"><span>DLC-heavy game ecosystems</span><small>Store availability, not purchase history</small></div><ol>{(insights.dlcHeavyGames || []).slice(0, 5).map((game, index) => <li key={game.appid || game.title}><span>{String(index + 1).padStart(2, "0")}</span><SteamArtwork item={game} title={game.title || "Steam game"} className="dlc-game-art" /><div><strong>{game.title}</strong><small>{game.meta}</small></div><b>{Number(game.dlcAvailable || 0)} DLC</b></li>)}{!insights.dlcHeavyGames?.length && <li className="playstyle-empty">DLC metadata will appear after the next Steam refresh.</li>}</ol></div><div className="spending-profile"><div className="insight-subhead"><span>Manual spending log</span><small>private receipt data you choose to publish</small></div><div className="spending-summary"><article><WalletCards aria-hidden="true" /><span><small>Library value</small><strong>{steam.accountValue?.value || "Not logged"}</strong></span></article><article><Coins aria-hidden="true" /><span><small>Total personally logged</small><strong>{money(spending.totalSpent, currency)}</strong></span></article><article><TrendingUp aria-hidden="true" /><span><small>Highest game spend</small><strong>{highestLogged?.title || "Not logged"}</strong><b>{money(highestLogged?.amount, currency)}</b></span></article></div>{loggedGames.length ? <ol className="spending-game-list">{loggedGames.slice(0, 5).map((game) => <li key={game.title}><span><strong>{game.title}</strong><small>{game.note || `${game.dlcCount || 0} DLC logged`}</small></span><b>{money(game.amount, currency)}</b></li>)}</ol> : <p className="spending-pending">Add your amounts under <code>steam.spending</code> in <code>portfolio.config.js</code>. Nothing is estimated or exposed automatically.</p>}</div></section></div>;
}

function SteamInsightsDeck({ steam }: { steam: SteamData }) {
  const [active, setActive] = useState<SteamInsightView>("pulse");
  const [pickIndex, setPickIndex] = useState(0);
  const insights = steam.insights || {};
  const recent = insights.recentGames?.length ? insights.recentGames : (steam.currentlyPlaying || []).filter((item) => item.meta !== "Playing now");
  const owned = insights.ownedGames?.length ? insights.ownedGames : steam.mostPlayed || [];
  const cabinet = insights.rareAchievements?.length ? insights.rareAchievements : steam.achievements || [];
  const pickerPool = owned.filter((game) => Number(game.playtimeMinutes || 0) < 1800).length ? owned.filter((game) => Number(game.playtimeMinutes || 0) < 1800) : owned;
  const pick = pickerPool[pickIndex % Math.max(1, pickerPool.length)];
  const recentMinutes = recent.reduce((sum, item) => sum + Number(item.recentMinutes || 0), 0);
  const pulse = Array.from({ length: 14 }, (_, index) => {
    const game = recent[index % Math.max(1, recent.length)];
    const value = recent.length ? Math.max(1, Math.round(Number(game?.recentMinutes || recentMinutes / recent.length || 0) / 60)) : 0;
    return { value, label: game?.title || game?.name || "No activity" };
  });
  const tabs: Array<{ id: SteamInsightView; label: string; icon: typeof LibraryBig }> = [
    { id: "pulse", label: "Library Pulse", icon: Grid3X3 },
    { id: "cabinet", label: "Rare Cabinet", icon: Trophy },
    { id: "playstyle", label: "Playstyle", icon: Gamepad2 },
    { id: "picker", label: "Pick a Game", icon: Dice5 }
  ];
  const pulseMax = Math.max(1, ...pulse.map((item) => item.value));
  const renderPanel = () => {
    if (active === "pulse") return <div className="steam-pulse-view"><div className="insight-stat-row"><div><strong>{recent.length}</strong><span>recent games</span></div><div><strong>{Math.round(recentMinutes / 60)}</strong><span>hours in 2 weeks</span></div><div><strong>{steam.replay?.longestStreak || 0}</strong><span>day Replay streak</span></div></div><div className="steam-pulse-grid"><div><div className="insight-subhead"><span>14-slot activity signal</span><small>relative recent-game intensity, not a daily calendar</small></div><div className="steam-heatmap" aria-label="Recent library activity signal">{pulse.map((item, index) => <span key={index} title={`${item.label}: ${item.value} hour signal`} style={{ "--pulse": item.value / pulseMax } as CSSProperties} />)}</div></div><div><div className="insight-subhead"><span>Genre mix</span><small>{insights.metadataSampleSize ? `${insights.metadataSampleSize} games sampled` : "saved metadata"}</small></div><InsightMeterList items={insights.genreMix || []} /></div></div></div>;
    if (active === "cabinet") return <div className="achievement-cabinet"><div className="insight-subhead"><span>Achievement cabinet</span><small>lowest global unlock rate first when Steam rarity is available</small></div><div className="achievement-cabinet-grid">{cabinet.slice(0, 6).map((item, index) => <article key={`${item.appid}-${item.title}-${index}`}><SteamArtwork item={item} title={item.title || "Achievement"} className="cabinet-art" /><span><strong>{item.title}</strong><small>{item.meta}</small><b>{item.achievementPercent !== undefined ? `${item.achievementPercent.toFixed(1)}% global unlock` : item.note}</b></span></article>)}</div></div>;
    if (active === "playstyle") return <PlaystyleView steam={steam} />;
    return <div className="game-picker"><div className="game-picker-stage">{pick ? <><SteamArtwork item={pick} title={pick.title || pick.name || "Steam game"} className="game-picker-art" /><span><small>THE SELECTOR CHOSE</small><strong>{pick.title || pick.name}</strong><b>{pick.genres?.slice(0, 2).join(" / ") || pick.meta || "From the owned library snapshot"}</b>{pick.note && <em>{pick.note}</em>}</span></> : <p className="insight-empty">Owned-game choices will appear after the next Steam refresh.</p>}</div><button className="button primary game-picker-button" type="button" onClick={() => setPickIndex((value) => pickerPool.length ? (value + 1 + Math.floor(Math.random() * Math.max(1, pickerPool.length - 1))) % pickerPool.length : 0)}><Dice5 aria-hidden="true" /> Roll another</button></div>;
  };
  return <section className="insight-deck steam-insight-deck" aria-labelledby="steam-insights-title"><div className="insight-deck-heading"><div><span className="steam-label"><Sparkles aria-hidden="true" /> Library intelligence</span><h3 id="steam-insights-title">Four ways into the library</h3><p>Activity, rarity, playstyle, and one decisive answer to “what should I play?”</p></div></div><div className="insight-tabs" role="tablist" aria-label="Steam insight views">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? "is-active" : ""} onClick={() => setActive(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}</div><div className="insight-panel" role="tabpanel" key={active}>{renderPanel()}</div></section>;
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

interface CyclingWindow {
  visible: SteamItem[];
  swapping: boolean;
  start: number;
}

function useCyclingWindow(items: SteamItem[] = [], pageSize = 6): CyclingWindow {
  const [start, setStart] = useState(0);
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    setStart(0);
    setSwapping(false);
    if (items.length <= pageSize || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let swapTimer = 0;
    let frame = 0;
    const timer = window.setInterval(() => {
      setSwapping(true);
      swapTimer = window.setTimeout(() => {
        setStart((value) => (value + pageSize) % items.length);
        frame = window.requestAnimationFrame(() => setSwapping(false));
      }, 260);
    }, LIST_INTERVAL);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(swapTimer);
      window.cancelAnimationFrame(frame);
    };
  }, [items, pageSize]);
  const visible = items.length <= pageSize
    ? items
    : Array.from({ length: pageSize }, (_, offset) => items[(start + offset) % items.length]);
  return { visible, swapping, start };
}

function editionText(edition: NonNullable<SteamItem["editions"]>[number]): string {
  if (typeof edition === "string") return edition;
  const label = edition.label || edition.name || "Edition";
  return edition.price ? `${label}: ${edition.price}` : label;
}

function artworkCandidates(item: SteamItem): string[] {
  const candidates: string[] = [];
  const primary = String(item.image || "").trim().replace(/^http:\/\//i, "https://");
  if (primary) {
    candidates.push(primary.replace("shared.akamai.steamstatic.com", "shared.fastly.steamstatic.com"));
    if (primary.includes("shared.fastly.steamstatic.com")) {
      candidates.push(primary.replace("shared.fastly.steamstatic.com", "shared.akamai.steamstatic.com"));
    }
  }
  if (item.appid) candidates.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.appid}/header.jpg`);
  return [...new Set(candidates)];
}

function SteamArtwork({ item, title, className = "game-art" }: { item: SteamItem; title: string; className?: string }) {
  const candidates = useMemo(() => artworkCandidates(item), [item.appid, item.image]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [candidates]);

  if (!candidates[candidateIndex]) {
    return <span className={`${className} game-art-placeholder`} role="img" aria-label={`${title} artwork unavailable`}>Steam</span>;
  }

  return (
    <img
      className={className}
      src={candidates[candidateIndex]}
      alt={`${title} artwork`}
      loading="lazy"
      decoding="async"
      onError={() => setCandidateIndex((value) => value + 1)}
    />
  );
}

function GameItem({ item, index = 0 }: { item: SteamItem; index?: number }) {
  const title = item.title || item.name || "Untitled game";
  const hasArtwork = Boolean(item.image || item.appid);
  const body = (
    <>
      {item.url ? <a className="game-title" href={item.url} target="_blank" rel="noopener noreferrer">{title}</a> : <span className="game-title">{title}</span>}
      {item.meta && <span className="game-meta">{item.meta}</span>}
      {(item.price || item.originalPrice || item.discount) && <span className="game-price-row"><span className="game-price">{item.price || "Price TBA"}</span>{item.originalPrice && item.originalPrice !== item.price && <span className="game-original-price">{item.originalPrice}</span>}{Boolean(item.discount) && <span className="game-discount">{item.discount}% off</span>}</span>}
      {item.note && <span className="game-note">{item.note}</span>}
      {Boolean(item.editions?.length) && <span className="game-editions">{item.editions?.slice(0, 3).map((edition, index) => <span className="edition-chip" key={`${editionText(edition)}-${index}`}>{editionText(edition)}</span>)}</span>}
    </>
  );
  return <li className={`game-item${hasArtwork ? " has-art" : ""}`} style={{ "--item-index": index } as CSSProperties}>{hasArtwork && <SteamArtwork item={item} title={title} />}<div className="game-body">{body}</div></li>;
}

interface GameListProps { items?: SteamItem[]; label: string; pageSize?: number; }
function GameList({ items = [], label, pageSize = 6 }: GameListProps) {
  const games = useMemo(() => items.filter(Boolean), [items]);
  const { visible, swapping, start } = useCyclingWindow(games, pageSize);
  return <ul className={`game-list cycle-list react-cycle-list${pageSize === 3 && games.length >= 3 ? " is-triple" : ""}${games.length > pageSize ? " is-cycling" : " is-static-animated"}${swapping ? " is-swapping" : ""}`} aria-label={label}>{visible.map((item, index) => <GameItem key={`${start}-${item.appid || item.title || item.name}-${index}`} item={item} index={index} />)}</ul>;
}

function SteamReplayPanel({ replay }: { replay: NonNullable<SteamData["replay"]> }) {
  const topGames = replay.topGames || [];
  const controllerPercent = Math.min(100, Math.max(0, Number(replay.controllerPercent || 0)));
  const otherInputPercent = 100 - controllerPercent;
  const metrics = [
    { label: "Playtime", value: `${Number(replay.totalHours || 0).toLocaleString("en-AU")} hrs`, note: "Total time played during the Replay year." },
    { label: "Sessions", value: Number(replay.totalSessions || 0).toLocaleString("en-AU"), note: "Individual play sessions recorded by Steam." },
    { label: "Games played", value: Number(replay.gamesPlayed || 0).toLocaleString("en-AU"), note: "Different games launched during the year." },
    { label: "New games", value: Number(replay.newGames || 0).toLocaleString("en-AU"), note: "Games played for the first time that year." },
    { label: "Achievements", value: Number(replay.achievements || 0).toLocaleString("en-AU"), note: "Achievements unlocked across your library." },
    { label: "Longest streak", value: `${Number(replay.longestStreak || 0)} days`, note: "Longest run of consecutive days played." }
  ];

  return (
    <section className="steam-replay" aria-labelledby="steam-replay-title">
      <div className="steam-replay-heading">
        <div><span className="steam-label">Latest Steam Replay</span><h3 id="steam-replay-title">The {replay.year || 2025} campaign log</h3><p>Steam's public year-in-review snapshot, kept as a last-good local record between refreshes.</p></div>
        {replay.sourceUrl && <a className="button ghost" href={replay.sourceUrl} target="_blank" rel="noopener noreferrer">Open full Replay</a>}
      </div>
      <div className="steam-replay-board">
        <div className="steam-replay-year" aria-hidden="true"><span>REPLAY</span><strong>{replay.year || 2025}</strong><small>{replay.stale ? "Saved snapshot" : "Steam verified"}</small></div>
        <div className="steam-replay-metrics">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}</div>
      </div>
      {replay.controllerPercent !== undefined && <div className="steam-replay-input"><div className="steam-replay-subheading"><span>How you played</span><small>Steam reports controller time directly; the remainder includes keyboard, mouse, and other input.</small></div><div className="steam-input-grid"><div className="steam-input-card is-controller"><Gamepad2 aria-hidden="true" /><div><span>Controller</span><strong>{controllerPercent}%</strong><small>of recorded playtime</small></div><span className="steam-input-meter" aria-label={`${controllerPercent}% controller playtime`}><i style={{ width: `${controllerPercent}%` }} /></span></div><div className="steam-input-card is-keyboard"><span className="steam-input-icons"><Keyboard aria-hidden="true" /><Mouse aria-hidden="true" /></span><div><span>Keyboard, mouse + other</span><strong>{otherInputPercent}%</strong><small>remaining reported input time</small></div><span className="steam-input-meter" aria-label={`${otherInputPercent}% keyboard, mouse, and other input time`}><i style={{ width: `${otherInputPercent}%` }} /></span></div></div></div>}
      {topGames.length > 0 && <div className="steam-replay-top"><div className="steam-replay-subheading"><span>Top games</span><small>Ranked by your Steam Replay playtime.</small></div><ol>{topGames.slice(0, 3).map((game, index) => { const title = game.title || game.name || "Steam game"; const share = Math.min(100, Number(game.playtimePercent || 0)); return <li key={game.appid || title}><span className="steam-replay-rank">0{index + 1}</span><SteamArtwork item={game} title={title} className="steam-replay-game-art" /><div className="steam-replay-game-copy"><a href={game.url} target="_blank" rel="noopener noreferrer">{title}</a><span>{Number(game.hours || 0).toLocaleString("en-AU")} hrs · {Number(game.sessions || 0)} sessions</span><div className="steam-replay-share"><span><small>Share of annual playtime</small><strong>{share.toFixed(1)}%</strong></span><span className="steam-replay-meter" aria-label={`${share.toFixed(1)}% of annual playtime`}><i style={{ width: `${share}%` }} /></span></div></div></li>; })}</ol></div>}
      <div className="steam-replay-footer"><div><Trophy aria-hidden="true" /><span><strong>{Number(replay.rareAchievements || 0)}</strong><b>Rare achievements</b><small>Achievements Steam classifies as rare. Your overall achievement activity ranked above {Number(replay.achievementsPercentile || 0)}% of players.</small></span></div><div><TrendingUp aria-hidden="true" /><span><strong>{Number(replay.gamesPercentile || 0)}th percentile</strong><b>Game variety</b><small>You played more different games than {Number(replay.gamesPercentile || 0)}% of Steam players in this Replay.</small></span></div><div><CalendarClock aria-hidden="true" /><span><strong>{replay.lastGoodAt ? formatDate(replay.lastGoodAt) : `Replay ${replay.year || 2025}`}</strong><b>Snapshot captured</b><small>The last successful public Steam Replay refresh preserved between live updates.</small></span></div></div>
    </section>
  );
}

function SteamActivityDashboard() {
  const [steam, setSteam] = useState<SteamData>(steamFallback);
  const [watchIndex, setWatchIndex] = useState(0);
  const watch = useMemo(() => steam.preorderWatch || [], [steam.preorderWatch]);

  useEffect(() => {
    const receive = (event: Event) => setSteam((current) => mergeSteamData(current, (event as CustomEvent<SteamData>).detail));
    document.addEventListener("echoops:steam-data", receive);
    const controller = new AbortController();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const paths = isLocal
      ? ["https://silvaops-orbit.github.io/online-portfolio/data/steam.json", "data/steam.json"]
      : ["data/steam.json"];
    const loadSnapshot = async () => {
      for (const path of paths) {
        try {
          const url = `${path}?v=${Date.now()}`;
          const response = await fetch(url, { cache: "no-cache", credentials: path.startsWith("http") ? "omit" : "same-origin", referrerPolicy: "no-referrer", signal: controller.signal });
          if (!response.ok) continue;
          setSteam(mergeSteamData(steamFallback, await response.json() as SteamData));
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
        }
      }
      console.warn("Steam snapshot unavailable; using configured fallback");
    };
    void loadSnapshot();
    return () => { controller.abort(); document.removeEventListener("echoops:steam-data", receive); };
  }, []);

  useEffect(() => {
    setWatchIndex(0);
    if (watch.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setWatchIndex((value) => (value + 1) % watch.length), 6500);
    return () => window.clearInterval(timer);
  }, [watch]);

  const stats = [...(steam.stats || [])];
  if (steam.accountValue?.value) stats.push({ label: "SteamDB Value", value: steam.accountValue.value, note: steam.accountValue.note });
  const current = steam.currentlyPlaying || [];
  const watchItem = watch[watchIndex];
  const ticker = steam.storeHighlights || [];

  return (
    <>
      <p className="data-status">{steam.status || (steam.stale ? `Showing the last saved Steam snapshot from ${formatDate(steam.lastGoodAt)}.` : `Steam data updated ${formatDate(steam.generatedAt)}.`)}</p>
      <div className="steam-layout">
        <article className="steam-feature">
          {(steam.profile?.personaName || steam.profile?.avatarFull) && <div className="steam-profile-card">{steam.profile.avatarFull && <img className="steam-avatar" src={steam.profile.avatarFull} alt={`${steam.profile.personaName || "Steam"} avatar`} loading="lazy" />}<div><span className="steam-persona">{steam.profile.personaName || "Steam Profile"}</span><span className="steam-updated">{steam.generatedAt ? `Updated ${formatDate(steam.generatedAt)}` : ""}</span></div></div>}
          <div className="steam-actions">{steam.profileUrl && <a className="button ghost" href={steam.profileUrl} target="_blank" rel="noopener noreferrer">Steam Profile</a>}{steam.steamDbUrl && <a className="button" href={steam.steamDbUrl} target="_blank" rel="noopener noreferrer">SteamDB</a>}</div>
          <div className="steam-stat-grid">{stats.map((item) => <div className="steam-stat" key={item.label}><span className="steam-stat-value">{item.value || "TBC"}</span><span className="steam-stat-label">{item.label || "Steam stat"}</span>{item.note && <span className="steam-stat-note">{item.note}</span>}</div>)}</div>
          <span className="steam-label">Currently Playing</span>
          {current.length ? <GameList items={current} label="Currently playing" pageSize={4} /> : <p className="game-note">No live game detected. Recent activity remains visible below.</p>}
          <div className="steam-watch"><span className="steam-label">Pre-Order / Top 20 Games Watch</span>{watchItem ? <ul className="game-list watch-list"><GameItem item={watchItem} /></ul> : <p className="game-note">Steam store watch is waiting for its next snapshot.</p>}</div>
        </article>
        <div className="steam-grid">
          <article className="steam-card steam-card-large"><h3>Achievements ({steam.achievements?.length || 0})</h3><GameList items={steam.achievements} label="Achievements" pageSize={3} /></article>
          <article className="steam-card"><h3>Most Played</h3><GameList items={steam.mostPlayed} label="Most played games" pageSize={3} /></article>
          <article className="steam-card"><h3>100% Games ({steam.completedGames?.length || 0})</h3><GameList items={steam.completedGames} label="Completed games" pageSize={3} /></article>
        </div>
      </div>
      <SteamInsightsDeck steam={steam} />
      {steam.replay?.year && <SteamReplayPanel replay={steam.replay} />}
      <div className="steam-store-strip"><span className="steam-label">Steam Store Radar</span><div className="store-marquee" aria-label="Steam store highlights"><div className="store-marquee-track">{[...ticker, ...ticker].map((item, index) => <a className="store-deal" key={`${item.appid || item.title}-${index}`} href={item.url || "https://store.steampowered.com/"} target="_blank" rel="noopener noreferrer" aria-hidden={index >= ticker.length || undefined} tabIndex={index >= ticker.length ? -1 : undefined}><span className="store-deal-tag">{item.tag || item.category || "Steam"}</span><span className="store-deal-title">{item.title || item.name}</span><span className="store-deal-price">{item.price || "Price TBA"}</span>{Boolean(item.discount) && <span className="store-deal-discount">{item.discount}% off</span>}</a>)}</div></div></div>
    </>
  );
}

export function mountSteamActivityDashboard(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Steam activity dashboard"><SteamActivityDashboard /></IslandBoundary></StrictMode>);
}
