// 봇 연습 기록 · 힌트(누구나 한 판 3번 · 기록은 서버에 남김, 한국 날짜도 같이)
import { Hono } from 'hono';
import { z } from 'zod';
import { isVariantId } from '../../engine/variants';
import { HINTS_PER_GAME, type HintAllowance } from '../../shared/protocol';
import { countHints, loadClears, recordHint, saveClear } from '../db/practice';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { requireUser } from '../middleware';
import { parseBody } from '../validation';

const koreaDay = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

const clearSchema = z.object({
  variant: z.string().refine(isVariantId),
  level: z.number().int().min(1).max(10),
  assisted: z.boolean().default(false),
});
const hintSchema = z.object({ practiceGameId: z.string().min(1).max(64) });

export const practiceRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', async context => context.json(await loadClears(context.env.DB, context.get('user').id)))
  .post('/clears', async context => {
    const { variant, level, assisted } = await parseBody(context, clearSchema);
    await saveClear(context.env.DB, context.get('user').id, variant, level, assisted);
    return context.json(await loadClears(context.env.DB, context.get('user').id));
  })
  .post('/hints', async context => {
    const { practiceGameId } = await parseBody(context, hintSchema);
    const userId = context.get('user').id;
    const used = await countHints(context.env.DB, userId, practiceGameId);
    if (used >= HINTS_PER_GAME) throw new ApiError(429, 'no_hints_left', '이 판의 힌트를 다 썼어요');
    await recordHint(context.env.DB, userId, koreaDay(), practiceGameId);
    return context.json<HintAllowance>({ remaining: HINTS_PER_GAME - used - 1 });
  });
