import { describe, expect, it } from 'vitest';
import { chooseBotMove, findHint, Game } from '../src/engine';

const playAll = (game: Game, ucis: string[]) => ucis.forEach(uci => game.playUci(uci));

describe('대국 판정', () => {
  it('바보의 메이트(체크메이트, 흑 승)', () => {
    const game = new Game('standard');
    playAll(game, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(game.history.at(-1)?.san).toBe('Qh4#');
    expect(game.status()).toEqual({ over: true, result: '0-1', reason: 'checkmate' });
  });

  it('스테일메이트', () => {
    const game = new Game('standard', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(game.status()).toEqual({ over: true, result: '1/2-1/2', reason: 'stalemate' });
  });

  it('3회 반복', () => {
    const game = new Game('standard');
    playAll(game, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(game.status()).toMatchObject({ over: true, reason: 'repetition' });
  });

  it('기물 부족(킹+비숍 대 킹)', () => {
    expect(new Game('standard', '8/8/4k3/8/8/2B5/4K3/8 w - - 0 1').status()).toMatchObject({ over: true, reason: 'insufficient' });
  });

  it('기보 표기: 캐슬링·승진·구분 표기', () => {
    const game = new Game('standard', 'r3k2r/1P6/8/8/8/8/8/R3K1NR w KQkq - 0 1');
    expect(game.playUci('e1c1').san).toBe('O-O-O');
    const promo = new Game('standard', '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
    expect(promo.playUci('b7b8q').san).toBe('b8=Q+');
    const knights = new Game('standard', '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1');
    expect(knights.playUci('b1d2').san).toBe('Nbd2');
  });

  it('물리기', () => {
    const game = new Game('mini');
    const start = game.position.toFen();
    playAll(game, ['b2b3', 'c4b3']);
    game.undo();
    game.undo();
    expect(game.position.toFen()).toBe(start);
  });
});

describe('봇·힌트', () => {
  it('한 수 메이트를 찾음', () => {
    const game = new Game('standard', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const hint = findHint(game.position);
    expect(hint && game.play(hint).san).toBe('Rd8#');
  });

  it('공짜 퀸을 잡음(7단)', () => {
    const game = new Game('standard', '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    const move = chooseBotMove(game.position, 7);
    expect(move && game.play(move).san).toBe('exd5');
  });

  it('1단 봇도 둘 수 있는 수를 둠', () => {
    const game = new Game('mini');
    for (let i = 0; i < 10 && !game.status().over; i++) {
      const move = chooseBotMove(game.position, 1);
      expect(move).not.toBeNull();
      game.play(move!);
    }
  });
});
