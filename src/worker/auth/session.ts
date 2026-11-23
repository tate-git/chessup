// 세션: 쿠키엔 토큰, DB 엔 SHA-256 해시만 · 30일
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, SessionUser } from '../env';
import { randomToken, sha256 } from './encoding';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export async function startSession(context: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await context.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now.toISOString(), expires.toISOString())
    .run();
  setCookie(context, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(context.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(context: Context<AppEnv>): Promise<void> {
  const token = getCookie(context, SESSION_COOKIE);
  if (token) await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  deleteCookie(context, SESSION_COOKIE, { path: '/' });
}

/** 쿠키 → 로그인한 사람(없거나 만료면 null) */
export async function findSessionUser(db: D1Database, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  return db
    .prepare('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256(token), new Date().toISOString())
    .first<SessionUser>();
}
