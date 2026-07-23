CREATE TABLE IF NOT EXISTS game_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  steam_app_id INTEGER,
  title TEXT NOT NULL,
  username TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1 CHECK (is_anonymous IN (0, 1)),
  recommender_hash TEXT NOT NULL,
  price_cents INTEGER,
  price_label TEXT,
  currency TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  dlc_count INTEGER,
  review_percent REAL,
  review_count INTEGER,
  review_summary TEXT,
  image_url TEXT,
  store_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(game_key, recommender_hash)
);

CREATE INDEX IF NOT EXISTS idx_game_suggestions_key ON game_suggestions(game_key);
CREATE INDEX IF NOT EXISTS idx_game_suggestions_updated ON game_suggestions(updated_at DESC);

CREATE TABLE IF NOT EXISTS suggestion_rate_limits (
  requester_hash TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (requester_hash, hour_bucket)
);
