-- 봇 격파: 힌트·무르기 없이 깬 최고 단계 — D1 의 migrations/0002_practice_unassisted.sql 과 같음
ALTER TABLE practice_clears ADD COLUMN unassisted_level integer NOT NULL DEFAULT 0;
UPDATE practice_clears SET unassisted_level = level;
