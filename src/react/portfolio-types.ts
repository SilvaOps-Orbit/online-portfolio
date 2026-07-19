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
