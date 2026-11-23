// 말 코드: 양수 = 백, 음수 = 흑, 0 = 빈칸
export type Side = 1 | -1;
export const WHITE: Side = 1;
export const BLACK: Side = -1;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

const LETTERS = ' pnbrqk';

export const typeOf = (piece: number): number => Math.abs(piece);
export const sideOf = (piece: number): Side => (piece > 0 ? WHITE : BLACK);
export const opponent = (side: Side): Side => (side === WHITE ? BLACK : WHITE);
export const sideName = (side: Side): 'w' | 'b' => (side === WHITE ? 'w' : 'b');

export function pieceToChar(piece: number): string {
  const letter = LETTERS[typeOf(piece)];
  return piece > 0 ? letter.toUpperCase() : letter;
}

export function charToPiece(char: string): number {
  const type = LETTERS.indexOf(char.toLowerCase());
  if (type <= 0) throw new Error(`알 수 없는 말: ${char}`);
  return char === char.toUpperCase() ? type : -type;
}
