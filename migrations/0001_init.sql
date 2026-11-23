-- 체스업 첫 구조(D1 · SQLite) — 뜻은 docs/schema.md
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  username_key  TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE ratings (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant    TEXT NOT NULL CHECK (variant IN ('standard', 'mini')),
  rating     REAL NOT NULL DEFAULT 1500,
  deviation  REAL NOT NULL DEFAULT 350,
  volatility REAL NOT NULL DEFAULT 0.06,
  games      INTEGER NOT NULL DEFAULT 0,
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0,
  draws      INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, variant)
);
CREATE INDEX ratings_leaderboard ON ratings(variant, rating DESC);

CREATE TABLE games (
  id           TEXT PRIMARY KEY,
  variant      TEXT NOT NULL,
  time_control TEXT NOT NULL,
  white_id     TEXT NOT NULL REFERENCES users(id),
  black_id     TEXT NOT NULL REFERENCES users(id),
  result       TEXT NOT NULL,
  reason       TEXT NOT NULL,
  moves        TEXT NOT NULL,
  white_rating INTEGER NOT NULL,
  black_rating INTEGER NOT NULL,
  white_change INTEGER NOT NULL,
  black_change INTEGER NOT NULL,
  started_at   TEXT NOT NULL,
  ended_at     TEXT NOT NULL
);
CREATE INDEX games_white ON games(white_id, ended_at DESC);
CREATE INDEX games_black ON games(black_id, ended_at DESC);

CREATE TABLE practice_clears (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  level   INTEGER NOT NULL,
  PRIMARY KEY (user_id, variant)
);

CREATE TABLE hint_uses (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day              TEXT NOT NULL,
  practice_game_id TEXT NOT NULL,
  used_at          TEXT NOT NULL
);
CREATE INDEX hint_uses_day ON hint_uses(user_id, day);

CREATE TABLE login_failures (
  key          TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL
);
