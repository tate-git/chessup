// 내 정보 · 남의 프로필 · 랭킹
import { Hono } from 'hono';
import { z } from 'zod';
import { isVariantId } from '../../engine/variants';
import type { LeaderboardEntry, Me, Profile } from '../../shared/protocol';
import { recentGames, toSummary } from '../db/games';
import { loadRatings, toRatingsView, totalGames } from '../db/ratings';
import { findUserById, findUserByName, type UserRow } from '../db/users';
import type { AppEnv } from '../env';
import { notFound, unauthorized } from '../errors';
import { requireUser } from '../middleware';
import { parseQuery } from '../validation';

export const BEGINNER_GAME_LIMIT = 20;
const LEADERBOARD_MIN_GAMES = 10;

export async function meOf(db: D1Database, user: Pick<UserRow, 'id' | 'username' | 'created_at'>): Promise<Me> {
  const ratings = await loadRatings(db, user.id);
  return { username: user.username, createdAt: user.created_at, ratings: toRatingsView(ratings), beginner: totalGames(ratings) < BEGINNER_GAME_LIMIT };
}

const leaderboardQuery = z.object({
  variant: z.string().refine(isVariantId, '종목은 standard 또는 mini'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const userRoutes = new Hono<AppEnv>()
  .get('/me', requireUser, async context => {
    const user = await findUserById(context.env.DB, context.get('user').id);
    if (!user) throw unauthorized();
    return context.json(await meOf(context.env.DB, user));
  })
  .get('/users/:username', async context => {
    const user = await findUserByName(context.env.DB, context.req.param('username'));
    if (!user) throw notFound('사용자');
    const [ratings, games] = await Promise.all([loadRatings(context.env.DB, user.id), recentGames(context.env.DB, user.id)]);
    const profile: Profile = { username: user.username, createdAt: user.created_at, ratings: toRatingsView(ratings), recentGames: games.map(toSummary) };
    return context.json(profile);
  })
  .get('/leaderboard', async context => {
    const { variant, limit } = parseQuery(context, leaderboardQuery);
    const { results } = await context.env.DB
      .prepare(
        `SELECT u.username, r.rating, r.games FROM ratings r JOIN users u ON u.id = r.user_id
         WHERE r.variant = ? AND r.games >= ? ORDER BY r.rating DESC LIMIT ?`,
      )
      .bind(variant, LEADERBOARD_MIN_GAMES, limit)
      .all<{ username: string; rating: number; games: number }>();
    const entries: LeaderboardEntry[] = results.map((row, index) => ({ rank: index + 1, username: row.username, rating: Math.round(row.rating), games: row.games }));
    return context.json({ variant, entries });
  });
