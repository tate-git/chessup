// 방 링크(#/room/1234)로 들어오면: 로그인 안 했으면 게스트로 시작하고 그 방에 바로 들어감
import { api } from '../api';
import { t } from '../i18n';
import { joinRoom } from '../lobby-client';
import { session } from '../session';
import { query } from '../ui/dom';
import { navigate, type Screen } from './screen';

export const roomScreen = (code: string): Screen => root => {
  root.innerHTML = `
    <section class="play">
      <header class="play-bar"><a href="#/" class="back">← ${t('홈', 'Home')}</a><span>🔑 ${t(`방 ${code}`, `Room ${code}`)}</span></header>
      <div class="card room-join"><p class="result-icon">🚪</p><p id="room-info" class="muted">${t('방에 들어가는 중…', 'Joining the room…')}</p></div>
    </section>`;
  const info = query(root, '#room-info');
  let cancel: (() => void) | null = null;
  let left = false;

  void (async () => {
    if (!session.me) await api.guest();
    if (left) return;
    cancel = joinRoom(code, {
      onMatched: gameId => {
        cancel = null;
        navigate(`#/live/${gameId}`);
      },
      onError: message => (info.textContent = message),
    });
  })();

  return () => {
    left = true;
    cancel?.();
  };
};
