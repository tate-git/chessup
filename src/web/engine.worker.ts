// 봇·힌트 계산은 별도 스레드에서(화면이 멈추지 않게)
import { chooseBotMove, findHint, Game, moveToUci, type VariantId } from '../engine';

export type EngineRequest =
  | { readonly id: number; readonly kind: 'bot'; readonly variant: VariantId; readonly fen: string; readonly level: number }
  | { readonly id: number; readonly kind: 'hint'; readonly variant: VariantId; readonly fen: string };

export interface EngineResponse {
  readonly id: number;
  readonly uci: string | null;
}

self.onmessage = ({ data }: MessageEvent<EngineRequest>) => {
  const game = new Game(data.variant, data.fen);
  const move = data.kind === 'bot' ? chooseBotMove(game.position, data.level) : findHint(game.position);
  const response: EngineResponse = { id: data.id, uci: move ? moveToUci(move, game.width) : null };
  self.postMessage(response);
};
