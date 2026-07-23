export interface LinkItem {
  label?: string;
  url?: string;
}

export interface SecurityItem {
  title?: string;
  body?: string;
  why?: string;
  docs?: LinkItem[];
}

export interface RoadmapAttribute {
  id?: string;
  title?: string;
  meaning?: string;
}

export interface RoadmapCalendar {
  region?: string;
  sourceNote?: string;
  studyDays?: number[];
  skipWeekends?: boolean;
  schoolTerms?: Array<{ label?: string; start?: string; end?: string }>;
  publicHolidays?: Array<string | { date?: string; name?: string }>;
  blockedDateRanges?: Array<{ start?: string; end?: string }>;
  blockedDates?: Array<string | { date?: string }>;
}

export interface RoadmapItem {
  id?: string;
  label?: string;
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  provider?: string;
  duration?: string;
  durationDays?: number;
  durationHours?: number;
  fullPrice?: number;
  amountPaid?: number | null;
  currency?: string;
  priceNote?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  completedDate?: string;
  courseUrl?: string;
  courseUrlLabel?: string;
  certificateUrl?: string;
  certificateImageUrl?: string;
  qualification?: string;
  evidenceLabel?: string;
  hideCertificate?: boolean;
  url?: string;
  optional?: boolean;
  courseIds?: string[];
  checklist?: RoadmapItem[];
  useStudyCalendar?: boolean;
  useSchoolTerms?: boolean;
  usePublicHolidays?: boolean;
  skipWeekends?: boolean;
  countWeekendPublicHolidays?: boolean;
  studyDays?: number[];
  publicHolidays?: RoadmapCalendar["publicHolidays"];
  blockedDateRanges?: RoadmapCalendar["blockedDateRanges"];
  blockedDates?: RoadmapCalendar["blockedDates"];
}

export interface CareerRoadmapConfig {
  goal?: string;
  target?: string;
  goalBadge?: string;
  badgeImageUrl?: string;
  motto?: { text?: string; translation?: string; meaning?: string };
  goalStatement?: string;
  summary?: string;
  targetDate?: string;
  lastUpdated?: string;
  educationCurrency?: string;
  studyCalendar?: RoadmapCalendar;
  commonAttributes?: RoadmapAttribute[];
  commonAttributesSequence?: string[];
  courses?: RoadmapItem[];
  milestones?: RoadmapItem[];
  readinessStandards?: Array<{ label?: string; value?: string }>;
}

export interface SteamItem {
  appid?: number;
  title?: string;
  name?: string;
  meta?: string;
  note?: string;
  image?: string;
  url?: string;
  price?: string;
  originalPrice?: string;
  discount?: number;
  tag?: string;
  category?: string;
  editions?: Array<string | { label?: string; name?: string; price?: string }>;
  playtimeMinutes?: number;
  recentMinutes?: number;
  genres?: string[];
  categories?: string[];
  controllerSupport?: string;
  achievementPercent?: number;
  dlcAvailable?: number;
}

export interface SteamInsights {
  ownedGames?: SteamItem[];
  recentGames?: SteamItem[];
  genreMix?: Array<{ label?: string; value?: number }>;
  playstyle?: Array<{ label?: string; value?: number; note?: string }>;
  rareAchievements?: SteamItem[];
  metadataSampleSize?: number;
  availableDlcCount?: number;
  dlcHeavyGames?: SteamItem[];
  averageHoursPerGame?: number;
  deepDiveGames?: number;
  lowPlaytimeGames?: number;
  retailEstimate?: {
    currency?: string;
    sampledGames?: number;
    pricedGames?: number;
    method?: string;
    highestGame?: SteamRetailGame | null;
    topGames?: SteamRetailGame[];
  };
}

export interface SteamRetailGame extends SteamItem {
  amount?: number;
  baseAmount?: number;
  dlcAmount?: number;
  confirmedDlcCount?: number;
  currency?: string;
}

export interface SteamSpending {
  currency?: string;
  totalSpent?: number | null;
  highestGame?: { title?: string; amount?: number | null; note?: string };
  games?: Array<{ title?: string; amount?: number | null; dlcCount?: number; note?: string }>;
}

export interface SteamReplayGame extends SteamItem {
  hours?: number;
  sessions?: number;
  playtimePercent?: number;
}

export interface SteamReplay {
  year?: number;
  generatedAt?: string;
  lastGoodAt?: string;
  stale?: boolean;
  status?: string;
  source?: string;
  sourceUrl?: string;
  totalHours?: number;
  totalSessions?: number;
  gamesPlayed?: number;
  newGames?: number;
  achievements?: number;
  rareAchievements?: number;
  longestStreak?: number;
  controllerPercent?: number;
  gamesPercentile?: number;
  achievementsPercentile?: number;
  streakPercentile?: number;
  topGames?: SteamReplayGame[];
}

// The full shape of the Steam dashboard's data model. This is what the static
// `window.PORTFOLIO_CONFIG.steam` fallback and the fetched `data/steam.json` snapshot both
// conform to. The dashboard reads lists (mostPlayed, achievements, completedGames, ...),
// a Replay year-in-review object, and a computed `insights` block.
export interface SteamData {
  summary?: string;
  status?: string;
  generatedAt?: string;
  lastGoodAt?: string;
  stale?: boolean;
  profileUrl?: string;
  steamDbUrl?: string;
  profile?: { personaName?: string; avatarFull?: string };
  accountValue?: { value?: string; note?: string; manual?: boolean };
  stats?: Array<{ label?: string; value?: string | number; note?: string }>;
  currentlyPlaying?: SteamItem[];
  mostPlayed?: SteamItem[];
  achievements?: SteamItem[];
  completedGames?: SteamItem[];
  storeHighlights?: SteamItem[];
  preorderWatch?: SteamItem[];
  replay?: SteamReplay;
  insights?: SteamInsights;
  spending?: SteamSpending;
}

export interface SpotifyItem {
  id?: string;
  title?: string;
  name?: string;
  meta?: string;
  note?: string;
  image?: string;
  url?: string;
  artists?: string[];
  albumTitle?: string;
  contextType?: string;
  contextTitle?: string;
  contextUrl?: string;
  genres?: string[];
  releaseDate?: string;
  durationMs?: number;
  playedAt?: string;
  popularity?: number;
  count?: number;
}

export interface SpotifyRange {
  artists?: SpotifyItem[];
  tracks?: SpotifyItem[];
}

export interface SpotifyInsights {
  taste?: Record<string, SpotifyRange>;
  recentlyPlayed?: SpotifyItem[];
  playlistAnalytics?: {
    playlistCount?: number;
    trackCount?: number;
    estimatedHours?: number;
    recurringArtists?: SpotifyItem[];
    genres?: Array<{ label?: string; value?: number }>;
    decades?: Array<{ label?: string; value?: number }>;
    sampledPlaylists?: number;
    sampledTracks?: number;
  };
  discovery?: SpotifyItem[];
  scopesReady?: boolean;
}

export interface SpotifyData {
  summary?: string;
  status?: string;
  generatedAt?: string;
  lastGoodAt?: string;
  stale?: boolean;
  profile?: { id?: string; displayName?: string; url?: string; image?: string };
  current?: SpotifyItem & Record<string, unknown>;
  lastTrack?: SpotifyItem & Record<string, unknown>;
  playlists?: SpotifyItem[];
  insights?: SpotifyInsights;
}

export interface GitHubRepository {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  homepage?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  size?: number;
  updated_at?: string;
  has_pages?: boolean;
  has_issues?: boolean;
  archived?: boolean;
  fork?: boolean;
}

export interface GitHubSnapshot {
  generatedAt?: string;
  lastGoodAt?: string;
  status?: string;
  stale?: boolean;
  repositories?: GitHubRepository[];
  events?: Array<{ created_at?: string }>;
  languagesByRepo?: Record<string, Record<string, number>>;
}

export interface PortfolioConfig {
  profile?: { githubUsername?: string };
  careerRoadmap?: CareerRoadmapConfig;
  steam?: SteamData;
  spotify?: SpotifyData;
  security?: SecurityItem[];
  securitySnapshot?: { label?: string; posture?: string; summary?: string };
  githubRepoTechnologies?: Record<string, string[]>;
  analytics?: {
    endpoint?: string;
    refreshMs?: number;
    provider?: string;
  };
}

declare global {
  interface Window {
    PORTFOLIO_CONFIG?: PortfolioConfig;
  }
}

export function getPortfolioConfig(): PortfolioConfig {
  return window.PORTFOLIO_CONFIG || {};
}
