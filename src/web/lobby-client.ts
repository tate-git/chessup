// 매칭: 로비에 줄 서기 · 방 만들기(방 번호) · 방 들어가기 — 짝이 생기면 대국 id 를 받음
import type { LobbyClientMessage, LobbyServerMessage, TimeControl, VariantId } from '../shared/protocol';

export interface LobbyHandlers {
  readonly onMatched: (gameId: string) => void;
  readonly onError: (message: string) => void;
  readonly onQueued?: (waiting: number) => void;
  readonly onRoomCreated?: (code: string) => void;
}

export const socketUrl = (path: string) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;

/** 줄 선 동안 할 수 있는 것: 취소 · 사람 대신 랜덤 봇과 바로 */
export interface LobbyConnection {
  readonly cancel: () => void;
  readonly playBot: () => void;
}

/** 로비에 붙어 첫 글을 보내고 답을 넘겨줌 */
function connect(first: LobbyClientMessage, handlers: LobbyHandlers): LobbyConnection {
  const socket = new WebSocket(socketUrl('/api/lobby'));
  socket.addEventListener('open', () => socket.send(JSON.stringify(first)));
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)) as LobbyServerMessage;
    switch (message.type) {
      case 'queued': return handlers.onQueued?.(message.waiting);
      case 'roomCreated': return handlers.onRoomCreated?.(message.code);
      case 'matched':
        socket.close();
        return handlers.onMatched(message.gameId);
      case 'error': return handlers.onError(message.message);
    }
  });
  socket.addEventListener('error', () => handlers.onError('연결이 끊겼어요'));
  const send = (message: LobbyClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  return {
    cancel: () => {
      send({ type: 'cancel' });
      socket.close();
    },
    playBot: () => send({ type: 'playBot' }),
  };
}

export const seek = (variant: VariantId, timeControl: TimeControl, handlers: LobbyHandlers) => connect({ type: 'seek', variant, timeControl }, handlers);
export const createRoom = (variant: VariantId, timeControl: TimeControl, handlers: LobbyHandlers) => connect({ type: 'createRoom', variant, timeControl }, handlers);
export const joinRoom = (code: string, handlers: LobbyHandlers) => connect({ type: 'joinRoom', code }, handlers);

/** 방 링크(친구가 누르면 바로 들어옴) */
export const roomLink = (code: string) => `${location.origin}${location.pathname}#/room/${code}`;
