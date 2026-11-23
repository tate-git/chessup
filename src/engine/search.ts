// 수 찾기: 알파-베타 + 정지 탐색(잡는 수 끝까지) + 반복 심화(시간 안에서 점점 깊게)
import { evaluate, PIECE_VALUE } from './evaluate';
import { legalCaptures, legalMoves } from './movegen';
import type { Move } from './move';
import { typeOf } from './pieces';
import type { Position } from './position';

export const MATE_SCORE = 100_000;
const INFINITY = 1_000_000;
const FIFTY_MOVE_HALFMOVES = 100;
const TIME_CHECK_INTERVAL = 1024;

export interface SearchOptions {
  readonly maxDepth: number;
  readonly timeLimitMs: number;
  /** 0보다 크면 첫 수마다 ±noise 센티폰을 섞어 일부러 덜 정확하게 고름(약한 봇) */
  readonly noise?: number;
  readonly random?: () => number;
}

export interface SearchResult {
  readonly move: Move | null;
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
}

class TimeUp extends Error {}

export function search(position: Position, options: SearchOptions): SearchResult {
  return new Searcher(position, options).run();
}

class Searcher {
  #nodes = 0;
  readonly #deadline: number;

  constructor(private readonly position: Position, private readonly options: SearchOptions) {
    this.#deadline = Date.now() + options.timeLimitMs;
  }

  run(): SearchResult {
    const moves = orderMoves(legalMoves(this.position));
    if (moves.length === 0) return { move: null, score: 0, depth: 0, nodes: 0 };
    if (this.options.noise) return this.#noisyRoot(moves);

    let best: SearchResult = { move: moves[0], score: 0, depth: 0, nodes: 0 };
    for (let depth = 1; depth <= this.options.maxDepth; depth++) {
      try {
        best = this.#searchRoot(moves, depth);
        moves.sort((a, b) => (a === best.move ? -1 : b === best.move ? 1 : 0));   // 다음 깊이는 지난 최선 수부터
        if (Math.abs(best.score) > MATE_SCORE - 1000) break;
      } catch (error) {
        if (error instanceof TimeUp) break;
        throw error;
      }
    }
    return best;
  }

  #searchRoot(moves: Move[], depth: number): SearchResult {
    let alpha = -INFINITY;
    let bestMove = moves[0];
    for (const move of moves) {
      const score = this.#scoreMove(move, depth, -INFINITY, -alpha);
      if (score > alpha) {
        alpha = score;
        bestMove = move;
      }
    }
    return { move: bestMove, score: alpha, depth, nodes: this.#nodes };
  }

  /** 약한 봇: 모든 첫 수를 같은 깊이로 재고 잡음을 더해 고름(시간 제한 없음 — 얕은 깊이에서만 씀) */
  #noisyRoot(moves: Move[]): SearchResult {
    const random = this.options.random ?? Math.random;
    const noise = this.options.noise ?? 0;
    const depth = this.options.maxDepth;
    const scored = moves.map(move => ({ move, score: this.#scoreMove(move, depth, -INFINITY, INFINITY, false) + (random() * 2 - 1) * noise }));
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    return { move: best.move, score: Math.round(best.score), depth, nodes: this.#nodes };
  }

  #scoreMove(move: Move, depth: number, alpha: number, beta: number, timed = true): number {
    this.position.makeMove(move);
    try {
      return -this.#negamax(depth - 1, alpha, beta, 1, timed);
    } finally {
      this.position.undoMove();
    }
  }

  #negamax(depth: number, alpha: number, beta: number, ply: number, timed: boolean): number {
    this.#tick(timed);
    const inCheck = this.position.inCheck();
    if (depth <= 0 && !inCheck) return this.#quiescence(alpha, beta, timed);
    if (this.position.halfmoveClock >= FIFTY_MOVE_HALFMOVES) return 0;

    const moves = orderMoves(legalMoves(this.position));
    if (moves.length === 0) return inCheck ? -MATE_SCORE + ply : 0;

    for (const move of moves) {
      this.position.makeMove(move);
      let score: number;
      try {
        score = -this.#negamax(depth - 1, -beta, -alpha, ply + 1, timed);
      } finally {
        this.position.undoMove();
      }
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /** 조용해질 때까지 잡는 수만 더 봄(말 주고받다 끊겨 잘못 판단하는 일 막기) */
  #quiescence(alpha: number, beta: number, timed: boolean): number {
    this.#tick(timed);
    const standPat = evaluate(this.position);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    for (const move of orderMoves(legalCaptures(this.position))) {
      this.position.makeMove(move);
      let score: number;
      try {
        score = -this.#quiescence(-beta, -alpha, timed);
      } finally {
        this.position.undoMove();
      }
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  #tick(timed: boolean): void {
    this.#nodes += 1;
    if (timed && this.#nodes % TIME_CHECK_INTERVAL === 0 && Date.now() > this.#deadline) throw new TimeUp();
  }
}

/** 좋은 수를 먼저: 승진 → 싼 말로 비싼 말 잡기 → 나머지 */
function orderMoves(moves: Move[]): Move[] {
  const priority = (move: Move) =>
    (move.promotion ? PIECE_VALUE[typeOf(move.promotion)] * 10 : 0) +
    (move.captured ? PIECE_VALUE[typeOf(move.captured)] * 10 - PIECE_VALUE[typeOf(move.piece)] : 0);
  return moves.sort((a, b) => priority(b) - priority(a));
}
