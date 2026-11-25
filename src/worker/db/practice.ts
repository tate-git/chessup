// 봇 연습 기록 · 힌트 쓴 기록
import type { VariantId } from '../../engine/variants';
import type { PracticeState } from '../../shared/protocol';

interface ClearRow {
  readonly variant: VariantId;
  readonly level: number;
  readonly unassisted_level: number;
}

export async function loadClears(db: D1Database, userId: string): Promise<PracticeState> {
  const { results } = await db.prepare('SELECT variant, level, unassisted_level FROM practice_clears WHERE user_id = ?').bind(userId).all<ClearRow>();
  const row = (variant: VariantId) => results.find(item => item.variant === variant);
  return {
    cleared: { standard: row('standard')?.level ?? 0, mini: row('mini')?.level ?? 0 },
    unassisted: { standard: row('standard')?.unassisted_level ?? 0, mini: row('mini')?.unassisted_level ?? 0 },
  };
}

/** 최고 단계만 남김 · 도움 받고 깼으면 「도움 없이」 단계는 그대로 */
export function saveClear(db: D1Database, userId: string, variant: VariantId, level: number, assisted: boolean): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO practice_clears (user_id, variant, level, unassisted_level) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, variant) DO UPDATE SET
         level = MAX(level, excluded.level),
         unassisted_level = MAX(unassisted_level, excluded.unassisted_level)`,
    )
    .bind(userId, variant, level, assisted ? 0 : level)
    .run();
}

export async function countHints(db: D1Database, userId: string, practiceGameId: string): Promise<number> {
  const used = await db.prepare('SELECT COUNT(*) AS used FROM hint_uses WHERE user_id = ? AND practice_game_id = ?').bind(userId, practiceGameId).first<number>('used');
  return used ?? 0;
}

export function recordHint(db: D1Database, userId: string, day: string, practiceGameId: string): Promise<D1Result> {
  return db.prepare('INSERT INTO hint_uses (user_id, day, practice_game_id, used_at) VALUES (?, ?, ?, ?)').bind(userId, day, practiceGameId, new Date().toISOString()).run();
}
