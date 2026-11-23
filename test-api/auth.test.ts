import { describe, expect, it } from 'vitest';
import { TestUser } from './client';

describe('회원가입·로그인', () => {
  it('가입하면 바로 로그인되고 처음 레이팅은 1500(잠정)', async () => {
    const user = TestUser.fresh();
    const signup = await user.signup();
    expect(signup.status).toBe(201);
    expect(signup.json).toMatchObject({ username: user.username, beginner: true, ratings: { standard: { rating: 1500, games: 0, provisional: true }, mini: { rating: 1500 } } });
    expect((await user.request('GET', '/api/me')).json.username).toBe(user.username);
  });

  it('같은 아이디는 대소문자가 달라도 가입 불가', async () => {
    const user = TestUser.fresh('Dup');
    await user.signup();
    const again = await new TestUser(user.username.toUpperCase()).signup();
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe('username_taken');
  });

  it('잘못된 입력은 400 invalid_input', async () => {
    const response = await new TestUser('a', 'short').signup();
    expect(response.status).toBe(400);
    expect(response.json.error.code).toBe('invalid_input');
  });

  it('비밀번호가 틀리면 401 · 맞으면 200 · 로그아웃하면 401', async () => {
    const user = TestUser.fresh();
    await user.signup();
    await user.request('POST', '/api/auth/logout');
    expect((await user.request('GET', '/api/me')).status).toBe(401);
    expect((await user.login('wrong-password')).json.error.code).toBe('invalid_credentials');
    expect((await user.login()).status).toBe(200);
    expect((await user.request('GET', '/api/me')).status).toBe(200);
  });

  it('로그인 실패 10번이면 잠김(429)', async () => {
    const user = TestUser.fresh();
    await user.signup();
    for (let attempt = 0; attempt < 10; attempt++) await user.login('wrong-password');
    const locked = await user.login();
    expect(locked.status).toBe(429);
    expect(locked.json.error.code).toBe('rate_limited');
  });
});

describe('연습·힌트', () => {
  it('초보는 한 판에 힌트 1번 · 다른 판이면 다시 1번', async () => {
    const user = TestUser.fresh();
    await user.signup();
    expect((await user.request('POST', '/api/practice/hints', { practiceGameId: 'g1' })).json).toEqual({ remaining: 0, scope: 'game' });
    expect((await user.request('POST', '/api/practice/hints', { practiceGameId: 'g1' })).json.error.code).toBe('no_hints_left');
    expect((await user.request('POST', '/api/practice/hints', { practiceGameId: 'g2' })).status).toBe(200);
  });

  it('봇 격파 기록은 최고 단계만 남음', async () => {
    const user = TestUser.fresh();
    await user.signup();
    await user.request('POST', '/api/practice/clears', { variant: 'mini', level: 4 });
    const state = await user.request('POST', '/api/practice/clears', { variant: 'mini', level: 2 });
    expect(state.json.cleared).toEqual({ standard: 0, mini: 4 });
  });

  it('로그인 안 하면 401', async () => {
    expect((await new TestUser('nobody').request('GET', '/api/practice')).status).toBe(401);
  });
});
