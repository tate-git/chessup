// 매칭: 로비에 줄 서고, 짝이 생기면 대국 id 를 받음
import type { LobbyServerMessage, TimeControl, VariantId } from '../shared/protocol';

export interface SeekHandlers {
  readonly onQueued: (waiting: number) => void;
  readonly onMatched: (gameId: string) => void;
  readonly onError: (message: string) => void;
}

export const socketUrl = (path: string) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;

/** 줄 서기 시작(rated = false 면 친선) · 돌려준 함수를 부르면 취소 */
export function seek(variant: VariantId, timeControl: TimeControl, rated: boolean, handlers: SeekHandlers): () => void {
  const socket = new WebSocket(socketUrl('/api/lobby'));
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'seek', variant, timeControl, rated })));
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)) as LobbyServerMessage;
    if (message.type === 'queued') handlers.onQueued(message.waiting);
    else if (message.type === 'matched') {
      socket.close();
      handlers.onMatched(message.gameId);
    } else handlers.onError(message.message);
  });
  socket.addEventListener('error', () => handlers.onError('연결이 끊겼어요'));
  return () => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'cancel' }));
    socket.close();
  };
}
