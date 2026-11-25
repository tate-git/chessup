-- 판마다 양쪽 결과(회원·게스트 모두 · 취소된 판 없음) — 이번 주 랭킹(승점: 승 1 · 무 0.5) · 뜻은 docs/schema.md
CREATE TABLE match_results (
  game_id    TEXT NOT NULL,
  player_id  TEXT NOT NULL,   -- 회원 id 또는 guest-…(게스트 쿠키에서)
  name       TEXT NOT NULL,   -- 그 판 때 이름
  guest      INTEGER NOT NULL CHECK (guest IN (0, 1)),
  variant    TEXT NOT NULL,
  week_start TEXT NOT NULL,   -- 그 주 월요일(한국 날짜 YYYY-MM-DD)
  score      REAL NOT NULL CHECK (score IN (0, 0.5, 1)),
  ended_at   TEXT NOT NULL,
  PRIMARY KEY (game_id, player_id)
);
CREATE INDEX match_results_week ON match_results(variant, week_start);
CREATE INDEX match_results_player ON match_results(player_id);
