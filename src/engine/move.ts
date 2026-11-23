// 수 하나: 어디서 어디로 · 움직인 말 · 잡은 말 · 승진 · 특수 수
import { pieceToChar, typeOf } from './pieces';
import { squareName } from './geometry';

export type MoveKind = 'normal' | 'double' | 'enPassant' | 'castleKing' | 'castleQueen';

export interface Move {
  readonly from: number;
  readonly to: number;
  readonly piece: number;
  readonly captured: number;
  /** 승진할 말(부호 포함) · 없으면 0 */
  readonly promotion: number;
  readonly kind: MoveKind;
}

export const isCapture = (move: Move) => move.captured !== 0;

/** 'e2e4' · 'e7e8q' 꼴(서버와 주고받는 표기) */
export function moveToUci(move: Move, width: number): string {
  const promotion = move.promotion ? pieceToChar(-typeOf(move.promotion)) : '';
  return squareName(move.from, width) + squareName(move.to, width) + promotion;
}
