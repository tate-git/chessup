// 가입 · 로그인 · 로그아웃 · 게스트(가입 없이 친선 대국)
import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password';
import { currentGuest, GUEST_NAME, guestIdOf, hasGuestName, startGuest } from '../auth/guest';
import { adoptGuestResults } from '../db/weekly';
import { endSession, startSession } from '../auth/session';
import { clearFailures, ipKey, isLocked, recordFailure, userKey, type FailureKey } from '../db/login-limit';
import { createUser, findUserByName, usernameKey } from '../db/users';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { requireUser } from '../middleware';
import { meOf } from './me';
import { parseBody } from '../validation';

export const credentialsSchema = z.object({
  username: z.string().regex(/^[A-Za-z0-9_가-힣]{2,16}$/, '아이디는 2~16자 한글·영문·숫자·_'),
  password: z.string().min(8, '비밀번호는 8자 이상').max(72, '비밀번호는 72자 이하'),
});

const guestNameSchema = z.object({ name: z.string().trim().regex(GUEST_NAME).optional() });

/** 로그인 실패를 아이디·IP 둘 다로 셈(한 아이디를 여러 곳에서 · 한 곳에서 여러 아이디를 노리는 것 모두 막음) · IP 를 모르면(로컬) 아이디만 */
function failureKeys(username: string, ip: string | undefined): FailureKey[] {
  return ip ? [userKey(usernameKey(username)), ipKey(ip)] : [userKey(usernameKey(username))];
}

export const authRoutes = new Hono<AppEnv>()
  .post('/signup', async context => {
    const { username, password } = await parseBody(context, credentialsSchema);
    const user = await createUser(context.env.DB, username, await hashPassword(password));
    if (!user) throw new ApiError(409, 'username_taken', '이미 있는 아이디예요');
    // 게스트로 둔 이번 주 결과를 이어받음
    const guestId = await guestIdOf(context);
    if (guestId) await adoptGuestResults(context.env.DB, guestId, user.id, user.username).run();
    await startSession(context, user.id);
    return context.json(await meOf(context.env.DB, user), 201);
  })
  .post('/login', async context => {
    const { username, password } = await parseBody(context, credentialsSchema);
    const keys = failureKeys(username, context.req.header('CF-Connecting-IP'));
    if (await isLocked(context.env.DB, keys)) throw new ApiError(429, 'rate_limited', '로그인 시도가 너무 많아요. 15분 뒤에 다시 해 주세요');

    const user = await findUserByName(context.env.DB, username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await recordFailure(context.env.DB, keys);
      throw new ApiError(401, 'invalid_credentials', '아이디 또는 비밀번호가 맞지 않아요');
    }
    await clearFailures(context.env.DB, keys);
    await startSession(context, user.id);
    return context.json(await meOf(context.env.DB, user));
  })
  .get('/guest', async context => {
    // 지금 게스트(없으면 null · 새로 만들지 않음)
    const guest = await currentGuest(context);
    return context.json(guest && { username: guest.username, named: hasGuestName(context) });
  })
  .post('/guest', async context => {
    // 게스트 시작 · 이름을 주면 바꿈
    const body = await context.req.json().catch(() => ({}));
    const parsed = guestNameSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '이름은 2~12자 한글·영문·숫자·_ 로 해 주세요');
    const { name } = parsed.data;
    const { username } = await startGuest(context, name);
    return context.json({ username, named: Boolean(name) || hasGuestName(context) });
  })
  .post('/logout', requireUser, async context => {
    await endSession(context);
    return context.body(null, 204);
  });
