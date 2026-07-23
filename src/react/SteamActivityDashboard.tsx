// React + DOM rendering primitives.
import { StrictMode, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
// `createRoot` mounts a React tree into a plain DOM node (the "island" pattern).
import { createRoot } from "react-dom/client";
// Icon set used throughout the dashboard (lucide is a tree-shakeable icon library).
import { CalendarClock, Check, ChevronRight, Clock3, Coins, Dice5, ExternalLink, Eye, Flame, Gamepad2, Grid3X3, Keyboard, LibraryBig, LockKeyhole, Mouse, RotateCw, Send, Sparkles, TrendingUp, Trophy, UserRound, Users, WalletCards, X } from "lucide-react";
// Error boundary that renders a graceful fallback if this React island throws.
import { IslandBoundary } from "./IslandBoundary";
import type { SteamData, SteamItem } from "./portfolio-types";
// Reads the baked-in `window.PORTFOLIO_CONFIG` object (set by the build / inline script).
import { getPortfolioConfig } from "./portfolio-types";

// How long a rotating game list stays on screen before sliding to the next window (ms).
const LIST_INTERVAL = 4800;
// Initial data shown before the live `data/steam.json` fetch resolves. Taken from the
// static config so the dashboard is never empty on first paint.
const steamFallback = getPortfolioConfig().steam || {};

// Combines the static fallback config with freshly fetched live data.
// Live values win, but the merge is "shallow per section" so individual sub-objects
// (profile, replay, insights, accountValue) keep their fallback fields when the live
// payload omits them. Array sections fall back entirely if the live array is missing/empty.
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

// The four selectable insight panels inside the "Library intelligence" deck.
type SteamInsightView = "pulse" | "cabinet" | "playstyle" | "picker";

type SuggestionSort = "recommended" | "match" | "reviews" | "price-low" | "price-high" | "dlc" | "genre";

interface GameSuggestion {
  key: string;
  appid?: number | null;
  title: string;
  priceCents?: number | null;
  priceLabel?: string | null;
  currency?: string;
  genres?: string[];
  dlcCount?: number | null;
  reviewPercent?: number | null;
  reviewCount?: number | null;
  reviewSummary?: string | null;
  imageUrl?: string | null;
  storeUrl?: string | null;
  recommenders: string[];
  recommendationCount: number;
  recommendedAt?: string;
}

const SUGGESTION_CLIENT_KEY = "echoops-game-suggestion-client-v1";

function suggestionClientId(): string {
  try {
    const saved = localStorage.getItem(SUGGESTION_CLIENT_KEY);
    if (saved && /^[a-f0-9-]{32,64}$/i.test(saved)) return saved;
    const value = crypto.randomUUID();
    localStorage.setItem(SUGGESTION_CLIENT_KEY, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

function suggestionMatch(suggestion: GameSuggestion, steam: SteamData): number {
  const footprint = steam.insights?.genreMix || [];
  const total = Math.max(1, footprint.reduce((sum, genre) => sum + Number(genre.value || 0), 0));
  const suggestionGenres = new Set((suggestion.genres || []).map((genre) => genre.toLowerCase()));
  const genreScore = footprint.reduce((score, genre) => {
    const label = String(genre.label || "").toLowerCase();
    const matched = [...suggestionGenres].some((candidate) => candidate.includes(label) || label.includes(candidate));
    return score + (matched ? Number(genre.value || 0) / total * 62 : 0);
  }, 0);
  const reviewScore = suggestion.reviewPercent ? Math.max(0, (suggestion.reviewPercent - 50) / 50 * 18) : 5;
  const communityScore = Math.min(15, Math.max(0, suggestion.recommendationCount - 1) * 3);
  return Math.min(99, Math.max(8, Math.round(15 + genreScore + reviewScore + communityScore)));
}

function suggestionPrice(suggestion: GameSuggestion): number {
  return suggestion.priceCents === null || suggestion.priceCents === undefined ? Number.POSITIVE_INFINITY : Number(suggestion.priceCents);
}

// Renders a horizontal bar list of labelled values (e.g. genre mix / playstyle split).
// Each bar is scaled relative to the largest value so the longest bar fills 100% width.
function InsightMeterList({ items = [] }: { items?: Array<{ label?: string; value?: number; note?: string }> }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return <div className="insight-meter-list">{items.slice(0, 7).map((item) => <div key={item.label}><span><b>{item.label}</b><small>{item.note || Number(item.value || 0).toLocaleString("en-AU")}</small></span><i><em style={{ width: `${Math.max(7, Number(item.value || 0) / max * 100)}%` }} /></i></div>)}</div>;
}

// Formats a money amount in Australian locale. Unknown/missing values show "Not logged"
// instead of "$NaN" so the UI never looks broken.
function money(value: number | null | undefined, currency = "AUD"): string {
  if (value === null || value === undefined) return "Not logged";
  if (!Number.isFinite(Number(value))) return "Not logged";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

// Draws the "genre fingerprint": a conic-gradient pie ring plus a legend. Each genre is a
// slice sized by its sampled playtime, cycling through a fixed 6-colour palette. The ring
// uses a CSS custom property (`--genre-ring`) so the stylesheet can render the gradient.
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

function parseHoursFromMeta(item: SteamItem): number {
  const source = String(item.note || item.meta || "");
  const match = source.match(/([\d,.]+)\s*hrs?/i);
  if (!match) return Number(item.playtimeMinutes || 0) / 60;
  return Number(String(match[1]).replace(/,/g, "")) || 0;
}

function getDeepDiveGames(steam: SteamData): SteamItem[] {
  const pool = steam.insights?.ownedGames?.length ? steam.insights.ownedGames : (steam.mostPlayed || []);
  return pool
    .filter((item) => Number(item.playtimeMinutes || 0) >= 6000 || (!item.playtimeMinutes && parseHoursFromMeta(item) >= 100))
    .slice()
    .sort((a, b) => parseHoursFromMeta(b) - parseHoursFromMeta(a));
}

function PlaystyleView({ steam }: { steam: SteamData }) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const insights = steam.insights || {};
  const spending = steam.spending || {};
  const currency = spending.currency || "AUD";
  const loggedGames = (spending.games || []).filter((game) => game.title && Number.isFinite(Number(game.amount)));
  const highestLogged = spending.highestGame?.title
    ? spending.highestGame
    : [...loggedGames].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const controller = Number(steam.replay?.controllerPercent || 0);
  const retail = insights.retailEstimate;
  const retailCurrency = retail?.currency || currency;
  const highestRetail = retail?.highestGame;
  const playstyle = insights.playstyle?.length ? insights.playstyle : [
    { label: "Controller", value: controller, note: `${controller}% of Replay` },
    { label: "Keyboard, mouse + other", value: 100 - controller, note: `${100 - controller}% of Replay` }
  ];
  const deepDiveGames = getDeepDiveGames(steam);
  const habitStats = [
    { icon: Clock3, value: `${Number(insights.averageHoursPerGame || 0)} hrs`, label: "Average per owned game", note: "Total public playtime divided by owned games." },
    { icon: Flame, value: Number(insights.deepDiveGames || 0).toLocaleString("en-AU"), label: "Deep-dive games", note: "Games with at least 100 hours played.", clickable: true },
    { icon: LibraryBig, value: Number(insights.lowPlaytimeGames || 0).toLocaleString("en-AU"), label: "Low-playtime library", note: "Games with under two hours recorded." }
  ];

  return (
    <div className="steam-playstyle-profile">
      <section className="playstyle-block">
        <div className="insight-subhead"><span>Genre fingerprint</span><small>weighted by playtime across sampled Store metadata</small></div>
        <GenreFingerprint genres={insights.genreMix} />
      </section>
      <section className="playstyle-block">
        <div className="insight-subhead"><span>How the library gets played</span><small>Steam public playtime + Replay input data</small></div>
        <div className="playstyle-balance"><div className="steam-playstyle-visual"><Gamepad2 aria-hidden="true" /><span><strong>{controller}%</strong><small>controller playtime in Replay</small></span></div><InsightMeterList items={playstyle} /></div>
      </section>
      <section className="playstyle-habit-grid">
        {habitStats.map(({ icon: Icon, value, label, note, clickable }) => clickable
          ? <button key={label} type="button" className={`playstyle-habit-card${deepDiveOpen ? " is-open" : ""}`} aria-expanded={deepDiveOpen} onClick={() => setDeepDiveOpen((open) => !open)}><Icon aria-hidden="true" /><span><strong>{value}</strong><b>{label}</b><small>{note}</small><em className="playstyle-habit-hint">{deepDiveOpen ? "Hide games" : "Tap to view games"}</em></span></button>
          : <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><b>{label}</b><small>{note}</small></span></article>)}
      </section>
      {deepDiveOpen && <section className="deep-dive-reveal" aria-label="Deep-dive games list">{deepDiveGames.length
        ? <GameList items={deepDiveGames} label="Deep-dive games" pageSize={4} />
        : <p className="game-note">Deep-dive games will appear after the next Steam refresh.</p>}</section>}
      <section className="spending-profile">
        <div className="insight-subhead"><span>Retail value estimate</span><small>{retail?.sampledGames || 0} owned-game Store pages sampled</small></div>
        <div className="spending-summary">
          <article><WalletCards aria-hidden="true" /><span><small>Library value</small><strong>{steam.accountValue?.value || "Not logged"}</strong></span></article>
          <article><Coins aria-hidden="true" /><span><small>Total personally logged</small><strong>{money(spending.totalSpent, currency)}</strong></span></article>
          <article><TrendingUp aria-hidden="true" /><span><small>Highest sampled retail estimate</small><strong>{highestRetail?.title || "Awaiting Store prices"}</strong><b>{money(highestRetail?.amount, retailCurrency)}</b></span></article>
        </div>
        {retail?.topGames?.length
          ? <ol className="spending-game-list">{retail.topGames.map((game) => <li key={game.appid || game.title}><span><strong>{game.title}</strong><small>Base {money(game.baseAmount, game.currency || retailCurrency)}{Number(game.confirmedDlcCount || 0) > 0 ? ` + ${game.confirmedDlcCount} owner-confirmed DLC ${money(game.dlcAmount, game.currency || retailCurrency)}` : ""}</small></span><b>{money(game.amount, game.currency || retailCurrency)}</b></li>)}</ol>
          : <p className="spending-pending">Store-price estimates will appear after the next Steam refresh.</p>}
        <p className="spending-method">{retail?.method || "Full-price Store estimate only. Steam does not expose purchase receipts or public DLC ownership."}</p>
        {loggedGames.length > 0 && <p className="spending-method">Actual amounts manually logged for {loggedGames.length} game{loggedGames.length === 1 ? "" : "s"}; highest logged: {highestLogged?.title} at {money(highestLogged?.amount, currency)}.</p>}
      </section>
    </div>
  );
}

// Tabbed "Library intelligence" deck. Holds which sub-panel is active and, for the
// "Pick a Game" panel, which game is currently chosen. All data is derived from `steam`.
function SteamInsightsDeck({ steam }: { steam: SteamData }) {
  const [active, setActive] = useState<SteamInsightView>("pulse");
  const [pickIndex, setPickIndex] = useState(0);
  const insights = steam.insights || {};
  // Recent activity: prefer precomputed recentGames, else currently-playing minus "Playing now".
  const recent = insights.recentGames?.length ? insights.recentGames : (steam.currentlyPlaying || []).filter((item) => item.meta !== "Playing now");
  // Owned library (for picker/cabinet source): prefer insights.ownedGames, else mostPlayed.
  const owned = insights.ownedGames?.length ? insights.ownedGames : steam.mostPlayed || [];
  // Rare achievements cabinet: prefer insights.rareAchievements, else the achievements list.
  const cabinet = insights.rareAchievements?.length ? insights.rareAchievements : steam.achievements || [];
  // "Pick a Game" candidate pool: short games (<30h) when available, otherwise the whole library.
  const pickerPool = owned.filter((game) => Number(game.playtimeMinutes || 0) < 1800).length ? owned.filter((game) => Number(game.playtimeMinutes || 0) < 1800) : owned;
  const pick = pickerPool[pickIndex % Math.max(1, pickerPool.length)];
  const recentMinutes = recent.reduce((sum, item) => sum + Number(item.recentMinutes || 0), 0);
  // 14-slot activity signal: one relative-intensity cell per recent game (wrapped if <14 games).
  const pulse = Array.from({ length: 14 }, (_, index) => {
    const game = recent[index % Math.max(1, recent.length)];
    const value = recent.length ? Math.max(1, Math.round(Number(game?.recentMinutes || recentMinutes / recent.length || 0) / 60)) : 0;
    return { value, label: game?.title || game?.name || "No activity", game };
  });
  // The four selectable tabs and their icons.
  const tabs: Array<{ id: SteamInsightView; label: string; icon: typeof LibraryBig }> = [
    { id: "pulse", label: "Library Pulse", icon: Grid3X3 },
    { id: "cabinet", label: "Rare Cabinet", icon: Trophy },
    { id: "playstyle", label: "Playstyle", icon: Gamepad2 },
    { id: "picker", label: "Pick a Game", icon: Dice5 }
  ];
  // Largest pulse value, used to normalise each heatmap cell's intensity.
  const pulseMax = Math.max(1, ...pulse.map((item) => item.value));
  const renderPanel = () => {
    if (active === "pulse") return <div className="steam-pulse-view"><div className="insight-stat-row"><div><strong>{recent.length}</strong><span>recent games</span></div><div><strong>{Math.round(recentMinutes / 60)}</strong><span>hours in 2 weeks</span></div><div><strong>{steam.replay?.longestStreak || 0}</strong><span>day Replay streak</span></div></div><div className="steam-pulse-grid"><div><div className="insight-subhead"><span>14-slot activity signal</span><small>recent-game covers weighted by two-week playtime</small></div><div className="steam-heatmap" aria-label="Recent library activity signal">{pulse.map((item, index) => <div className="steam-pulse-cell" key={`${item.game?.appid || item.label}-${index}`} title={`${item.label}: ${item.value} hour signal`} style={{ "--pulse": item.value / pulseMax } as CSSProperties}>{item.game ? <SteamArtwork item={item.game} title={item.label} className="steam-pulse-art" /> : <span className="steam-pulse-art game-art-placeholder" role="img" aria-label="No recent game artwork">Steam</span>}<i aria-hidden="true" /></div>)}</div></div><div><div className="insight-subhead"><span>Genre mix</span><small>{insights.metadataSampleSize ? `${insights.metadataSampleSize} games sampled` : "saved metadata"}</small></div><InsightMeterList items={insights.genreMix || []} /></div></div></div>;
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

// Shape returned by the cycling hook: the currently visible slice + a `swapping`
// flag the CSS uses to animate the transition between windows.
interface CyclingWindow {
  visible: SteamItem[];
  swapping: boolean;
  start: number;
}

// Auto-rotates a long game list a page at a time. For short lists (<= pageSize) it shows
// everything statically. Honours "prefers-reduced-motion" by disabling the rotation entirely.
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

// Normalises an edition entry (which may be a plain string OR an object with label/name/price)
// into the short chip text shown on a game card.
function editionText(edition: NonNullable<SteamItem["editions"]>[number]): string {
  if (typeof edition === "string") return edition;
  const label = edition.label || edition.name || "Edition";
  return edition.price ? `${label}: ${edition.price}` : label;
}

// Builds an ordered list of image URLs to try for a game's cover art. Steam serves header
// images from two CDNs (akamai + fastly) plus a canonical Cloudflare URL keyed by appid.
// `SteamArtwork` walks this list and falls through to the next on any load error.
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

// Resilient game cover image. Tries each candidate URL in turn; on a load error it advances
// to the next candidate. If every candidate fails it shows a plain "Steam" placeholder so the
// layout never collapses. The candidate list is memoised so it only recomputes when the
// game's appid/image changes (not on every parent re-render).
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

// One game row: optional cover art plus a text block with title (linked to the store when a
// URL exists), meta line, price/discount row, note, and up to three edition chips.
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
// Renders a (possibly auto-rotating) list of game rows. Wires the visible window from
// `useCyclingWindow` and applies CSS classes that drive the animation/sizing.
function GameList({ items = [], label, pageSize = 6 }: GameListProps) {
  const games = useMemo(() => items.filter(Boolean), [items]);
  const { visible, swapping, start } = useCyclingWindow(games, pageSize);
  return <ul className={`game-list cycle-list react-cycle-list${pageSize === 3 && games.length >= 3 ? " is-triple" : ""}${games.length > pageSize ? " is-cycling" : " is-static-animated"}${swapping ? " is-swapping" : ""}`} aria-label={label}>{visible.map((item, index) => <GameItem key={`${start}-${item.appid || item.title || item.name}-${index}`} item={item} index={index} />)}</ul>;
}

// The "Steam Replay" section: a year-in-review snapshot. Shows headline metrics, an
// input-split (controller vs keyboard/mouse), top games, and percentile bragging rights.
function SteamReplayPanel({ replay }: { replay: NonNullable<SteamData["replay"]> }) {
  const topGames = replay.topGames || [];
  // Clamp the controller percentage into 0–100 so the meter bars can't overflow.
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

function SteamShowcaseStage({ steam }: { steam: SteamData }) {
  const [view, setView] = useState<"library" | "replay">("library");
  const [libraryIndex, setLibraryIndex] = useState(0);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const library = useMemo(() => {
    const source = steam.insights?.ownedGames?.length ? steam.insights.ownedGames : steam.mostPlayed || [];
    return source.filter((game) => game.appid || game.image).slice().sort((a, b) => Number(b.playtimeMinutes || 0) - Number(a.playtimeMinutes || 0));
  }, [steam.insights?.ownedGames, steam.mostPlayed]);
  const memories = useMemo(() => {
    const replay = steam.replay || {};
    return [
      { value: `${Number(replay.totalHours || 0).toLocaleString("en-AU")} hrs`, title: "A year in play", note: `${Number(replay.totalSessions || 0).toLocaleString("en-AU")} sessions across ${Number(replay.gamesPlayed || 0)} games.` },
      { value: `${Number(replay.longestStreak || 0)} days`, title: "Longest streak", note: "The longest unbroken run of play days in the latest Steam Replay." },
      { value: Number(replay.achievements || 0).toLocaleString("en-AU"), title: "Achievements unlocked", note: `${Number(replay.rareAchievements || 0)} of them were classified as rare by Steam.` },
      { value: `${Number(replay.controllerPercent || 0)}%`, title: "Controller time", note: "The rest of the recorded input time used keyboard, mouse, or other controls." }
    ].filter((memory) => memory.value !== "0" && memory.value !== "0 hrs" && memory.value !== "0 days" && memory.value !== "0%");
  }, [steam.replay]);

  const advance = () => {
    if (view === "library") setLibraryIndex((index) => library.length ? (index + 1) % library.length : 0);
    else setMemoryIndex((index) => memories.length ? (index + 1) % memories.length : 0);
    setView((current) => current === "library" ? "replay" : "library");
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(advance, 7600);
    return () => window.clearInterval(timer);
  }, [view, library.length, memories.length]);

  const game = library[libraryIndex % Math.max(1, library.length)];
  const memory = memories[memoryIndex % Math.max(1, memories.length)];
  const gameTitle = game?.title || game?.name || "Steam library";
  const hours = game ? Math.round(parseHoursFromMeta(game)) : 0;

  return (
    <section className="steam-showcase" aria-labelledby="steam-showcase-title">
      <div className="steam-showcase-heading">
        <div><span className="steam-label">Rotating signal</span><h3 id="steam-showcase-title">Library Spotlight + Replay Memory</h3></div>
        <div className="steam-showcase-controls" aria-label="Choose Steam showcase view">
          <button type="button" className={view === "library" ? "is-active" : ""} aria-pressed={view === "library"} onClick={() => setView("library")}><LibraryBig aria-hidden="true" /><span>Library</span></button>
          <button type="button" className={view === "replay" ? "is-active" : ""} aria-pressed={view === "replay"} onClick={() => setView("replay")}><RotateCw aria-hidden="true" /><span>Replay</span></button>
          <button type="button" className="steam-showcase-next" aria-label="Show next spotlight" title="Show next spotlight" onClick={advance}><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
      <div className={`steam-showcase-stage is-${view}`} key={`${view}-${view === "library" ? libraryIndex : memoryIndex}`}>
        {view === "library" ? game ? <>
          <SteamArtwork item={game} title={gameTitle} className="steam-showcase-art" />
          <div className="steam-showcase-copy"><small>FROM THE OWNED LIBRARY</small><h4>{gameTitle}</h4><div className="steam-showcase-facts"><span><Clock3 aria-hidden="true" />{hours.toLocaleString("en-AU")} hrs recorded</span>{game.recentMinutes ? <span><Flame aria-hidden="true" />{Math.round(game.recentMinutes / 60)} hrs recently</span> : null}</div>{game.genres?.length ? <div className="steam-showcase-genres">{game.genres.slice(0, 4).map((genre) => <span key={genre}>{genre}</span>)}</div> : null}{game.url && <a href={game.url} target="_blank" rel="noopener noreferrer">Open Store page <ExternalLink aria-hidden="true" /></a>}</div>
        </> : <p className="insight-empty">The next Steam library refresh will populate this spotlight.</p> : memory ? <div className="steam-memory"><span>REPLAY {steam.replay?.year || 2025}</span><strong>{memory.value}</strong><h4>{memory.title}</h4><p>{memory.note}</p>{steam.replay?.sourceUrl && <a href={steam.replay.sourceUrl} target="_blank" rel="noopener noreferrer">Open full Replay <ExternalLink aria-hidden="true" /></a>}</div> : <p className="insight-empty">Replay memories will appear with the next saved snapshot.</p>}
      </div>
      <div className="steam-showcase-progress" aria-hidden="true"><i key={`${view}-${libraryIndex}-${memoryIndex}`} /></div>
    </section>
  );
}

function SteamCommunityQueue({ steam }: { steam: SteamData }) {
  const endpoint = String(getPortfolioConfig().gameSuggestions?.endpoint || "").replace(/\/+$/, "");
  const [game, setGame] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState<GameSuggestion[]>([]);
  const [sort, setSort] = useState<SuggestionSort>("recommended");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading the community queue...");

  const loadSuggestions = async () => {
    if (!endpoint) { setStatus("The community queue is waiting for its Worker endpoint."); return; }
    try {
      const response = await fetch(`${endpoint}/api/game-suggestions`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error(`Suggestion service returned ${response.status}`);
      const payload = await response.json() as { suggestions?: GameSuggestion[] };
      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      setStatus(payload.suggestions?.length ? `${payload.suggestions.length} game${payload.suggestions.length === 1 ? "" : "s"} in the community queue.` : "No suggestions yet. The first pick is wide open.");
    } catch {
      setStatus("The community queue is temporarily offline. Existing Steam data still works normally.");
    }
  };

  useEffect(() => { void loadSuggestions(); }, [endpoint]);
  useEffect(() => {
    if (!browserOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setBrowserOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", close); };
  }, [browserOpen]);

  const sorted = useMemo(() => [...suggestions].sort((a, b) => {
    if (sort === "match") return suggestionMatch(b, steam) - suggestionMatch(a, steam);
    if (sort === "reviews") return Number(b.reviewPercent || -1) - Number(a.reviewPercent || -1) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
    if (sort === "price-low" || sort === "price-high") {
      const aMissing = a.priceCents === null || a.priceCents === undefined;
      const bMissing = b.priceCents === null || b.priceCents === undefined;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      return sort === "price-low" ? suggestionPrice(a) - suggestionPrice(b) : suggestionPrice(b) - suggestionPrice(a);
    }
    if (sort === "dlc") return Number(b.dlcCount ?? -1) - Number(a.dlcCount ?? -1);
    if (sort === "genre") return String(a.genres?.[0] || "ZZZ").localeCompare(String(b.genres?.[0] || "ZZZ"));
    return Number(b.recommendationCount || 0) - Number(a.recommendationCount || 0) || String(b.recommendedAt || "").localeCompare(String(a.recommendedAt || ""));
  }), [suggestions, sort, steam]);
  const selected = suggestions.find((item) => item.key === selectedKey) || null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!endpoint || loading) return;
    setLoading(true);
    setStatus("Checking Steam and adding the recommendation...");
    try {
      const response = await fetch(`${endpoint}/api/game-suggestions`, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, anonymous, username: anonymous ? "" : username, clientId: suggestionClientId() })
      });
      const payload = await response.json() as { suggestions?: GameSuggestion[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Suggestion could not be added.");
      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      setGame("");
      setStatus("Recommendation added. Steam details were matched where available.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Suggestion could not be added.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="steam-community" aria-labelledby="steam-community-title">
      <div className="steam-community-copy"><span className="steam-label"><Users aria-hidden="true" /> Community queue</span><h3 id="steam-community-title">What should Alvis play next?</h3><p>Recommend a Steam game by name or paste its Store link. Matching Store details are added automatically, while your browser identity stays private.</p><div className="steam-community-status" role="status"><LockKeyhole aria-hidden="true" /><span>{status}</span></div></div>
      <form className="steam-suggestion-form" onSubmit={submit}>
        <label htmlFor="steam-suggestion-game">Game name or Steam Store link</label>
        <div className="steam-suggestion-entry"><input id="steam-suggestion-game" value={game} onChange={(event) => setGame(event.target.value)} minLength={2} maxLength={180} required placeholder="e.g. Helldivers 2" autoComplete="off" /><button type="submit" disabled={loading}><Send aria-hidden="true" /><span>{loading ? "Adding..." : "Suggest"}</span></button></div>
        <div className="steam-suggestion-identity"><label><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /><span>Suggest anonymously</span></label>{!anonymous && <label className="steam-username"><UserRound aria-hidden="true" /><input value={username} onChange={(event) => setUsername(event.target.value)} minLength={1} maxLength={18} required placeholder="Username" autoComplete="nickname" /></label>}</div>
        <button className="button ghost steam-view-suggestions" type="button" onClick={() => { setBrowserOpen(true); void loadSuggestions(); }}><Eye aria-hidden="true" /> View suggestions {suggestions.length ? `(${suggestions.length})` : ""}</button>
      </form>

      {browserOpen && <div className="suggestion-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBrowserOpen(false); }}><section className="suggestion-modal" role="dialog" aria-modal="true" aria-labelledby="suggestion-modal-title">
        <header><div><span className="steam-label">Community picks</span><h3 id="suggestion-modal-title">Steam suggestion board</h3><p>Duplicate recommendations are grouped, with every named or numbered anonymous recommender preserved.</p></div><button type="button" aria-label="Close suggestions" title="Close suggestions" onClick={() => setBrowserOpen(false)}><X aria-hidden="true" /></button></header>
        <div className="suggestion-toolbar"><label htmlFor="suggestion-sort">Sort suggestions</label><select id="suggestion-sort" value={sort} onChange={(event) => setSort(event.target.value as SuggestionSort)}><option value="recommended">Most recommended</option><option value="match">Most likely match</option><option value="reviews">Most positive reviews</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="dlc">Most DLC</option><option value="genre">Genre</option></select><button type="button" aria-label="Refresh suggestions" title="Refresh suggestions" onClick={() => void loadSuggestions()}><RotateCw aria-hidden="true" /></button></div>
        <div className={`suggestion-browser${selected ? " has-selection" : ""}`}>
          <div className="suggestion-list" role="list">{sorted.length ? sorted.map((suggestion) => { const match = suggestionMatch(suggestion, steam); return <button type="button" role="listitem" className={selectedKey === suggestion.key ? "is-selected" : ""} key={suggestion.key} onClick={() => setSelectedKey(suggestion.key)}><SteamArtwork item={{ appid: suggestion.appid || undefined, image: suggestion.imageUrl || undefined }} title={suggestion.title} className="suggestion-art" /><span><strong>{suggestion.title}</strong><small>{suggestion.genres?.slice(0, 2).join(" / ") || "Genre awaiting Steam"}</small><span><b>{suggestion.priceLabel || "Price unavailable"}</b><em>{match}% genre fit</em></span></span><i>{suggestion.recommendationCount}<Users aria-hidden="true" /></i></button>; }) : <p className="suggestion-empty">No games have been suggested yet. Close this view and add the first one.</p>}</div>
          {selected && <aside className="suggestion-details"><button type="button" className="suggestion-details-close" aria-label="Close game details" title="Close game details" onClick={() => setSelectedKey("")}><X aria-hidden="true" /></button><SteamArtwork item={{ appid: selected.appid || undefined, image: selected.imageUrl || undefined }} title={selected.title} className="suggestion-detail-art" /><div><span className="steam-label">Game details</span><h4>{selected.title}</h4><div className="suggestion-detail-stats"><span><b>{selected.priceLabel || "Unknown"}</b><small>Current AU price</small></span><span><b>{selected.reviewPercent !== null && selected.reviewPercent !== undefined ? `${selected.reviewPercent}%` : "Unknown"}</b><small>{selected.reviewSummary || "Review score"}</small></span><span><b>{selected.dlcCount ?? "Unknown"}</b><small>DLC on Store page</small></span><span><b>{suggestionMatch(selected, steam)}%</b><small>Genre-footprint fit</small></span></div>{selected.genres?.length ? <div className="suggestion-genres">{selected.genres.map((genre) => <span key={genre}>{genre}</span>)}</div> : null}<div className="suggestion-recommenders"><strong>Recommended by</strong><p>{selected.recommenders.join(", ")}</p></div>{selected.storeUrl && <a className="button primary" href={selected.storeUrl} target="_blank" rel="noopener noreferrer">Open Steam Store <ExternalLink aria-hidden="true" /></a>}</div></aside>}
        </div>
      </section></div>}
    </section>
  );
}

// Root dashboard component. Owns the merged `steam` state and orchestrates the layout:
// profile/stat column, "Currently Playing" + store watch, the insights deck, the Replay
// panel, and the scrolling store-radar marquee.
function SteamActivityDashboard() {
  const [steam, setSteam] = useState<SteamData>(steamFallback);
  const [watchIndex, setWatchIndex] = useState(0);
  const watch = useMemo(() => steam.preorderWatch || [], [steam.preorderWatch]);

  // On mount: (1) subscribe to a global "echoops:steam-data" event so other scripts/widgets
  // can push a fresh snapshot in, and (2) fetch data/steam.json (with a local-vs-deployed
  // fallback URL list) and merge it over the static fallback. A cache-busting query string
  // and an AbortController ensure a clean teardown if the component unmounts.
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

  // Rotates the single "Pre-Order / Top 20 watch" slot through the watch list every 6.5s.
  // Skips rotation when there's only one item or the user prefers reduced motion.
  useEffect(() => {
    setWatchIndex(0);
    if (watch.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setWatchIndex((value) => (value + 1) % watch.length), 6500);
    return () => window.clearInterval(timer);
  }, [watch]);

  // Build the stat tiles: start from the data file's stats, then append the computed
  // SteamDB account value as an extra tile when present.
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
          <SteamShowcaseStage steam={steam} />
        </div>
      </div>
      <SteamCommunityQueue steam={steam} />
      <SteamInsightsDeck steam={steam} />
      {steam.replay?.year && <SteamReplayPanel replay={steam.replay} />}
      {/* Store-radar marquee: the ticker list is duplicated so the CSS can loop seamlessly.
          The second copy is hidden from assistive tech and skipped via tabIndex. */}
      <div className="steam-store-strip"><span className="steam-label">Steam Store Radar</span><div className="store-marquee" aria-label="Steam store highlights"><div className="store-marquee-track">{[...ticker, ...ticker].map((item, index) => <a className="store-deal" key={`${item.appid || item.title}-${index}`} href={item.url || "https://store.steampowered.com/"} target="_blank" rel="noopener noreferrer" aria-hidden={index >= ticker.length || undefined} tabIndex={index >= ticker.length ? -1 : undefined}><span className="store-deal-tag">{item.tag || item.category || "Steam"}</span><span className="store-deal-title">{item.title || item.name}</span><span className="store-deal-price">{item.price || "Price TBA"}</span>{Boolean(item.discount) && <span className="store-deal-discount">{item.discount}% off</span>}</a>)}</div></div></div>
    </>
  );
}

// Entry point called by the loader once the dashboard island scrolls into view. Mounts the
// React tree into the target DOM node, wrapped in StrictMode and the IslandBoundary so any
// render error degrades to a standalone fallback message instead of crashing the page.
export function mountSteamActivityDashboard(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Steam activity dashboard"><SteamActivityDashboard /></IslandBoundary></StrictMode>);
}

/* TEST-ONLY EXPORTS */
export { PlaystyleView };

