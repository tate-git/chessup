// 끝난 대국 표
import type { VariantId } from '../../engine/variants';
import type { EndReason, GameRecord, GameResult, GameSummary, TimeControl } from '../../shared/protocol';

export interface GameRow {
  readonly id: string;
  readonly variant: VariantId;
  readonly time_control: TimeControl;
  readonly white_id: string;
  readonly black_id: string;
  readonly white_name: string;
  readonly black_name: string;
  readonly result: GameResult;
  readonly reason: EndReason;
  readonly moves: string;
  readonly white_rating: number;
  readonly black_rating: number;
  readonly white_change: number;
  readonly black_change: number;
  readonly started_at: string;
  readonly ended_at: string;
}

const SELECT_GAME = `
  SELECT g.*, w.username AS white_name, b.username AS black_name
  FROM games g JOIN users w ON w.id = g.white_id JOIN users b ON b.id = g.black_id`;

export function insertGameStatement(db: D1Database, game: Omit<GameRow, 'white_name' | 'black_name'>): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO games (id, variant, time_control, white_id, black_id, result, reason, moves,
         white_rating, black_rating, white_change, black_change, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      game.id, game.variant, game.time_control, game.white_id, game.black_id, game.result, game.reason, game.moves,
      game.white_rating, game.black_rating, game.white_change, game.black_change, game.started_at, game.ended_at,
    );
}

export function findGame(db: D1Database, id: string): Promise<GameRow | null> {
  return db.prepare(`${SELECT_GAME} WHERE g.id = ?`).bind(id).first<GameRow>();
}

export async function recentGames(db: D1Database, userId: string, limit = 20): Promise<GameRow[]> {
  const { results } = await db
    .prepare(`${SELECT_GAME} WHERE g.white_id = ? OR g.black_id = ? ORDER BY g.ended_at DESC LIMIT ?`)
    .bind(userId, userId, limit)
    .all<GameRow>();
  return results;
}

export function toSummary(row: GameRow): GameSummary {
  return {
    id: row.id,
    variant: row.variant,
    timeControl: row.time_control,
    white: { username: row.white_name, rating: row.white_rating, ratingChange: row.white_change },
    black: { username: row.black_name, rating: row.black_rating, ratingChange: row.black_change },
    result: row.result,
    reason: row.reason,
    endedAt: row.ended_at,
  };
}

export function toRecord(row: GameRow): GameRecord {
  return { ...toSummary(row), moves: row.moves ? row.moves.split(' ') : [], startedAt: row.started_at };
}
