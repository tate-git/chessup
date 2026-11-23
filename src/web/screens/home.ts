// 홈: 종목 · 봇 연습(단계) · 랭크 대국(로그인 필요) · 내 정보
import { BOT_LEVELS } from '../../engine';
import { TIME_CONTROLS, type TimeControl, type VariantId } from '../../shared/protocol';
import { api } from '../api';
import { lang, switchLang, t } from '../i18n';
import { seek } from '../lobby-client';
import { loadCleared } from '../practice-record';
import { session, settings, type ColorChoice } from '../session';
import { escapeHtml, query } from '../ui/dom';
import { ratingText, variantLabel } from './labels';
import { navigate, type Screen } from './screen';

const COLOR_CHOICES: readonly ColorChoice[] = ['white', 'black', 'random'];
const colorLabel = (choice: ColorChoice) => ({ white: t('⚪ 백으로', '⚪ White'), black: t('⚫ 흑으로', '⚫ Black'), random: t('🎲 무작위', '🎲 Random') })[choice];

export const homeScreen: Screen = async root => {
  let cancelSeek: (() => void) | null = null;
  const render = async () => {
    document.documentElement.lang = lang;
    document.title = t('체스업', 'Chessup');
    const variant = settings.variant;
    const cleared = (await loadCleared())[variant];
    root.innerHTML = `
      <section class="home">
        <nav class="topnav">
          <a href="#/leaderboard">🏆 ${t('랭킹', 'Leaderboard')}</a>
          ${session.me ? `<span class="me">👤 <b>${escapeHtml(session.me.username)}</b></span><button type="button" data-action="logout" class="ghost">${t('로그아웃', 'Log out')}</button>` : `<a href="#/login" class="login-link">${t('로그인', 'Log in')}</a>`}
          <button type="button" data-action="lang" class="ghost">${t('🌐 English', '🌐 한국어')}</button>
        </nav>
        <header class="hero">
          <img src="/piece/ln.svg" alt="" class="hero-piece">
          <h1>${t('체스업', 'Chessup')}</h1>
          <p>${t('체스로 랭크를 올려요', 'Climb the ranks with chess')}</p>
        </header>
        <div class="segmented" role="tablist">
          ${(['standard', 'mini'] as const).map(id => `<button type="button" role="tab" aria-selected="${id === variant}" data-variant="${id}">${variantLabel(id)}</button>`).join('')}
        </div>
        ${rankedCard(variant)}
        <article class="card">
          <h2>🤖 ${t('봇과 연습', 'Practice with bots')}</h2>
          <p class="muted">${t('1단부터 10단까지 · 이긴 단계는 ✓ · 레이팅과 무관 · 힌트는 봇 대국에서만', 'Levels 1–10 · cleared levels get ✓ · unrated · hints only vs bots')}</p>
          <div class="segmented small">
            ${COLOR_CHOICES.map(choice => `<button type="button" aria-selected="${choice === settings.color}" data-color="${choice}">${colorLabel(choice)}</button>`).join('')}
          </div>
          <div class="levels">
            ${BOT_LEVELS.map(({ level }) => `<a class="button level ${level <= cleared ? 'cleared' : ''} ${level === cleared + 1 ? 'next' : ''}" href="#/practice/${level}">${level}${t('단', '')}${level <= cleared ? ' ✓' : ''}</a>`).join('')}
          </div>
        </article>
        <footer class="credits">${t('말 그림', 'Pieces')}: Colin M.L. Burnett (BSD/GPL/CC BY-SA)</footer>
      </section>
      <dialog id="seeking" class="result"></dialog>`;
  };

  const rankedCard = (variant: VariantId) => {
    const me = session.me;
    if (!me) {
      return `<article class="card"><h2>⚔️ ${t('랭크 대국', 'Ranked games')}</h2>
        <p class="muted">${t('사람과 실시간 대국 · 이기면 레이팅이 올라요', 'Play people live · win to climb the ladder')}</p>
        <a class="button primary" href="#/login">${t('로그인하고 시작', 'Log in to play')}</a></article>`;
    }
    const rating = me.ratings[variant];
    return `<article class="card ranked">
      <h2>⚔️ ${t('랭크 대국', 'Ranked games')} <span class="rating">${ratingText(rating.rating, rating.provisional)}</span></h2>
      <p class="muted">${t(`${rating.games}판 · ${rating.wins}승 ${rating.losses}패 ${rating.draws}무`, `${rating.games} games · ${rating.wins}W ${rating.losses}L ${rating.draws}D`)}</p>
      <div class="time-controls">${TIME_CONTROLS[variant].map(tc => `<button type="button" class="primary" data-seek="${tc}">⏱ ${tc}</button>`).join('')}</div>
    </article>`;
  };

  const startSeeking = (timeControl: TimeControl) => {
    const dialog = query<HTMLDialogElement>(root, '#seeking');
    dialog.innerHTML = `<p class="result-icon">🔎</p><h2>${t('상대를 찾는 중…', 'Finding an opponent…')}</h2><p class="muted" id="seek-info">${variantLabel(settings.variant)} · ${timeControl}</p><div class="row"><button type="button" data-action="cancel-seek">${t('취소', 'Cancel')}</button></div>`;
    dialog.showModal();
    cancelSeek = seek(settings.variant, timeControl, {
      onQueued: waiting => (query(dialog, '#seek-info').textContent = `${variantLabel(settings.variant)} · ${timeControl} · ${t(`대기 ${waiting}명`, `${waiting} waiting`)}`),
      onMatched: gameId => {
        cancelSeek = null;
        dialog.close();
        navigate(`#/live/${gameId}`);
      },
      onError: message => (query(dialog, '#seek-info').textContent = message),
    });
  };

  const stopSeeking = () => {
    cancelSeek?.();
    cancelSeek = null;
    root.querySelector<HTMLDialogElement>('#seeking')?.close();
  };

  root.onclick = async event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!button) return;
    const { action, variant, color, seek: timeControl } = button.dataset;
    if (variant) settings.variant = variant as VariantId;
    if (color) settings.color = color as ColorChoice;
    if (timeControl) return startSeeking(timeControl as TimeControl);
    if (action === 'cancel-seek') return stopSeeking();
    if (action === 'lang') switchLang();
    if (action === 'logout') {
      await api.logout();
      session.me = null;
    }
    await render();
  };

  await render();
  return stopSeeking;
};
