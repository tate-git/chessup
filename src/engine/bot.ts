// 봇 10단계(연습용) · 힌트
import type { Move } from './move';
import type { Position } from './position';
import { search } from './search';

export interface BotLevel {
  readonly level: number;
  readonly depth: number;
  readonly timeLimitMs: number;
  readonly noise: number;
}

export const BOT_LEVELS: readonly BotLevel[] = [
  { level: 1, depth: 1, timeLimitMs: 300, noise: 350 },
  { level: 2, depth: 1, timeLimitMs: 300, noise: 180 },
  { level: 3, depth: 2, timeLimitMs: 400, noise: 140 },
  { level: 4, depth: 2, timeLimitMs: 400, noise: 70 },
  { level: 5, depth: 3, timeLimitMs: 600, noise: 45 },
  { level: 6, depth: 3, timeLimitMs: 600, noise: 15 },
  { level: 7, depth: 4, timeLimitMs: 900, noise: 0 },
  { level: 8, depth: 5, timeLimitMs: 1400, noise: 0 },
  { level: 9, depth: 6, timeLimitMs: 2000, noise: 0 },
  { level: 10, depth: 12, timeLimitMs: 3000, noise: 0 },
];

const HINT = { depth: 12, timeLimitMs: 1500 } as const;

/** timeCapMs: 생각 시간 상한(서버에서 둘 때 짧게) · 단계의 깊이·흔들림은 그대로 */
export function chooseBotMove(position: Position, level: number, random: () => number = Math.random, timeCapMs = Infinity): Move | null {
  const settings = BOT_LEVELS[Math.min(Math.max(level, 1), BOT_LEVELS.length) - 1];
  return search(position, { maxDepth: settings.depth, timeLimitMs: Math.min(settings.timeLimitMs, timeCapMs), noise: settings.noise, random }).move;
}

export function findHint(position: Position): Move | null {
  return search(position, { maxDepth: HINT.depth, timeLimitMs: HINT.timeLimitMs }).move;
}
