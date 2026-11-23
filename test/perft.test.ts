// 수 개수 세기(perft): 알려진 값과 같으면 규칙(캐슬링·앙파상·승진·핀 포함)이 맞음
import { describe, expect, it } from 'vitest';
import { legalMoves } from '../src/engine/movegen';
import { Position } from '../src/engine/position';
import { VARIANTS } from '../src/engine/variants';

function perft(position: Position, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of legalMoves(position)) {
    position.makeMove(move);
    nodes += perft(position, depth - 1);
    position.undoMove();
  }
  return nodes;
}

const standard = (fen?: string) => Position.fromFen(VARIANTS.standard, fen);

describe('정통 체스 perft', () => {
  it.each([
    ['처음 국면', undefined, [20, 400, 8902, 197281]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['앙파상·핀', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['승진·캐슬링', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ] as const)('%s', (_name, fen, expected) => {
    const position = standard(fen);
    expected.forEach((count, index) => expect(perft(position, index + 1)).toBe(count));
    expect(position.toFen()).toBe(standard(fen).toFen());
  });
});

describe('미니 체스(5×5)', () => {
  it('처음 국면에서 백은 7수', () => {
    expect(legalMoves(Position.fromFen(VARIANTS.mini)).length).toBe(7);
  });
  it('수를 두고 물리면 원래 국면', () => {
    const position = Position.fromFen(VARIANTS.mini);
    const before = position.toFen();
    perft(position, 4);
    expect(position.toFen()).toBe(before);
  });
});
