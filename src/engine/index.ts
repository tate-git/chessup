// 엔진 공개 입구(화면·서버가 함께 씀)
export { BOT_LEVELS, chooseBotMove, findHint } from './bot';
export { Game, winnerOf, type EndReason, type GameResult, type GameStatus, type PlayedMove } from './game';
export { parseSquare, squareName } from './geometry';
export { moveToUci, type Move } from './move';
export { BISHOP, BLACK, KNIGHT, opponent, PAWN, pieceToChar, QUEEN, ROOK, sideOf, typeOf, WHITE, type Side } from './pieces';
export { isVariantId, VARIANTS, type Variant, type VariantId } from './variants';
