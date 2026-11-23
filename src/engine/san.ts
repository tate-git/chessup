// 기보 표기(SAN): Nf3 · exd5 · O-O · e8=Q+ · Qxf7#
import { fileOf, rankOf, squareName } from './geometry';
import { legalMoves } from './movegen';
import type { Move } from './move';
import { KING, PAWN, pieceToChar, typeOf } from './pieces';
import type { Position } from './position';

export function toSan(position: Position, move: Move, legal: readonly Move[] = legalMoves(position)): string {
  return describeMove(position, move, legal) + checkSuffix(position, move);
}

function describeMove(position: Position, move: Move, legal: readonly Move[]): string {
  if (move.kind === 'castleKing') return 'O-O';
  if (move.kind === 'castleQueen') return 'O-O-O';

  const { width } = position.geometry;
  const target = squareName(move.to, width);
  const capture = move.captured ? 'x' : '';
  const promotion = move.promotion ? `=${pieceToChar(typeOf(move.promotion))}` : '';

  if (typeOf(move.piece) === PAWN) {
    const fromFile = capture ? squareName(move.from, width)[0] : '';
    return fromFile + capture + target + promotion;
  }
  const letter = pieceToChar(typeOf(move.piece));
  return letter + disambiguation(move, legal, width) + capture + target;
}

/** 같은 종류의 말이 같은 칸으로 갈 수 있으면 출발 파일·랭크를 덧붙임 */
function disambiguation(move: Move, legal: readonly Move[], width: number): string {
  if (typeOf(move.piece) === KING) return '';
  const rivals = legal.filter(other => other.piece === move.piece && other.to === move.to && other.from !== move.from);
  if (rivals.length === 0) return '';
  const from = squareName(move.from, width);
  const sameFile = rivals.some(other => fileOf(other.from, width) === fileOf(move.from, width));
  const sameRank = rivals.some(other => rankOf(other.from, width) === rankOf(move.from, width));
  if (!sameFile) return from[0];
  if (!sameRank) return from.slice(1);
  return from;
}

function checkSuffix(position: Position, move: Move): string {
  position.makeMove(move);
  const suffix = !position.inCheck() ? '' : legalMoves(position).length === 0 ? '#' : '+';
  position.undoMove();
  return suffix;
}
