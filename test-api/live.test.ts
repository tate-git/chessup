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
