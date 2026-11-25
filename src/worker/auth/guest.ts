// 게스트(가입 없이 친선 대국만): 쿠키에 무작위 토큰 · id·이름은 토큰 해시에서 만들어 DB 에 저장하지 않음
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { findSessionUser, SESSION_COOKIE } from './session';
import { fromBase64Url, randomToken, sha256 } from './encoding';

export const GUEST_COOKIE = 'gid';
const GUEST_DAYS = 30;

/** 대국에 앉는 사람: 회원이면 레이팅 대국 가능, 게스트는 친선만 */
export interface Player {
  readonly id: string;
  readonly username: string;
  readonly member: boolean;
}

async function guestOf(token: string): Promise<Player> {
  const hash = await sha256(`guest:${token}`);
  const bytes = fromBase64Url(hash);
  const number = ((bytes[0] << 8) | bytes[1]) % 10_000;
  return { id: `guest-${hash.slice(0, 16)}`, username: `게스트${String(number).padStart(4, '0')}`, member: false };
}

/** 게스트 쿠키가 없으면 만들고, 있으면 그대로 · 이 사람의 게스트 신원 */
export async function startGuest(context: Context<AppEnv>): Promise<Player> {
  const existing = getCookie(context, GUEST_COOKIE);
  if (existing) return guestOf(existing);
  const token = randomToken();
  setCookie(context, GUEST_COOKIE, token, {
    httpOnly: true,
    secure: new URL(context.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: GUEST_DAYS * 86_400,
  });
  return guestOf(token);
}

/** 로그인했으면 회원, 아니면 게스트 쿠키의 게스트, 둘 다 없으면 null */
export async function findPlayer(context: Context<AppEnv>): Promise<Player | null> {
  const user = await findSessionUser(context.env.DB, getCookie(context, SESSION_COOKIE));
  if (user) return { ...user, member: true };
  const token = getCookie(context, GUEST_COOKIE);
  return token ? guestOf(token) : null;
}
