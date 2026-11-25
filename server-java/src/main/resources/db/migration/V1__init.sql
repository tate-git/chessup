-- 체스업 첫 구조(PostgreSQL) — D1 의 migrations/0001_init.sql 과 표·칸 이름이 같음 · 뜻은 docs/schema.md
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  username      text NOT NULL,
  username_key  text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE ratings (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  variant    text NOT NULL CHECK (variant IN ('standard', 'mini')),
  rating     double precision NOT NULL DEFAULT 1500,
  deviation  double precision NOT NULL DEFAULT 350,
  volatility double precision NOT NULL DEFAULT 0.06,
  games      integer NOT NULL DEFAULT 0,
  wins       integer NOT NULL DEFAULT 0,
  losses     integer NOT NULL DEFAULT 0,
  draws      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, variant)
);
CREATE INDEX ratings_leaderboard ON ratings (variant, rating DESC);

CREATE TABLE games (
  id           uuid PRIMARY KEY,
  variant      text NOT NULL,
  time_control text NOT NULL,
  white_id     uuid NOT NULL REFERENCES users (id),
  black_id     uuid NOT NULL REFERENCES users (id),
  result       text NOT NULL,
  reason       text NOT NULL,
  moves        text NOT NULL,
  white_rating integer NOT NULL,
  black_rating integer NOT NULL,
  white_change integer NOT NULL,
  black_change integer NOT NULL,
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz NOT NULL
);
CREATE INDEX games_white ON games (white_id, ended_at DESC);
CREATE INDEX games_black ON games (black_id, ended_at DESC);

CREATE TABLE practice_clears (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  variant text NOT NULL,
  level   integer NOT NULL,
  PRIMARY KEY (user_id, variant)
);

CREATE TABLE hint_uses (
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day              date NOT NULL,
  practice_game_id text NOT NULL,
  used_at          timestamptz NOT NULL
);
CREATE INDEX hint_uses_day ON hint_uses (user_id, day);

CREATE TABLE login_failures (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL
);
