// 서버 입구: /api/* 를 Hono 로 — 실시간(WebSocket)은 로비·대국방 Durable Object 로 넘김
import { Hono } from 'hono';
import { findPlayer, type Player } from './auth/guest';
import type { AppEnv } from './env';
import { ApiError } from './errors';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/games';
import { userRoutes } from './routes/me';
import { practiceRoutes } from './routes/practice';

export { GameRoom } from './live/game-room';
export { Lobby } from './live/lobby';

const app = new Hono<AppEnv>().basePath('/api');

app.route('/auth', authRoutes);
app.route('/', userRoutes);
app.route('/practice', practiceRoutes);

app.get('/lobby', async context => {
  const player = await findPlayer(context);
  if (!player) throw new ApiError(401, 'unauthorized', '로그인하거나 게스트로 시작해 주세요');
  const lobby = context.env.LOBBY.get(context.env.LOBBY.idFromName('main'));
  return lobby.fetch(withIdentity(context.req.raw, player));
});

app.get('/games/:id/live', async context => {
  const player = await findPlayer(context);
  const room = context.env.GAME_ROOM.get(context.env.GAME_ROOM.idFromName(context.req.param('id')));
  return room.fetch(withIdentity(context.req.raw, player));
});

app.route('/games', gameRoutes);

app.notFound(context => context.json({ error: { code: 'not_found', message: '없는 주소예요' } }, 404));
app.onError((error, context) => {
  if (error instanceof ApiError) return context.json({ error: { code: error.code, message: error.message } }, error.status);
  console.error(error);
  return context.json({ error: { code: 'invalid_input', message: '서버 오류' } }, 500);
});

/** 신원 머리글은 서버가 직접 채움(사용자가 보낸 값은 지움) · X-Member: 1 = 회원(레이팅 대국 가능) */
function withIdentity(request: Request, player: Player | null): Request {
  const headers = new Headers(request.headers);
  for (const name of ['X-User-Id', 'X-Username', 'X-Member']) headers.delete(name);
  if (player) {
    headers.set('X-User-Id', player.id);
    headers.set('X-Username', encodeURIComponent(player.username));
    headers.set('X-Member', player.member ? '1' : '0');
  }
  return new Request(request, { headers });
}

export default app;
