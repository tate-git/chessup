// 판 모양별로 한 번만 계산해 두는 표: 칸 이름 · 나이트/킹이 닿는 칸 · 8방향 직선
export interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly knightTargets: readonly (readonly number[])[];
  readonly kingTargets: readonly (readonly number[])[];
  /** rays[square][direction] = 그 방향으로 가까운 칸부터 판 끝까지 */
  readonly rays: readonly (readonly (readonly number[])[])[];
}

const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
/** 0~3 = 직선(룩), 4~7 = 대각선(비숍) */
export const ORTHOGONAL = [0, 1, 2, 3] as const;
export const DIAGONAL = [4, 5, 6, 7] as const;
const RAY_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;

const cache = new Map<string, Geometry>();

export function geometryFor(width: number, height: number): Geometry {
  const key = `${width}x${height}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const size = width * height;
  const inside = (file: number, rank: number) => file >= 0 && file < width && rank >= 0 && rank < height;
  const targets = (steps: readonly (readonly [number, number])[]) =>
    Array.from({ length: size }, (_, square) => {
      const file = square % width;
      const rank = Math.floor(square / width);
      return steps
        .filter(([df, dr]) => inside(file + df, rank + dr))
        .map(([df, dr]) => (rank + dr) * width + file + df);
    });
  const rays = Array.from({ length: size }, (_, square) =>
    RAY_STEPS.map(([df, dr]) => {
      const line: number[] = [];
      let file = square % width + df;
      let rank = Math.floor(square / width) + dr;
      while (inside(file, rank)) {
        line.push(rank * width + file);
        file += df;
        rank += dr;
      }
      return line;
    }),
  );

  const geometry: Geometry = { width, height, size, knightTargets: targets(KNIGHT_STEPS), kingTargets: targets(KING_STEPS), rays };
  cache.set(key, geometry);
  return geometry;
}

export const fileOf = (square: number, width: number) => square % width;
export const rankOf = (square: number, width: number) => Math.floor(square / width);

export function squareName(square: number, width: number): string {
  return String.fromCharCode(97 + fileOf(square, width)) + (rankOf(square, width) + 1);
}

export function parseSquare(name: string, width: number): number {
  const file = name.charCodeAt(0) - 97;
  const rank = Number(name.slice(1)) - 1;
  return rank * width + file;
}
