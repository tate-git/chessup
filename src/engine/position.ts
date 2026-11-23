// 국면: 판 · 차례 · 캐슬링 권리 · 앙파상 칸 · 수 세기 — 수 두기/물리기와 공격 판정
import { geometryFor, DIAGONAL, ORTHOGONAL, parseSquare, rankOf, squareName, type Geometry } from './geometry';
import type { Move } from './move';
import { BISHOP, BLACK, charToPiece, EMPTY, KING, KNIGHT, opponent, PAWN, pieceToChar, QUEEN, ROOK, sideOf, typeOf, WHITE, type Side } from './pieces';
import type { Variant } from './variants';

export const CASTLE_WHITE_KING = 1;
export const CASTLE_WHITE_QUEEN = 2;
export const CASTLE_BLACK_KING = 4;
export const CASTLE_BLACK_QUEEN = 8;
const NO_SQUARE = -1;

interface Undo {
  readonly move: Move;
  readonly castling: number;
  readonly epSquare: number;
  readonly halfmoveClock: number;
}

export class Position {
  readonly geometry: Geometry;
  readonly board: Int8Array;
  turn: Side = WHITE;
  castling = 0;
  epSquare = NO_SQUARE;
  halfmoveClock = 0;
  fullmoveNumber = 1;
  readonly #kings: Record<Side, number> = { 1: NO_SQUARE, [-1]: NO_SQUARE };
  readonly #undoStack: Undo[] = [];

  private constructor(readonly variant: Variant) {
    this.geometry = geometryFor(variant.width, variant.height);
    this.board = new Int8Array(this.geometry.size);
  }

  static fromFen(variant: Variant, fen = variant.startFen): Position {
    const position = new Position(variant);
    const [placement, turn = 'w', castling = '-', ep = '-', halfmove = '0', fullmove = '1'] = fen.trim().split(/\s+/);
    const { width, height } = position.geometry;
    const rows = placement.split('/');
    if (rows.length !== height) throw new Error(`FEN 줄 수가 판과 다름: ${fen}`);

    rows.forEach((row, index) => {
      const rank = height - 1 - index;
      let file = 0;
      for (const char of row.match(/\d+|./g) ?? []) {
        if (/\d/.test(char)) {
          file += Number(char);
          continue;
        }
        position.#putPiece(rank * width + file, charToPiece(char));
        file += 1;
      }
      if (file !== width) throw new Error(`FEN 칸 수가 판과 다름: ${row}`);
    });

    position.turn = turn === 'b' ? BLACK : WHITE;
    position.castling = parseCastling(castling);
    position.epSquare = ep === '-' ? NO_SQUARE : parseSquare(ep, width);
    position.halfmoveClock = Number(halfmove);
    position.fullmoveNumber = Number(fullmove);
    return position;
  }

  toFen(): string {
    return [this.#placementFen(), this.turn === WHITE ? 'w' : 'b', castlingFen(this.castling), this.#epFen(), this.halfmoveClock, this.fullmoveNumber].join(' ');
  }

  /** 반복 판정용(수 세기 제외) */
  repetitionKey(): string {
    return [this.#placementFen(), this.turn, this.castling, this.epSquare].join(' ');
  }

  kingSquare(side: Side): number {
    return this.#kings[side];
  }

  inCheck(side: Side = this.turn): boolean {
    return this.isAttacked(this.kingSquare(side), opponent(side));
  }

  /** by 쪽 말이 square 를 공격하는지 */
  isAttacked(square: number, by: Side): boolean {
    const { board, geometry } = this;
    const { width, knightTargets, kingTargets, rays } = geometry;

    const pawnRank = rankOf(square, width) - by;
    if (pawnRank >= 0 && pawnRank < geometry.height) {
      const file = square % width;
      for (const df of [-1, 1]) {
        const pawnFile = file + df;
        if (pawnFile >= 0 && pawnFile < width && board[pawnRank * width + pawnFile] === by * PAWN) return true;
      }
    }
    if (knightTargets[square].some(from => board[from] === by * KNIGHT)) return true;
    if (kingTargets[square].some(from => board[from] === by * KING)) return true;
    return (
      this.#slidingAttack(rays[square], ORTHOGONAL, by * ROOK, by * QUEEN) ||
      this.#slidingAttack(rays[square], DIAGONAL, by * BISHOP, by * QUEEN)
    );
  }

  makeMove(move: Move): void {
    const { board } = this;
    const side = sideOf(move.piece);
    this.#undoStack.push({ move, castling: this.castling, epSquare: this.epSquare, halfmoveClock: this.halfmoveClock });

    board[move.from] = EMPTY;
    board[move.to] = move.promotion || move.piece;
    if (move.kind === 'enPassant') board[this.#enPassantVictim(move)] = EMPTY;
    if (move.kind === 'castleKing' || move.kind === 'castleQueen') this.#moveCastlingRook(move, false);
    if (typeOf(move.piece) === KING) this.#kings[side] = move.to;

    this.castling &= ~(this.#rightsLostAt(move.from) | this.#rightsLostAt(move.to));
    this.epSquare = move.kind === 'double' ? (move.from + move.to) / 2 : NO_SQUARE;
    this.halfmoveClock = typeOf(move.piece) === PAWN || move.captured ? 0 : this.halfmoveClock + 1;
    if (side === BLACK) this.fullmoveNumber += 1;
    this.turn = opponent(side);
  }

  undoMove(): void {
    const undo = this.#undoStack.pop();
    if (!undo) throw new Error('물릴 수가 없음');
    const { move } = undo;
    const { board } = this;
    const side = sideOf(move.piece);

    board[move.from] = move.piece;
    board[move.to] = move.kind === 'enPassant' ? EMPTY : move.captured;
    if (move.kind === 'enPassant') board[this.#enPassantVictim(move)] = move.captured;
    if (move.kind === 'castleKing' || move.kind === 'castleQueen') this.#moveCastlingRook(move, true);
    if (typeOf(move.piece) === KING) this.#kings[side] = move.from;

    this.castling = undo.castling;
    this.epSquare = undo.epSquare;
    this.halfmoveClock = undo.halfmoveClock;
    if (side === BLACK) this.fullmoveNumber -= 1;
    this.turn = side;
  }

  #putPiece(square: number, piece: number): void {
    this.board[square] = piece;
    if (typeOf(piece) === KING) this.#kings[sideOf(piece)] = square;
  }

  #placementFen(): string {
    const { width, height } = this.geometry;
    const rows: string[] = [];
    for (let rank = height - 1; rank >= 0; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 0; file < width; file++) {
        const piece = this.board[rank * width + file];
        if (piece === EMPTY) {
          empty += 1;
          continue;
        }
        row += (empty || '') + pieceToChar(piece);
        empty = 0;
      }
      rows.push(row + (empty || ''));
    }
    return rows.join('/');
  }

  #epFen(): string {
    return this.epSquare === NO_SQUARE ? '-' : squareName(this.epSquare, this.geometry.width);
  }

  #slidingAttack(raysFrom: readonly (readonly number[])[], directions: readonly number[], slider: number, queen: number): boolean {
    for (const direction of directions) {
      for (const square of raysFrom[direction]) {
        const piece = this.board[square];
        if (piece === EMPTY) continue;
        if (piece === slider || piece === queen) return true;
        break;
      }
    }
    return false;
  }

  /** 앙파상으로 잡히는 폰은 도착 칸 바로 뒤 */
  #enPassantVictim(move: Move): number {
    return move.to - sideOf(move.piece) * this.geometry.width;
  }

  /** 캐슬링 때 룩도 옮김(8×8: 킹 쪽 h→f, 퀸 쪽 a→d) */
  #moveCastlingRook(move: Move, undo: boolean): void {
    const rankStart = move.from - (move.from % this.geometry.width);
    const [rookFrom, rookTo] = move.kind === 'castleKing' ? [rankStart + 7, rankStart + 5] : [rankStart, rankStart + 3];
    const rook = sideOf(move.piece) * ROOK;
    this.board[undo ? rookTo : rookFrom] = EMPTY;
    this.board[undo ? rookFrom : rookTo] = rook;
  }

  /** 킹·룩의 처음 자리에서 말이 움직이거나 잡히면 그 캐슬링 권리가 사라짐 */
  #rightsLostAt(square: number): number {
    if (!this.variant.castling) return 0;
    const last = this.geometry.size - this.geometry.width;
    switch (square) {
      case 4: return CASTLE_WHITE_KING | CASTLE_WHITE_QUEEN;
      case 7: return CASTLE_WHITE_KING;
      case 0: return CASTLE_WHITE_QUEEN;
      case last + 4: return CASTLE_BLACK_KING | CASTLE_BLACK_QUEEN;
      case last + 7: return CASTLE_BLACK_KING;
      case last: return CASTLE_BLACK_QUEEN;
      default: return 0;
    }
  }
}

function parseCastling(text: string): number {
  const flags: Record<string, number> = { K: CASTLE_WHITE_KING, Q: CASTLE_WHITE_QUEEN, k: CASTLE_BLACK_KING, q: CASTLE_BLACK_QUEEN };
  return [...text].reduce((rights, char) => rights | (flags[char] ?? 0), 0);
}

function castlingFen(rights: number): string {
  const text = [
    [CASTLE_WHITE_KING, 'K'],
    [CASTLE_WHITE_QUEEN, 'Q'],
    [CASTLE_BLACK_KING, 'k'],
    [CASTLE_BLACK_QUEEN, 'q'],
  ]
    .filter(([flag]) => rights & (flag as number))
    .map(([, char]) => char)
    .join('');
  return text || '-';
}
