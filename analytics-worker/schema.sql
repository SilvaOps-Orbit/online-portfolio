CREATE TABLE IF NOT EXISTS visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  browser TEXT NOT NULL,
  device TEXT NOT NULL,
  is_egg_finder INTEGER NOT NULL DEFAULT 0 CHECK (is_egg_finder IN (0, 1)),
  completed_vault INTEGER NOT NULL DEFAULT 0 CHECK (completed_vault IN (0, 1))
);

CREATE TABLE IF NOT EXISTS daily_views (
  visitor_hash TEXT NOT NULL,
  view_date TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, view_date)
);

CREATE TABLE IF NOT EXISTS achievements (
  visitor_hash TEXT NOT NULL,
  achievement_id TEXT NOT NULL CHECK (achievement_id IN ('console', 'integrity', 'architecture', 'snake')),
  discovered_at TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_visitors_browser ON visitors(browser);
CREATE INDEX IF NOT EXISTS idx_visitors_device ON visitors(device);
CREATE INDEX IF NOT EXISTS idx_achievements_id ON achievements(achievement_id);
