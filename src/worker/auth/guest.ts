// 게스트(가입 없이 대국): 쿠키에 무작위 토큰(기기 id 처럼 1년) · id 는 토큰 해시 · 이름은 정하면 gname 쿠키, 안 정하면 게스트0000 · DB 에 저장 안 함
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { findSessionUser, SESSION_COOKIE } from './session';
import { fromBase64Url, randomToken, sha256 } from './encoding';

export const GUEST_COOKIE = 'gid';
export const GUEST_NAME_COOKIE = 'gname';
const GUEST_DAYS = 365;
/** 게스트 이름: 2~12자 한글·영문·숫자·_ */
export const GUEST_NAME = /^[A-Za-z0-9_가-힣]{2,12}$/;

/** 대국에 앉는 사람: 회원이면 레이팅 대국 가능, 게스트는 친선만 */
export interface Player {
  readonly id: string;
  readonly username: string;
  readonly member: boolean;
}

async function guestOf(token: string, name: string | undefined): Promise<Player> {
  const hash = await sha256(`guest:${token}`);
  const bytes = fromBase64Url(hash);
  const number = ((bytes[0] << 8) | bytes[1]) % 10_000;
  const username = name && GUEST_NAME.test(name) ? name : `게스트${String(number).padStart(4, '0')}`;
  return { id: `guest-${hash.slice(0, 16)}`, username, member: false };
}

const cookieOptions = (context: Context<AppEnv>) => ({
  httpOnly: true,
  secure: new URL(context.req.url).protocol === 'https:',
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: GUEST_DAYS * 86_400,
});

/** 게스트 쿠키가 없으면 만들고, 있으면 그대로 · name 을 주면 이름도 바꿈(형식은 부르는 쪽에서 검사) */
export async function startGuest(context: Context<AppEnv>, name?: string): Promise<Player> {
  let token = getCookie(context, GUEST_COOKIE);
  if (!token) {
    token = randomToken();
    setCookie(context, GUEST_COOKIE, token, cookieOptions(context));
  }
  if (name) setCookie(context, GUEST_NAME_COOKIE, name, cookieOptions(context));
  return guestOf(token, name ?? getCookie(context, GUEST_NAME_COOKIE));
}

/** 게스트가 이름을 정했는지 */
export const hasGuestName = (context: Context<AppEnv>) => GUEST_NAME.test(getCookie(context, GUEST_NAME_COOKIE) ?? '');

/** 게스트 쿠키가 있으면 그 게스트(없으면 만들지 않음) */
export async function currentGuest(context: Context<AppEnv>): Promise<Player | null> {
  const token = getCookie(context, GUEST_COOKIE);
  return token ? guestOf(token, getCookie(context, GUEST_NAME_COOKIE)) : null;
}

/** 게스트 쿠키가 있으면 그 게스트 id(가입할 때 결과 이어받기용) */
export async function guestIdOf(context: Context<AppEnv>): Promise<string | null> {
  const token = getCookie(context, GUEST_COOKIE);
  return token ? (await guestOf(token, undefined)).id : null;
}

/** 로그인했으면 회원, 아니면 게스트 쿠키의 게스트, 둘 다 없으면 null */
export async function findPlayer(context: Context<AppEnv>): Promise<Player | null> {
  const user = await findSessionUser(context.env.DB, getCookie(context, SESSION_COOKIE));
  if (user) return { ...user, member: true };
  const token = getCookie(context, GUEST_COOKIE);
  return token ? guestOf(token, getCookie(context, GUEST_NAME_COOKIE)) : null;
}
