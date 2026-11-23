// 끝난 대국 보기
import { Hono } from 'hono';
import { findGame, toRecord } from '../db/games';
import type { AppEnv } from '../env';
import { notFound } from '../errors';

export const gameRoutes = new Hono<AppEnv>().get('/:id', async context => {
  const game = await findGame(context.env.DB, context.req.param('id'));
  if (!game) throw notFound('대국');
  return context.json(toRecord(game));
});
