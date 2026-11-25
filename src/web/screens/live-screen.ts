// 사람과 실시간 대국 화면(내 판이 아니면 관전)
import type { Color, GameSummary } from '../../shared/protocol';
import { t } from '../i18n';
import { LiveSession } from '../live-session';
import { session } from '../session';
import { query } from '../ui/dom';
import { endReasonLabel, variantLabel } from './labels';
import type { Screen } from './screen';

export const liveScreen = (gameId: string): Screen => root => {
  root.innerHTML = `
    <section class="play">
      <header class="play-bar">
        <a href="#/" class="back">← ${t('홈', 'Home')}</a>
        <span id="title"></span>
      </header>
      <div class="table">
        <div class="board-column">
          <div class="player-bar"><span id="top-player"></span><span id="top-clock" class="clock"></span></div>
          <div class="board-wrap"><div id="board"></div></div>
          <div class="player-bar"><span id="bottom-player"></span><span id="bottom-clock" class="clock"></span></div>
        </div>
        <aside class="side">
          <p id="status" class="status"></p>
          <div id="draw-buttons" class="controls" hidden>
            <button type="button" class="primary" data-action="accept">🤝 ${t('무승부 수락', 'Accept draw')}</button>
            <button type="button" data-action="decline">${t('거절', 'Decline')}</button>
          </div>
          <ol id="moves" class="moves"></ol>
          <div class="controls">
            <button type="button" data-action="offer">🤝 ${t('무승부 제안', 'Offer draw')}</button>
            <button type="button" data-action="resign">🏳️ ${t('기권', 'Resign')}</button>
          </div>
        </aside>
      </div>
      <dialog id="result" class="result"></dialog>
    </section>`;

  const live = new LiveSession(gameId, {
    board: query(root, '#board'),
    title: query(root, '#title'),
    topPlayer: query(root, '#top-player'),
    bottomPlayer: query(root, '#bottom-player'),
    topClock: query(root, '#top-clock'),
    bottomClock: query(root, '#bottom-clock'),
    moves: query(root, '#moves'),
    status: query(root, '#status'),
    drawButtons: query(root, '#draw-buttons'),
    onEnd: (summary, you) => showResult(root, summary, you),
  });
  root.onclick = event => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'resign' && confirm(t('기권할까요?', 'Resign this game?'))) live.resign();
    if (action === 'offer') live.offerDraw();
    if (action === 'accept') live.answerDraw(true);
    if (action === 'decline') live.answerDraw(false);
  };
  return () => live.close();
};

function showResult(root: HTMLElement, summary: GameSummary, you: Color | 'spectator'): void {
  query(root, '#title').textContent = `⚔️ ${variantLabel(summary.variant)} · ${summary.timeControl}`;
  const winner: Color | null = summary.result === '1-0' ? 'white' : summary.result === '0-1' ? 'black' : null;
  const headline = you === 'spectator' ? summary.result : winner === null ? t('무승부', 'Draw') : winner === you ? t('승리!', 'You win!') : t('패배', 'You lost');
  const mine = you === 'spectator' ? undefined : summary[you];
  const changeText = !mine || mine.ratingChange === undefined || mine.rating === undefined || summary.reason === 'abandon'
    ? (mine && mine.rating === undefined ? `<p class="muted">${t('게스트는 레이팅이 쌓이지 않아요 · 가입하면 쌓여요', 'Guests have no rating — sign up to keep one')}</p>` : '')
    : `<p class="rating-change ${mine.ratingChange >= 0 ? 'up' : 'down'}">${mine.ratingChange >= 0 ? '▲' : '▼'} ${Math.abs(mine.ratingChange)} → ${mine.rating + mine.ratingChange}</p>`;
  const dialog = query<HTMLDialogElement>(root, '#result');
  dialog.innerHTML = `
    <p class="result-icon">${winner === null ? '🤝' : winner === you ? '🏆' : you === 'spectator' ? '♟️' : '😵'}</p>
    <h2>${headline}</h2>
    <p class="muted">${endReasonLabel(summary.reason)}</p>
    ${changeText}
    <div class="row"><a class="button primary" href="#/">${t('홈으로', 'Home')}</a></div>`;
  dialog.showModal();
  void session.refresh();   // 바뀐 레이팅 반영
}
