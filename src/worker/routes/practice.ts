// 봇 연습 기록 · 힌트(초보 = 사람 대국 20판 미만 → 한 판 1번 · 그 외 하루 1번, 한국 날짜)
import { Hono } from 'hono';
import { z } from 'zod';
import { isVariantId } from '../../engine/variants';
import type { HintAllowance, PracticeState } from '../../shared/protocol';
import { countHints, loadClears, recordHint, saveClear } from '../db/practice';
import { loadRatings, totalGames } from '../db/ratings';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { requireUser } from '../middleware';
import { parseBody } from '../validation';
import { BEGINNER_GAME_LIMIT } from './me';

const HINTS_PER_SCOPE = 1;
const koreaDay = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

async function hintAllowance(db: D1Database, userId: string, practiceGameId?: string): Promise<HintAllowance> {
  const beginner = totalGames(await loadRatings(db, userId)) < BEGINNER_GAME_LIMIT;
  const used = await countHints(db, userId, koreaDay(), beginner ? practiceGameId ?? '' : undefined);
  return { remaining: Math.max(0, HINTS_PER_SCOPE - used), scope: beginner ? 'game' : 'day' };
}

async function practiceState(db: D1Database, userId: string): Promise<PracticeState> {
  const [cleared, hints] = await Promise.all([loadClears(db, userId), hintAllowance(db, userId)]);
  return { cleared, hints };
}

const clearSchema = z.object({ variant: z.string().refine(isVariantId), level: z.number().int().min(1).max(10) });
const hintSchema = z.object({ practiceGameId: z.string().min(1).max(64) });

export const practiceRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', async context => context.json(await practiceState(context.env.DB, context.get('user').id)))
  .post('/clears', async context => {
    const { variant, level } = await parseBody(context, clearSchema);
    await saveClear(context.env.DB, context.get('user').id, variant, level);
    return context.json(await practiceState(context.env.DB, context.get('user').id));
  })
  .post('/hints', async context => {
    const { practiceGameId } = await parseBody(context, hintSchema);
    const userId = context.get('user').id;
    const allowance = await hintAllowance(context.env.DB, userId, practiceGameId);
    if (allowance.remaining <= 0) throw new ApiError(429, 'no_hints_left', '남은 힌트가 없어요');
    await recordHint(context.env.DB, userId, koreaDay(), practiceGameId);
    return context.json<HintAllowance>({ ...allowance, remaining: allowance.remaining - 1 });
  });
