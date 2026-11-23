// 로그인 확인: 세션 쿠키 → context.get('user')
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { findSessionUser, SESSION_COOKIE } from './auth/session';
import type { AppEnv } from './env';
import { unauthorized } from './errors';

export const requireUser = createMiddleware<AppEnv>(async (context, next) => {
  const user = await findSessionUser(context.env.DB, getCookie(context, SESSION_COOKIE));
  if (!user) throw unauthorized();
  context.set('user', user);
  await next();
});
