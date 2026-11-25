-- 봇 격파: 힌트·무르기 없이 깬 최고 단계(도움 받고 깨면 level 만 오름) · 예전 기록은 도움 없이 깬 것으로 봄
ALTER TABLE practice_clears ADD COLUMN unassisted_level INTEGER NOT NULL DEFAULT 0;
UPDATE practice_clears SET unassisted_level = level;
