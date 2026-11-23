// 대국: 국면 + 지나온 수(기보) + 끝났는지(체크메이트·스테일메이트·3회 반복·50수·기물 부족)
import { legalMoves } from './movegen';
import { moveToUci, type Move } from './move';
import { BISHOP, BLACK, EMPTY, KING, KNIGHT, typeOf, WHITE, type Side } from './pieces';
import { Position } from './position';
import { toSan } from './san';
import { VARIANTS, type VariantId } from './variants';

export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type EndReason = 'checkmate' | 'stalemate' | 'repetition' | 'fiftyMove' | 'insufficient';
export type GameStatus = { readonly over: false } | { readonly over: true; readonly result: GameResult; readonly reason: EndReason };

export interface PlayedMove {
  readonly move: Move;
  readonly san: string;
  readonly uci: string;
}

const FIFTY_MOVE_HALFMOVES = 100;
const REPETITION_LIMIT = 3;

export class Game {
  readonly position: Position;
  readonly #history: PlayedMove[] = [];
  readonly #repetitions = new Map<string, number>();
  #legal: Move[] | null = null;

  constructor(readonly variantId: VariantId, fen?: string) {
    this.position = Position.fromFen(VARIANTS[variantId], fen);
    this.#countRepetition(1);
  }

  get history(): readonly PlayedMove[] {
    return this.#history;
  }

  get turn(): Side {
    return this.position.turn;
  }

  get width(): number {
    return this.position.geometry.width;
  }

  legalMoves(): readonly Move[] {
    this.#legal ??= legalMoves(this.position);
    return this.#legal;
  }

  findMove(uci: string): Move | undefined {
    return this.legalMoves().find(move => moveToUci(move, this.width) === uci);
  }

  play(move: Move): PlayedMove {
    const played = { move, san: toSan(this.position, move, this.legalMoves()), uci: moveToUci(move, this.width) };
    this.position.makeMove(move);
    this.#history.push(played);
    this.#legal = null;
    this.#countRepetition(1);
    return played;
  }

  playUci(uci: string): PlayedMove {
    const move = this.findMove(uci);
    if (!move) throw new Error(`둘 수 없는 수: ${uci}`);
    return this.play(move);
  }

  undo(): void {
    if (this.#history.length === 0) return;
    this.#countRepetition(-1);
    this.position.undoMove();
    this.#history.pop();
    this.#legal = null;
  }

  status(): GameStatus {
    if (this.legalMoves().length === 0) {
      if (!this.position.inCheck()) return { over: true, result: '1/2-1/2', reason: 'stalemate' };
      return { over: true, result: this.turn === WHITE ? '0-1' : '1-0', reason: 'checkmate' };
    }
    if ((this.#repetitions.get(this.position.repetitionKey()) ?? 0) >= REPETITION_LIMIT) return { over: true, result: '1/2-1/2', reason: 'repetition' };
    if (this.position.halfmoveClock >= FIFTY_MOVE_HALFMOVES) return { over: true, result: '1/2-1/2', reason: 'fiftyMove' };
    if (hasInsufficientMaterial(this.position)) return { over: true, result: '1/2-1/2', reason: 'insufficient' };
    return { over: false };
  }

  #countRepetition(delta: number): void {
    const key = this.position.repetitionKey();
    this.#repetitions.set(key, (this.#repetitions.get(key) ?? 0) + delta);
  }
}

/** 킹만 · 킹+나이트/비숍 하나 · 같은 색 칸 비숍들만 남으면 체크메이트 불가 */
export function hasInsufficientMaterial(position: Position): boolean {
  const { width } = position.geometry;
  const minors: { type: number; squareColor: number }[] = [];
  for (let square = 0; square < position.board.length; square++) {
    const piece = position.board[square];
    if (piece === EMPTY || typeOf(piece) === KING) continue;
    if (typeOf(piece) !== KNIGHT && typeOf(piece) !== BISHOP) return false;
    minors.push({ type: typeOf(piece), squareColor: ((square % width) + Math.floor(square / width)) % 2 });
  }
  if (minors.length <= 1) return true;
  return minors.every(minor => minor.type === BISHOP && minor.squareColor === minors[0].squareColor);
}

export const winnerOf = (result: GameResult): Side | null => (result === '1-0' ? WHITE : result === '0-1' ? BLACK : null);
