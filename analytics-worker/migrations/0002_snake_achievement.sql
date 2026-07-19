CREATE TABLE achievements_next (
  visitor_hash TEXT NOT NULL,
  achievement_id TEXT NOT NULL CHECK (achievement_id IN ('console', 'integrity', 'architecture', 'snake')),
  discovered_at TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, achievement_id)
);

INSERT OR IGNORE INTO achievements_next (visitor_hash, achievement_id, discovered_at)
SELECT visitor_hash, achievement_id, discovered_at FROM achievements;

DROP TABLE achievements;
ALTER TABLE achievements_next RENAME TO achievements;
CREATE INDEX IF NOT EXISTS idx_achievements_id ON achievements(achievement_id);

UPDATE visitors SET completed_vault = 0;
UPDATE visitors
SET completed_vault = 1
WHERE visitor_hash IN (
  SELECT visitor_hash
  FROM achievements
  GROUP BY visitor_hash
  HAVING COUNT(*) >= 4
);
