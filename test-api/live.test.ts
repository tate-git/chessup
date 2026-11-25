import { describe, expect, it } from 'vitest';
import { TestUser } from './client';

async function matchedPair(variant = 'standard', timeControl = '3+2') {
  const [a, b] = [TestUser.fresh('w'), TestUser.fresh('b')];
  await Promise.all([a.signup(), b.signup()]);
  const [lobbyA, lobbyB] = await Promise.all([a.connect('/api/lobby'), b.connect('/api/lobby')]);
  lobbyA.send({ type: 'seek', variant, timeControl });
  lobbyB.send({ type: 'seek', variant, timeControl });
  const [matchA, matchB] = await Promise.all([lobbyA.next(m => m.type === 'matched'), lobbyB.next(m => m.type === 'matched')]);
  expect(matchA.gameId).toBe(matchB.gameId);
  expect(new Set([matchA.color, matchB.color])).toEqual(new Set(['white', 'black']));
  lobbyA.close();
  lobbyB.close();
  const [white, black] = matchA.color === 'white' ? [a, b] : [b, a];
  return { gameId: matchA.gameId as string, white, black };
}

describe('실시간 대국', () => {
  it('짝 지어 바보의 메이트 → 흑 승 · 레이팅 반영 · 기록 저장', async () => {
    const { gameId, white, black } = await matchedPair();
    const [liveWhite, liveBlack] = await Promise.all([white.connect(`/api/games/${gameId}/live`), black.connect(`/api/games/${gameId}/live`)]);
    expect((await liveWhite.next(m => m.type === 'state')).game.you).toBe('white');
    expect((await liveBlack.next(m => m.type === 'state')).game.you).toBe('black');

    const moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    for (const [ply, uci] of moves.entries()) {
      (ply % 2 === 0 ? liveWhite : liveBlack).send({ type: 'move', uci, ply });
      const echoed = await liveWhite.next(m => m.type === 'move' && m.ply === ply);
      expect(echoed.uci).toBe(uci);
    }
    const end = await liveBlack.next(m => m.type === 'end');
    expect(end.game).toMatchObject({ result: '0-1', reason: 'checkmate' });
    expect(end.game.black.ratingChange).toBeGreaterThan(0);
    expect(end.game.white.ratingChange).toBeLessThan(0);

    const record = await white.request('GET', `/api/games/${gameId}`);
    expect(record.json.moves).toEqual(moves);
    const me = await black.request('GET', '/api/me');
    expect(me.json.ratings.standard).toMatchObject({ games: 1, wins: 1 });
    expect(me.json.ratings.standard.rating).toBeGreaterThan(1500);
  });

  it('차례가 아니거나 둘 수 없는 수는 거절', async () => {
    const { gameId, white, black } = await matchedPair('mini', '2+1');
    const [liveWhite, liveBlack] = await Promise.all([white.connect(`/api/games/${gameId}/live`), black.connect(`/api/games/${gameId}/live`)]);
    liveBlack.send({ type: 'move', uci: 'a4a3', ply: 0 });
    expect((await liveBlack.next(m => m.type === 'error')).code).toBe('not_your_turn');
    liveWhite.send({ type: 'move', uci: 'a2a4', ply: 0 });
    expect((await liveWhite.next(m => m.type === 'error')).code).toBe('illegal_move');
  });

  it('기권하면 상대 승 · 무승부 제안·수락', async () => {
    const resignGame = await matchedPair();
    const live = await resignGame.white.connect(`/api/games/${resignGame.gameId}/live`);
    live.send({ type: 'resign' });
    expect((await live.next(m => m.type === 'end')).game).toMatchObject({ result: '0-1', reason: 'resign' });

    const drawGame = await matchedPair();
    const [liveWhite, liveBlack] = await Promise.all([
      drawGame.white.connect(`/api/games/${drawGame.gameId}/live`),
      drawGame.black.connect(`/api/games/${drawGame.gameId}/live`),
    ]);
    liveWhite.send({ type: 'offerDraw' });
    expect((await liveBlack.next(m => m.type === 'drawOffered')).by).toBe('white');
    liveBlack.send({ type: 'acceptDraw' });
    expect((await liveWhite.next(m => m.type === 'end')).game).toMatchObject({ result: '1/2-1/2', reason: 'agreement' });
  });

  it('관전자는 수를 둘 수 없음', async () => {
    const { gameId } = await matchedPair();
    const viewer = TestUser.fresh('v');
    await viewer.signup();
    const live = await viewer.connect(`/api/games/${gameId}/live`);
    expect((await live.next(m => m.type === 'state')).game.you).toBe('spectator');
  });
});

describe('게스트 · 한 줄 매칭', () => {
  async function asGuest(): Promise<TestUser> {
    const guest = TestUser.fresh('g');
    const started = await guest.request('POST', '/api/auth/guest');
    expect(started.json.username).toMatch(/^게스트\d{4}$/);
    return guest;
  }

  /** 둘이 같은 조건으로 줄 섬(회원·게스트 상관없이 같은 줄) */
  async function pair(a: TestUser, b: TestUser) {
    const [lobbyA, lobbyB] = await Promise.all([a.connect('/api/lobby'), b.connect('/api/lobby')]);
    lobbyA.send({ type: 'seek', variant: 'standard', timeControl: '5+3' });
    lobbyB.send({ type: 'seek', variant: 'standard', timeControl: '5+3' });
    const [matchA, matchB] = await Promise.all([lobbyA.next(m => m.type === 'matched'), lobbyB.next(m => m.type === 'matched')]);
    lobbyA.close();
    lobbyB.close();
    expect(matchA.gameId).toBe(matchB.gameId);
    const [white, black] = matchA.color === 'white' ? [a, b] : [b, a];
    return { gameId: matchA.gameId as string, white, black };
  }

  async function foolsMate(gameId: string, white: TestUser, black: TestUser) {
    const [liveWhite, liveBlack] = await Promise.all([white.connect(`/api/games/${gameId}/live`), black.connect(`/api/games/${gameId}/live`)]);
    const state = await liveWhite.next(m => m.type === 'state');
    await liveBlack.next(m => m.type === 'state');
    for (const [ply, uci] of ['f2f3', 'e7e5', 'g2g4', 'd8h4'].entries()) {
      (ply % 2 === 0 ? liveWhite : liveBlack).send({ type: 'move', uci, ply });
      await liveWhite.next(m => m.type === 'move' && m.ply === ply);
    }
    return { state: state.game, end: (await liveBlack.next(m => m.type === 'end')).game };
  }

  it('같은 게스트는 같은 이름 · 쿠키 없으면 로비 401', async () => {
    const guest = await asGuest();
    const first = (await guest.request('POST', '/api/auth/guest')).json.username;
    expect((await guest.request('POST', '/api/auth/guest')).json.username).toBe(first);
    await expect(TestUser.fresh('n').connect('/api/lobby')).rejects.toBeDefined();
  });

  it('게스트끼리: 끝까지 두고 레이팅·기록 없음', async () => {
    const { gameId, white, black } = await pair(await asGuest(), await asGuest());
    const { state, end } = await foolsMate(gameId, white, black);
    expect(state.white.rating).toBeUndefined();
    expect(end).toMatchObject({ result: '0-1', reason: 'checkmate' });
    expect(end.black.ratingChange).toBeUndefined();
    expect((await white.request('GET', `/api/games/${gameId}`)).status).toBe(404);
  });

  it('회원과 게스트: 같은 줄에서 만나 회원 레이팅만 바뀜 · 기록은 안 남음', async () => {
    const member = TestUser.fresh('m');
    await member.signup();
    const { gameId, white, black } = await pair(member, await asGuest());
    const { end } = await foolsMate(gameId, white, black);
    const memberColor = white === member ? 'white' : 'black';
    const guestColor = memberColor === 'white' ? 'black' : 'white';
    expect(end[memberColor].ratingChange).not.toBe(0);
    expect(end[guestColor].rating).toBeUndefined();
    expect((await member.request('GET', '/api/me')).json.ratings.standard.games).toBe(1);
    expect((await member.request('GET', `/api/games/${gameId}`)).status).toBe(404);
  });

  it('게스트 이름: 정하면 그 이름 · 형식이 틀리면 400 · 쿠키 없으면 GET 은 null', async () => {
    expect((await TestUser.fresh('x').request('GET', '/api/auth/guest')).json).toBeNull();
    const guest = await asGuest();
    expect((await guest.request('GET', '/api/auth/guest')).json.named).toBe(false);
    expect((await guest.request('POST', '/api/auth/guest', { name: 'a' })).status).toBe(400);
    const name = `n${crypto.randomUUID().slice(0, 8)}`;
    expect((await guest.request('POST', '/api/auth/guest', { name })).json).toEqual({ username: name, named: true });
    expect((await guest.request('GET', '/api/auth/guest')).json).toEqual({ username: name, named: true });
  });

  it('이번 주 랭킹: 회원·게스트 모두 승점(승 1) · 본인 표시 · 게스트가 가입하면 이어받음', async () => {
    const member = TestUser.fresh('m');
    await member.signup();
    const guest = await asGuest();
    const guestName = `w${crypto.randomUUID().slice(0, 8)}`;
    await guest.request('POST', '/api/auth/guest', { name: guestName });
    const { gameId, white, black } = await pair(member, guest);
    await foolsMate(gameId, white, black);   // 흑 승
    const winner = black === member ? member.username : guestName;
    const loser = winner === member.username ? guestName : member.username;

    const board = (await guest.request('GET', '/api/leaderboard/weekly?variant=standard')).json;
    expect(board.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const row = (name: string) => board.entries.find((entry: { username: string }) => entry.username === name);
    expect(row(winner)).toMatchObject({ points: 1, games: 1, wins: 1 });
    expect(row(loser)).toMatchObject({ points: 0, games: 1, wins: 0 });
    expect(row(guestName)).toMatchObject({ guest: true, mine: true });
    expect(row(member.username)).toMatchObject({ guest: false, mine: false });

    // 게스트가 가입: 같은 쿠키로 가입하면 이번 주 결과가 회원 이름으로
    const joined = new TestUser(`j${crypto.randomUUID().slice(0, 8)}`);
    joined.adoptCookieFrom(guest);
    await joined.signup();
    const after = (await joined.request('GET', '/api/leaderboard/weekly?variant=standard')).json.entries;
    expect(after.find((entry: { username: string }) => entry.username === guestName)).toBeUndefined();
    expect(after.find((entry: { username: string }) => entry.username === joined.username)).toMatchObject({ guest: false, games: 1, mine: true });
  });
});

describe('방 번호', () => {
  it('만든 방 번호로 들어오면 바로 같은 대국 · 레이팅 반영', async () => {
    const [host, friend] = [TestUser.fresh('h'), TestUser.fresh('f')];
    await Promise.all([host.signup(), friend.signup()]);
    const hostLobby = await host.connect('/api/lobby');
    hostLobby.send({ type: 'createRoom', variant: 'mini', timeControl: '3+2' });
    const { code } = await hostLobby.next(m => m.type === 'roomCreated');
    expect(code).toMatch(/^\d{4}$/);

    const friendLobby = await friend.connect('/api/lobby');
    friendLobby.send({ type: 'joinRoom', code });
    const [a, b] = await Promise.all([hostLobby.next(m => m.type === 'matched'), friendLobby.next(m => m.type === 'matched')]);
    expect(a.gameId).toBe(b.gameId);
    const live = await host.connect(`/api/games/${a.gameId}/live`);
    const state = (await live.next(m => m.type === 'state')).game;
    expect(state).toMatchObject({ variant: 'mini', timeControl: '3+2' });
    expect(state.white.rating).toBe(1500);
  });

  it('없는 방 · 내 방에는 못 들어감 · 게스트도 들어감', async () => {
    const host = TestUser.fresh('h');
    await host.signup();
    const hostLobby = await host.connect('/api/lobby');
    hostLobby.send({ type: 'createRoom', variant: 'standard', timeControl: '10+0' });
    const { code } = await hostLobby.next(m => m.type === 'roomCreated');

    const self = await host.connect('/api/lobby');
    self.send({ type: 'joinRoom', code });
    expect((await self.next(m => m.type === 'error')).code).toBe('invalid_input');

    const guest = TestUser.fresh('g');
    await guest.request('POST', '/api/auth/guest');
    const guestLobby = await guest.connect('/api/lobby');
    guestLobby.send({ type: 'joinRoom', code: code === '0000' ? '0001' : '0000' });
    expect((await guestLobby.next(m => m.type === 'error')).code).toBe('not_found');
    guestLobby.send({ type: 'joinRoom', code });
    expect((await guestLobby.next(m => m.type === 'matched')).gameId).toBe((await hostLobby.next(m => m.type === 'matched')).gameId);
  });
});
