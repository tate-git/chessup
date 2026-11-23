// 서버 입구: /api/* 를 Hono 로 — 실시간(WebSocket)은 로비·대국방 Durable Object 로 넘김
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { findSessionUser, SESSION_COOKIE } from './auth/session';
import type { AppEnv } from './env';
import { ApiError } from './errors';
import { requireUser } from './middleware';
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

app.get('/lobby', requireUser, context => {
  const user = context.get('user');
  const lobby = context.env.LOBBY.get(context.env.LOBBY.idFromName('main'));
  return lobby.fetch(withIdentity(context.req.raw, user.id, user.username));
});

app.get('/games/:id/live', async context => {
  const user = await findSessionUser(context.env.DB, getCookie(context, SESSION_COOKIE));
  const room = context.env.GAME_ROOM.get(context.env.GAME_ROOM.idFromName(context.req.param('id')));
  return room.fetch(withIdentity(context.req.raw, user?.id, user?.username));
});

app.route('/games', gameRoutes);

app.notFound(context => context.json({ error: { code: 'not_found', message: '없는 주소예요' } }, 404));
app.onError((error, context) => {
  if (error instanceof ApiError) return context.json({ error: { code: error.code, message: error.message } }, error.status);
  console.error(error);
  return context.json({ error: { code: 'invalid_input', message: '서버 오류' } }, 500);
});

/** 신원 머리글은 서버가 직접 채움(사용자가 보낸 값은 지움) */
function withIdentity(request: Request, userId?: string, username?: string): Request {
  const headers = new Headers(request.headers);
  headers.delete('X-User-Id');
  headers.delete('X-Username');
  if (userId && username) {
    headers.set('X-User-Id', userId);
    headers.set('X-Username', username);
  }
  return new Request(request, { headers });
}

export default app;
