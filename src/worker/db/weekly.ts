// 이번 주 랭킹: 판마다 양쪽 결과를 남기고, 한국 월요일 0시부터 승점(승 1 · 무 0.5)을 더함 · 게스트 포함
import type { VariantId } from '../../engine/variants';
import type { GameResult, WeeklyEntry } from '../../shared/protocol';
import { koreaWeekStart } from '../../shared/week';

export { koreaWeekStart };


export interface ResultPlayer {
  readonly id: string;
  readonly name: string;
  readonly guest: boolean;
}

/** 대결 하나의 두 사람 결과(이미 있으면 그대로) · null(봇)은 빼고 */
export function resultStatements(
  db: D1Database,
  game: { id: string; variant: VariantId; result: GameResult; endedAt: string },
  white: ResultPlayer | null,
  black: ResultPlayer | null,
): D1PreparedStatement[] {
  const whiteScore = game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5;
  const week = koreaWeekStart(new Date(game.endedAt));
  const rows: [ResultPlayer | null, number][] = [[white, whiteScore], [black, 1 - whiteScore]];
  return rows.flatMap(([player, score]) => {
    if (!player) return [];
    const { id, name, guest } = player;
    return db
      .prepare(
        `INSERT INTO match_results (game_id, player_id, name, guest, variant, week_start, score, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(game.id, id, name, guest ? 1 : 0, game.variant, week, score, game.endedAt);
  });
}

interface WeeklyRow {
  readonly player_id: string;
  readonly name: string;
  readonly guest: number;
  readonly points: number;
  readonly games: number;
  readonly wins: number;
  readonly rank: number;
}

/** 승점 높은 순 · 같으면 같은 순위 · 이름은 그 주 마지막 판 때 이름 */
export async function weeklyLeaderboard(db: D1Database, variant: VariantId, week: string, viewerId: string | null, limit: number): Promise<WeeklyEntry[]> {
  const { results } = await db
    .prepare(
      `WITH totals AS (
         SELECT player_id, SUM(score) AS points, COUNT(*) AS games, SUM(score = 1) AS wins
         FROM match_results WHERE variant = ?1 AND week_start = ?2 GROUP BY player_id
       ), latest AS (
         SELECT player_id, name, guest, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY ended_at DESC) AS position
         FROM match_results WHERE variant = ?1 AND week_start = ?2
       )
       SELECT t.player_id, l.name, l.guest, t.points, t.games, t.wins, RANK() OVER (ORDER BY t.points DESC) AS rank
       FROM totals t JOIN latest l ON l.player_id = t.player_id AND l.position = 1
       ORDER BY t.points DESC, t.wins DESC, t.games, l.name
       LIMIT ?3`,
    )
    .bind(variant, week, limit)
    .all<WeeklyRow>();
  return results.map(row => ({
    rank: row.rank,
    username: row.name,
    guest: row.guest === 1,
    points: row.points,
    games: row.games,
    wins: row.wins,
    mine: row.player_id === viewerId,
  }));
}

/** 게스트가 가입하면 그동안의 결과를 회원 이름으로 이어받음 */
export function adoptGuestResults(db: D1Database, guestId: string, userId: string, username: string): D1PreparedStatement {
  return db.prepare('UPDATE match_results SET player_id = ?, name = ?, guest = 0 WHERE player_id = ?').bind(userId, username, guestId);
}
