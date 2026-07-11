import { StrictMode, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";
import type { GitHubRepository, GitHubSnapshot } from "./portfolio-types";
import { getPortfolioConfig } from "./portfolio-types";

interface LanguageStat { language: string; value: number; percent: number; }
interface LanguageData { stats: LanguageStat[]; byRepo: Map<string, LanguageStat[]>; }
interface GitHubCache { username: string; checkedAt: number; nextCheckAt: number; repositories: GitHubRepository[]; }

const CACHE_KEY = "echoops:github-hourly-v2";
const HOUR = 60 * 60 * 1000;

function repoKey(repo: GitHubRepository): string { return repo.full_name || repo.name || ""; }
function formatDate(value?: string | number): string {
  if (!value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function totalsToStats(entries: Iterable<[string, number]>): LanguageStat[] {
  const values = Array.from(entries).filter(([, value]) => Number(value) > 0).sort((a, b) => b[1] - a[1]);
  const total = values.reduce((sum, [, value]) => sum + value, 0) || 1;
  return values.map(([language, value]) => ({ language, value, percent: (value / total) * 100 }));
}
function languageData(repositories: GitHubRepository[], snapshot: GitHubSnapshot): LanguageData {
  const totals = new Map<string, number>();
  const byRepo = new Map<string, LanguageStat[]>();
  repositories.filter((repo) => !repo.fork).forEach((repo) => {
    const languages = snapshot.languagesByRepo?.[repoKey(repo)] || snapshot.languagesByRepo?.[repo.name || ""];
    const entries = Object.entries(languages || {});
    const resolved = entries.length ? entries : [[repo.language || "Other", Math.max(repo.size || 1, 1)] as [string, number]];
    resolved.forEach(([language, bytes]) => totals.set(language, (totals.get(language) || 0) + Number(bytes || 0)));
    byRepo.set(repoKey(repo), totalsToStats(resolved));
  });
  return { stats: totalsToStats(totals).slice(0, 8), byRepo };
}
function mergeRepositories(snapshot: GitHubRepository[], live: GitHubRepository[]): GitHubRepository[] {
  const map = new Map(snapshot.map((repo) => [repoKey(repo), repo]));
  live.forEach((repo) => map.set(repoKey(repo), { ...(map.get(repoKey(repo)) || {}), ...repo }));
  return Array.from(map.values());
}
function readCache(username: string): GitHubCache | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as GitHubCache | null;
    return value?.username === username && Array.isArray(value.repositories) ? value : null;
  } catch { return null; }
}
function dateKey(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function activityLevel(count: number, max: number): number {
  if (!count) return 0;
  const ratio = count / Math.max(max, 1);
  return ratio >= .76 ? 4 : ratio >= .5 ? 3 : ratio >= .25 ? 2 : 1;
}

function LanguageMix({ data }: { data: LanguageData }) {
  return <article className="github-insight-card"><div className="github-insight-heading"><span className="repo-badge">Language mix</span><h3>Code I keep reaching for</h3></div>{data.stats.length ? <><div className="language-mix-bar">{data.stats.map((item, index) => <span key={item.language} className={`language-segment language-${index + 1}`} style={{ width: `${Math.max(item.percent, 2).toFixed(2)}%` }} title={`${item.language}: ${item.percent.toFixed(1)}%`} />)}</div><div className="language-mix-list">{data.stats.map((item, index) => <div className="language-row" key={item.language}><span className={`language-dot language-${index + 1}`} /><span className="language-name">{item.language}</span><strong>{item.percent.toFixed(1)}%</strong></div>)}</div></> : <p className="github-insight-note">No public language data returned yet.</p>}<p className="github-insight-note">Summed from each public non-fork repository's language snapshot.</p></article>;
}

function ContributionPulse({ events, username }: { events: GitHubSnapshot["events"]; username: string }) {
  const counts = new Map<string, number>();
  (events || []).forEach((event) => { const key = dateKey(event.created_at || ""); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 364); start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) days.push(new Date(cursor));
  const max = Math.max(1, ...counts.values());
  const weeks = Math.ceil(days.length / 7);
  const months: Array<{ name: string; column: number }> = [];
  let previous = "";
  days.forEach((day, index) => { const month = day.toLocaleString("en-AU", { month: "short" }); if (month !== previous && day.getDate() <= 7) { months.push({ name: month, column: Math.floor(index / 7) + 1 }); previous = month; } });
  return <article className="github-insight-card github-activity-card"><div className="github-insight-heading"><span className="repo-badge">Public activity</span><h3>Contribution pulse</h3></div><div className="activity-months" style={{ "--github-weeks": weeks } as CSSProperties}>{months.map((month) => <span key={`${month.name}-${month.column}`} style={{ gridColumn: month.column }}>{month.name}</span>)}</div><div className="activity-grid" style={{ "--github-weeks": weeks } as CSSProperties}>{days.map((day, index) => { const count = counts.get(dateKey(day)) || 0; const title = `${count} public GitHub event${count === 1 ? "" : "s"} on ${day.toLocaleDateString("en-AU")}`; return <span key={dateKey(day)} className={`activity-cell level-${activityLevel(count, max)}`} style={{ gridColumn: Math.floor(index / 7) + 1, gridRow: day.getDay() + 1 }} title={title} aria-label={title} />; })}</div><div className="activity-legend"><span>Less</span>{[0,1,2,3,4].map((level) => <span key={level} className={`activity-cell level-${level}`} />)}<span>More</span></div><p className="github-insight-note">Uses public GitHub events only; private commits and hidden activity are not requested.</p><a className="text-link" href={`https://github.com/${encodeURIComponent(username)}`} target="_blank" rel="noopener noreferrer">Open GitHub contribution graph</a></article>;
}

function RepositoryCard({ repo, languages, technologies }: { repo: GitHubRepository; languages?: LanguageStat[]; technologies?: string[] }) {
  const detected = (languages?.length ? languages : repo.language ? [{ language: repo.language, percent: 100 }] : []).map((item) => `${item.language} ${item.percent.toFixed(1)}%`);
  const labels = [...detected, ...(technologies || [])].filter((label, index, values) => values.findIndex((candidate) => candidate.replace(/\s+\d+(?:\.\d+)?%$/, "").toLowerCase() === label.replace(/\s+\d+(?:\.\d+)?%$/, "").toLowerCase()) === index);
  const featured = repo.name === "online-portfolio";
  return <article className={`repo-card${featured ? " is-featured" : ""}`}><div className="repo-card-header"><h3><a href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.name || "Repository"}</a></h3>{featured && <span className="repo-badge">Featured</span>}</div><p className="repo-description">{repo.description || "Public repository"}</p><div className="repo-language-stack">{labels.map((label) => <button type="button" className="is-language" key={label} aria-label={`Technology signal ${label}`}>{label}</button>)}</div><div className="repo-meta"><span>{repo.stargazers_count || 0} stars</span><span>{repo.forks_count || 0} forks</span><span>{repo.open_issues_count || 0} open issues</span><span>Updated {formatDate(repo.updated_at)}</span>{repo.has_pages && <span className="is-live">GitHub Pages</span>}</div>{Boolean(repo.topics?.length) && <div className="repo-topics">{repo.topics?.slice(0,5).map((topic) => <span key={topic}>{topic}</span>)}</div>}<p className="repo-security-note">Snapshot metadata stays primary. The token-free browser check runs at most once per hour.</p><div className="repo-links"><a className="text-link" href={repo.html_url} target="_blank" rel="noopener noreferrer">Source</a>{repo.homepage && <a className="text-link" href={repo.homepage} target="_blank" rel="noopener noreferrer">Demo</a>}{repo.has_issues && <a className="text-link" href={`${repo.html_url}/issues`} target="_blank" rel="noopener noreferrer">Issues</a>}</div></article>;
}

function GitHubInsightsDashboard() {
  const config = getPortfolioConfig();
  const username = config.profile?.githubUsername || "";
  const [snapshot, setSnapshot] = useState<GitHubSnapshot | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [status, setStatus] = useState("Loading the primary GitHub Actions snapshot...");

  useEffect(() => {
    if (!username) { setStatus("Add githubUsername in portfolio.config.js to load repositories."); return; }
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`data/github.json?v=${Date.now()}`, { cache: "no-cache", credentials: "same-origin", referrerPolicy: "no-referrer", signal: controller.signal });
        if (!response.ok) throw new Error(`Snapshot returned ${response.status}`);
        const next = await response.json() as GitHubSnapshot;
        const base = (next.repositories || []).filter((repo) => !repo.fork);
        const cache = readCache(username);
        const current = cache && cache.nextCheckAt > Date.now();
        setSnapshot(next);
        setRepositories(current ? mergeRepositories(base, cache.repositories) : base);
        setStatus(current ? `Actions snapshot plus hourly public GitHub check from ${formatDate(cache.checkedAt)}.` : next.status || "GitHub Actions snapshot loaded.");
        if (!current) {
          try {
            const api = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&direction=desc&per_page=100&type=owner`, { cache: "no-store", headers: { Accept: "application/vnd.github+json" }, referrerPolicy: "no-referrer", signal: controller.signal });
            if (!api.ok) throw new Error(`GitHub returned ${api.status}`);
            const live = (await api.json() as GitHubRepository[]).filter((repo) => !repo.fork);
            const value: GitHubCache = { username, repositories: live, checkedAt: Date.now(), nextCheckAt: Date.now() + HOUR };
            localStorage.setItem(CACHE_KEY, JSON.stringify(value));
            setRepositories(mergeRepositories(base, live));
            setStatus("Actions snapshot loaded; public repository metadata refreshed in the browser for the next hour.");
          } catch (error) {
            if (!controller.signal.aborted) setStatus("The hourly GitHub check is unavailable; the last Actions snapshot remains active.");
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus("The GitHub snapshot could not be reached. No private token was sent from the browser.");
      }
    }
    void load();
    return () => controller.abort();
  }, [username]);

  const publicRepos = useMemo(() => repositories.filter((repo) => !repo.fork), [repositories]);
  const languages = useMemo(() => languageData(publicRepos, snapshot || {}), [publicRepos, snapshot]);
  const visible = [...publicRepos].sort((a, b) => (a.name === "online-portfolio" ? -1 : b.name === "online-portfolio" ? 1 : new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())).slice(0, 6);
  return <><p className="github-status">{status}</p><div className="github-insights" aria-live="polite"><LanguageMix data={languages} /><ContributionPulse events={snapshot?.events} username={username} /></div><div className="repo-grid" id="repo-grid" aria-live="polite">{visible.map((repo) => <RepositoryCard key={repoKey(repo)} repo={repo} languages={languages.byRepo.get(repoKey(repo))} technologies={config.githubRepoTechnologies?.[repo.name || ""]} />)}</div></>;
}

export function mountGitHubInsightsDashboard(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="GitHub insights dashboard"><GitHubInsightsDashboard /></IslandBoundary></StrictMode>);
}
