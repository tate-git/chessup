-- 판마다 양쪽 결과(회원·게스트) — 이번 주 랭킹 · D1 의 migrations/0003_match_results.sql 과 같음
CREATE TABLE match_results (
  game_id    uuid NOT NULL,
  player_id  text NOT NULL,
  name       text NOT NULL,
  guest      boolean NOT NULL,
  variant    text NOT NULL,
  week_start date NOT NULL,
  score      double precision NOT NULL CHECK (score IN (0, 0.5, 1)),
  ended_at   timestamptz NOT NULL,
  PRIMARY KEY (game_id, player_id)
);
CREATE INDEX match_results_week ON match_results (variant, week_start);
CREATE INDEX match_results_player ON match_results (player_id);
