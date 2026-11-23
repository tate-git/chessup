// 국면 점수(센티폰, 둘 차례 기준): 말 값 + 자리(가운데·전진·킹 안전)
import { fileOf, rankOf } from './geometry';
import { BISHOP, EMPTY, KING, KNIGHT, PAWN, QUEEN, ROOK, sideOf, typeOf, WHITE } from './pieces';
import type { Position } from './position';

export const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0] as const;
/** 양쪽 합쳐 이만큼 이하로 큰 말이 남으면 끝내기 — 킹이 가운데로 나옴 */
const ENDGAME_MATERIAL = 2600;

export function evaluate(position: Position): number {
  const { board, geometry } = position;
  const { width, height } = geometry;
  const endgame = majorMaterial(position) <= ENDGAME_MATERIAL * (width * height) / 64;
  let score = 0;

  for (let square = 0; square < board.length; square++) {
    const piece = board[square];
    if (piece === EMPTY) continue;
    const side = sideOf(piece);
    const file = fileOf(square, width);
    const rank = rankOf(square, width);
    const forward = side === WHITE ? rank : height - 1 - rank;   // 내 쪽에서 몇 줄 나왔나
    const centrality = centralityOf(file, rank, width, height);
    score += side * (PIECE_VALUE[typeOf(piece)] + placementBonus(typeOf(piece), centrality, forward, height, endgame));
  }
  return score * position.turn;
}

function placementBonus(type: number, centrality: number, forward: number, height: number, endgame: boolean): number {
  switch (type) {
    case PAWN: return forward * (endgame ? 18 : 9) + centrality * 6;
    case KNIGHT: return centrality * 14;
    case BISHOP: return centrality * 8;
    case ROOK: return forward === height - 2 ? 18 : 0;
    case QUEEN: return centrality * 3;
    case KING: return endgame ? centrality * 12 : (forward === 0 ? 18 : -14 * forward) - centrality * 6;
    default: return 0;
  }
}

/** 0(구석) ~ 약 3(정가운데) */
function centralityOf(file: number, rank: number, width: number, height: number): number {
  const distance = Math.max(Math.abs(file - (width - 1) / 2), Math.abs(rank - (height - 1) / 2));
  return (Math.max(width, height) - 1) / 2 - distance;
}

function majorMaterial(position: Position): number {
  let total = 0;
  for (const piece of position.board) {
    const type = typeOf(piece);
    if (type !== PAWN && type !== KING) total += PIECE_VALUE[type];
  }
  return total;
}
