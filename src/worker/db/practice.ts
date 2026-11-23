// 봇 연습 기록 · 힌트 쓴 기록
import type { VariantId } from '../../engine/variants';

export async function loadClears(db: D1Database, userId: string): Promise<Record<VariantId, number>> {
  const { results } = await db.prepare('SELECT variant, level FROM practice_clears WHERE user_id = ?').bind(userId).all<{ variant: VariantId; level: number }>();
  const level = (variant: VariantId) => results.find(row => row.variant === variant)?.level ?? 0;
  return { standard: level('standard'), mini: level('mini') };
}

export function saveClear(db: D1Database, userId: string, variant: VariantId, level: number): Promise<D1Result> {
  return db
    .prepare('INSERT INTO practice_clears (user_id, variant, level) VALUES (?, ?, ?) ON CONFLICT (user_id, variant) DO UPDATE SET level = MAX(level, excluded.level)')
    .bind(userId, variant, level)
    .run();
}

export async function countHints(db: D1Database, userId: string, day: string, practiceGameId?: string): Promise<number> {
  const query = practiceGameId
    ? db.prepare('SELECT COUNT(*) AS used FROM hint_uses WHERE user_id = ? AND practice_game_id = ?').bind(userId, practiceGameId)
    : db.prepare('SELECT COUNT(*) AS used FROM hint_uses WHERE user_id = ? AND day = ?').bind(userId, day);
  return (await query.first<number>('used')) ?? 0;
}

export function recordHint(db: D1Database, userId: string, day: string, practiceGameId: string): Promise<D1Result> {
  return db.prepare('INSERT INTO hint_uses (user_id, day, practice_game_id, used_at) VALUES (?, ?, ?, ?)').bind(userId, day, practiceGameId, new Date().toISOString()).run();
}
