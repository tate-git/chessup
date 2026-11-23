// 대국 시계: 서버 시각이 기준 · 첫 수(양쪽)는 시간 안 깎음 · 대신 30초 안에 안 두면 판 취소
import type { Clocks, Color } from '../../shared/protocol';

export const FIRST_MOVE_LIMIT_MS = 30_000;
const FIRST_MOVES = 2;

export const colorToMove = (ply: number): Color => (ply % 2 === 0 ? 'white' : 'black');
export const isOpeningPly = (ply: number) => ply < FIRST_MOVES;

/** 지금 시각 기준 남은 시간(둘 차례인 쪽만 줄어듦) */
export function liveClocks(clocks: Clocks, ply: number, turnStartedAt: number, now: number): Clocks {
  if (isOpeningPly(ply)) return clocks;
  const mover = colorToMove(ply);
  return { ...clocks, [mover]: Math.max(0, clocks[mover] - (now - turnStartedAt)) };
}

/** 수를 둔 뒤: 쓴 시간 빼고 추가 시간 더함 */
export function clocksAfterMove(clocks: Clocks, ply: number, turnStartedAt: number, now: number, incrementMs: number): Clocks {
  const mover = colorToMove(ply);
  const remaining = liveClocks(clocks, ply, turnStartedAt, now)[mover];
  return { ...clocks, [mover]: isOpeningPly(ply) ? remaining : remaining + incrementMs };
}

/** 이 시각이 되면 알람: 첫 수 제한 또는 시간 초과 */
export function nextDeadline(clocks: Clocks, ply: number, turnStartedAt: number): number {
  return turnStartedAt + (isOpeningPly(ply) ? FIRST_MOVE_LIMIT_MS : clocks[colorToMove(ply)]);
}
