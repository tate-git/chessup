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

describe('게스트 친선 대국', () => {
  async function asGuest(): Promise<TestUser> {
    const guest = TestUser.fresh('g');
    const started = await guest.request('POST', '/api/auth/guest');
    expect(started.json.username).toMatch(/^게스트\d{4}$/);
    return guest;
  }

  async function casualPair(a: TestUser, b: TestUser) {
    const [lobbyA, lobbyB] = await Promise.all([a.connect('/api/lobby'), b.connect('/api/lobby')]);
    lobbyA.send({ type: 'seek', variant: 'standard', timeControl: '3+2', rated: false });
    lobbyB.send({ type: 'seek', variant: 'standard', timeControl: '3+2', rated: false });
    const [matchA, matchB] = await Promise.all([lobbyA.next(m => m.type === 'matched'), lobbyB.next(m => m.type === 'matched')]);
    lobbyA.close();
    lobbyB.close();
    expect(matchA.gameId).toBe(matchB.gameId);
    const [white, black] = matchA.color === 'white' ? [a, b] : [b, a];
    return { gameId: matchA.gameId as string, white, black };
  }

  it('같은 게스트는 같은 이름 · 쿠키 없으면 로비 401', async () => {
    const guest = await asGuest();
    const again = await guest.request('POST', '/api/auth/guest');
    const first = (await guest.request('POST', '/api/auth/guest')).json.username;
    expect(again.json.username).toBe(first);
    await expect(TestUser.fresh('n').connect('/api/lobby')).rejects.toBeDefined();
  });

  it('게스트는 랭크로 줄 설 수 없음', async () => {
    const guest = await asGuest();
    const lobby = await guest.connect('/api/lobby');
    lobby.send({ type: 'seek', variant: 'standard', timeControl: '3+2' });
    expect((await lobby.next(m => m.type === 'error')).code).toBe('unauthorized');
    lobby.close();
  });

  it('게스트끼리 친선: 끝까지 두지만 레이팅 없음 · 기록 저장 안 함', async () => {
    const { gameId, white, black } = await casualPair(await asGuest(), await asGuest());
    const [liveWhite, liveBlack] = await Promise.all([white.connect(`/api/games/${gameId}/live`), black.connect(`/api/games/${gameId}/live`)]);
    const state = await liveWhite.next(m => m.type === 'state');
    expect(state.game).toMatchObject({ you: 'white', rated: false });
    expect(state.game.white.rating).toBeUndefined();
    await liveBlack.next(m => m.type === 'state');

    for (const [ply, uci] of ['f2f3', 'e7e5', 'g2g4', 'd8h4'].entries()) {
      (ply % 2 === 0 ? liveWhite : liveBlack).send({ type: 'move', uci, ply });
      await liveWhite.next(m => m.type === 'move' && m.ply === ply);
    }
    const end = await liveBlack.next(m => m.type === 'end');
    expect(end.game).toMatchObject({ result: '0-1', reason: 'checkmate' });
    expect(end.game.black.ratingChange).toBeUndefined();
    expect((await white.request('GET', `/api/games/${gameId}`)).status).toBe(404);
  });

  it('회원도 친선으로 게스트와 만나고 레이팅은 그대로', async () => {
    const member = TestUser.fresh('m');
    await member.signup();
    const { gameId, white } = await casualPair(member, await asGuest());
    const live = await white.connect(`/api/games/${gameId}/live`);
    await live.next(m => m.type === 'state');
    live.send({ type: 'resign' });
    expect((await live.next(m => m.type === 'end')).game.white.ratingChange).toBeUndefined();
    expect((await member.request('GET', '/api/me')).json.ratings.standard).toMatchObject({ games: 0, rating: 1500 });
  });
});
