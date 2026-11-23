// 수 만들기: 말별 가능한 수(자기 킹이 잡히는 수 포함) → 합법 수만 거르기
import { DIAGONAL, ORTHOGONAL, rankOf } from './geometry';
import type { Move, MoveKind } from './move';
import { CASTLE_BLACK_KING, CASTLE_BLACK_QUEEN, CASTLE_WHITE_KING, CASTLE_WHITE_QUEEN, type Position } from './position';
import { BISHOP, EMPTY, KING, KNIGHT, opponent, PAWN, QUEEN, ROOK, sideOf, typeOf, WHITE, type Side } from './pieces';

export function legalMoves(position: Position): Move[] {
  return pseudoLegalMoves(position).filter(move => isLegal(position, move));
}

/** 잡는 수·승진만(정지 탐색용) */
export function legalCaptures(position: Position): Move[] {
  return pseudoLegalMoves(position, true).filter(move => isLegal(position, move));
}

export function isLegal(position: Position, move: Move): boolean {
  const side = position.turn;
  position.makeMove(move);
  const legal = !position.inCheck(side);
  position.undoMove();
  return legal;
}

export function pseudoLegalMoves(position: Position, capturesOnly = false): Move[] {
  const moves: Move[] = [];
  const side = position.turn;
  for (let square = 0; square < position.board.length; square++) {
    const piece = position.board[square];
    if (piece === EMPTY || sideOf(piece) !== side) continue;
    switch (typeOf(piece)) {
      case PAWN: addPawnMoves(position, square, moves, capturesOnly); break;
      case KNIGHT: addStepMoves(position, square, position.geometry.knightTargets[square], moves, capturesOnly); break;
      case BISHOP: addSlidingMoves(position, square, DIAGONAL, moves, capturesOnly); break;
      case ROOK: addSlidingMoves(position, square, ORTHOGONAL, moves, capturesOnly); break;
      case QUEEN: addSlidingMoves(position, square, [...ORTHOGONAL, ...DIAGONAL], moves, capturesOnly); break;
      case KING:
        addStepMoves(position, square, position.geometry.kingTargets[square], moves, capturesOnly);
        if (!capturesOnly) addCastlingMoves(position, square, moves);
        break;
    }
  }
  return moves;
}

const move = (from: number, to: number, piece: number, captured = EMPTY, kind: MoveKind = 'normal', promotion = EMPTY): Move =>
  ({ from, to, piece, captured, promotion, kind });

function isEnemy(piece: number, side: Side): boolean {
  return piece !== EMPTY && sideOf(piece) !== side;
}

function addStepMoves(position: Position, from: number, targets: readonly number[], moves: Move[], capturesOnly: boolean): void {
  const piece = position.board[from];
  const side = sideOf(piece);
  for (const to of targets) {
    const target = position.board[to];
    if (isEnemy(target, side)) moves.push(move(from, to, piece, target));
    else if (target === EMPTY && !capturesOnly) moves.push(move(from, to, piece));
  }
}

function addSlidingMoves(position: Position, from: number, directions: readonly number[], moves: Move[], capturesOnly: boolean): void {
  const piece = position.board[from];
  const side = sideOf(piece);
  for (const direction of directions) {
    for (const to of position.geometry.rays[from][direction]) {
      const target = position.board[to];
      if (target === EMPTY) {
        if (!capturesOnly) moves.push(move(from, to, piece));
        continue;
      }
      if (isEnemy(target, side)) moves.push(move(from, to, piece, target));
      break;
    }
  }
}

function addPawnMoves(position: Position, from: number, moves: Move[], capturesOnly: boolean): void {
  const { board, geometry, variant } = position;
  const { width, height } = geometry;
  const piece = board[from];
  const side = sideOf(piece);
  const forward = side * width;
  const rank = rankOf(from, width);
  const startRank = side === WHITE ? 1 : height - 2;
  const lastRank = side === WHITE ? height - 1 : 0;

  const push = (to: number, captured: number, kind: MoveKind = 'normal') => {
    if (rankOf(to, width) !== lastRank) {
      moves.push(move(from, to, piece, captured, kind));
      return;
    }
    for (const type of variant.promotions) moves.push(move(from, to, piece, captured, kind, side * type));
  };

  const ahead = from + forward;
  const promotes = rankOf(ahead, width) === lastRank;
  if (board[ahead] === EMPTY && (!capturesOnly || promotes)) {
    push(ahead, EMPTY);
    const twoAhead = ahead + forward;
    if (!capturesOnly && variant.doublePawnPush && rank === startRank && board[twoAhead] === EMPTY) {
      moves.push(move(from, twoAhead, piece, EMPTY, 'double'));
    }
  }

  const file = from % width;
  for (const df of [-1, 1]) {
    if (file + df < 0 || file + df >= width) continue;
    const to = ahead + df;
    if (isEnemy(board[to], side)) push(to, board[to]);
    else if (variant.enPassant && to === position.epSquare) push(to, -side * PAWN, 'enPassant');
  }
}

/** 8×8 정통 체스: 킹·룩이 처음 자리 · 사이 칸 비어 있음 · 킹이 지나는 칸이 공격받지 않음 */
function addCastlingMoves(position: Position, from: number, moves: Move[]): void {
  if (!position.variant.castling || position.inCheck()) return;
  const side = position.turn;
  const enemy = opponent(side);
  const home = side === WHITE ? 4 : position.geometry.size - 4;
  if (from !== home) return;

  const [kingRight, queenRight] = side === WHITE ? [CASTLE_WHITE_KING, CASTLE_WHITE_QUEEN] : [CASTLE_BLACK_KING, CASTLE_BLACK_QUEEN];
  const empty = (...squares: number[]) => squares.every(square => position.board[square] === EMPTY);
  const safe = (...squares: number[]) => squares.every(square => !position.isAttacked(square, enemy));
  const king = position.board[from];

  if (position.castling & kingRight && empty(from + 1, from + 2) && safe(from + 1, from + 2)) {
    moves.push(move(from, from + 2, king, EMPTY, 'castleKing'));
  }
  if (position.castling & queenRight && empty(from - 1, from - 2, from - 3) && safe(from - 1, from - 2)) {
    moves.push(move(from, from - 2, king, EMPTY, 'castleQueen'));
  }
}
