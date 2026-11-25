// 종목: 정통 체스(8×8) · 미니 체스(로스앨러모스 6×6 — 비숍 없음 · 캐슬링·두 칸 전진·앙파상 없음 · 비숍으로 승진 없음)
import { BISHOP, KNIGHT, QUEEN, ROOK } from './pieces';

export type VariantId = 'standard' | 'mini';

export interface Variant {
  readonly id: VariantId;
  readonly width: number;
  readonly height: number;
  readonly startFen: string;
  readonly castling: boolean;
  readonly doublePawnPush: boolean;
  readonly enPassant: boolean;
  readonly promotions: readonly number[];
}

const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT] as const;
const PROMOTIONS_WITHOUT_BISHOP = [QUEEN, ROOK, KNIGHT] as const;

export const VARIANTS: Readonly<Record<VariantId, Variant>> = {
  standard: {
    id: 'standard',
    width: 8,
    height: 8,
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    castling: true,
    doublePawnPush: true,
    enPassant: true,
    promotions: PROMOTIONS,
  },
  mini: {
    id: 'mini',
    width: 6,
    height: 6,
    startFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    castling: false,
    doublePawnPush: false,
    enPassant: false,
    promotions: PROMOTIONS_WITHOUT_BISHOP,
  },
};

export const isVariantId = (value: unknown): value is VariantId => value === 'standard' || value === 'mini';
