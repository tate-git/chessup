// 홈: 종목 · 봇 연습(단계) · 랭크 대국(로그인 필요) · 내 정보
import { BOT_LEVELS } from '../../engine';
import { TIME_CONTROLS, type TimeControl, type VariantId } from '../../shared/protocol';
import { api } from '../api';
import { lang, switchLang, t } from '../i18n';
import { createRoom, joinRoom, roomLink, seek } from '../lobby-client';
import { loadCleared } from '../practice-record';
import { session, settings, type ColorChoice } from '../session';
import { escapeHtml, query } from '../ui/dom';
import { mountLevelWheel } from '../ui/level-wheel';
import { ratingText, variantLabel } from './labels';
import { navigate, type Screen } from './screen';

const COLOR_CHOICES: readonly ColorChoice[] = ['white', 'black', 'random'];
const colorLabel = (choice: ColorChoice) => ({ white: t('⚪ 백으로', '⚪ White'), black: t('⚫ 흑으로', '⚫ Black'), random: t('🎲 무작위', '🎲 Random') })[choice];

export const homeScreen: Screen = async root => {
  let cancelSeek: (() => void) | null = null;
  let roomCode: string | null = null;
  const render = async () => {
    document.documentElement.lang = lang;
    document.title = t('체스업', 'Chessup');
    const variant = settings.variant;
    const progress = await loadCleared();
    const cleared = progress.cleared[variant];
    const unassisted = progress.unassisted[variant];
    root.innerHTML = `
      <section class="home">
        <nav class="topnav">
          <a href="#/leaderboard">🏆 ${t('랭킹', 'Ranking')}</a>
          ${session.me ? `<span class="me" title="${escapeHtml(session.me.username)}">👤 <b>${escapeHtml(session.me.username)}</b></span><button type="button" data-action="logout" class="ghost">${t('로그아웃', 'Log out')}</button>` : `<a href="#/login" class="login-link">${t('로그인', 'Log in')}</a>`}
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
        ${matchCard(variant)}
        <article class="card">
          <h2>🤖 ${t('봇과 연습', 'Practice with bots')}</h2>
          <p class="muted">${t('1단~10단까지 실력을 키워요.', 'Build your skills from level 1 to 10.')}</p>
          <div class="segmented small">
            ${COLOR_CHOICES.map(choice => `<button type="button" aria-selected="${choice === settings.color}" data-color="${choice}">${colorLabel(choice)}</button>`).join('')}
          </div>
          <div class="level-wheel"></div>
          <a class="button primary wide" id="start-practice" href="#/practice/1"></a>
        </article>
        <footer class="credits">${t('말 그림', 'Pieces')}: Colin M.L. Burnett (BSD/GPL/CC BY-SA)</footer>
      </section>
      <dialog id="seeking" class="result"></dialog>`;
    mountLevelWheel(
      query(root, '.level-wheel'),
      BOT_LEVELS.map(({ level }) => ({ level, label: `${level}${t('단', '')}`, mark: clearMark(level, cleared, unassisted) })),
      Math.min(cleared + 1, BOT_LEVELS.length),
      level => {
        const start = query<HTMLAnchorElement>(root, '#start-practice');
        start.href = `#/practice/${level}`;
        start.textContent = t(`${level}단 도전하기`, `Play level ${level}`);
      },
    );
  };

  /** 대국 카드: 회원·게스트 한 줄(레이팅은 회원만) · 방 만들기 · 방 번호로 들어가기 */
  const matchCard = (variant: VariantId) => {
    const me = session.me;
    const rating = me?.ratings[variant];
    const heading = rating ? ` <span class="rating">${ratingText(rating.rating, rating.provisional)}</span>` : '';
    const intro = rating
      ? t(`${rating.games}판 · ${rating.wins}승 ${rating.losses}패 ${rating.draws}무`, `${rating.games} games · ${rating.wins}W ${rating.losses}L ${rating.draws}D`)
      : t('가입 없이 게스트로 바로 둬요 · 레이팅은 로그인하면 쌓여요', 'Play right away as a guest · log in to keep a rating');
    return `<article class="card ranked">
      <h2>⚔️ ${t('대국', 'Play')}${heading}</h2>
      <p class="muted">${intro}</p>
      <div class="time-controls">${TIME_CONTROLS[variant].map(tc => `<button type="button" class="primary" data-seek="${tc}">⏱ ${tc}</button>`).join('')}</div>
      <div class="room-row">
        <button type="button" data-action="room">🔑 ${t('방 만들기', 'Create room')}</button>
        <form class="join-room" novalidate>
          <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="${t('방 번호', 'Room no.')}" aria-label="${t('방 번호', 'Room number')}" autocomplete="off">
          <button type="submit">${t('들어가기', 'Join')}</button>
        </form>
      </div>
    </article>`;
  };

  /** 찾는 중 · 방 기다리는 중 창 */
  const waitDialog = (icon: string, title: string, body: string) => {
    const dialog = query<HTMLDialogElement>(root, '#seeking');
    dialog.innerHTML = `<p class="result-icon">${icon}</p><h2>${title}</h2>${body}<p class="muted" id="seek-info"></p><div class="row"><button type="button" data-action="cancel-seek">${t('취소', 'Cancel')}</button></div>`;
    if (!dialog.open) dialog.showModal();
    return dialog;
  };

  const goToGame = (gameId: string) => {
    cancelSeek = null;
    query<HTMLDialogElement>(root, '#seeking').close();
    navigate(`#/live/${gameId}`);
  };

  /** 로그인 안 했으면 게스트로 시작(쿠키) · 게스트 이름 */
  const ensurePlayer = async () => (session.me ? null : (await api.guest()).username);

  const startSeeking = async (timeControl: TimeControl) => {
    const guestName = await ensurePlayer();
    const label = `${variantLabel(settings.variant)} · ${timeControl}${guestName ? ` · ${guestName}` : ''}`;
    const dialog = waitDialog('🔎', t('상대를 찾는 중…', 'Finding an opponent…'), '');
    query(dialog, '#seek-info').textContent = label;
    cancelSeek = seek(settings.variant, timeControl, {
      onQueued: waiting => (query(dialog, '#seek-info').textContent = `${label} · ${t(`대기 ${waiting}명`, `${waiting} waiting`)}`),
      onMatched: goToGame,
      onError: message => (query(dialog, '#seek-info').textContent = message),
    });
  };

  /** 방 만들기: 시간 고르기 → 방 번호·링크 보여 주고 친구를 기다림 */
  const chooseRoomTime = () => {
    waitDialog('🔑', t('방 만들기', 'Create a room'),
      `<p class="muted">${variantLabel(settings.variant)} · ${t('시간을 고르세요', 'Pick a time control')}</p>
       <div class="time-controls">${TIME_CONTROLS[settings.variant].map(tc => `<button type="button" class="primary" data-room-time="${tc}">⏱ ${tc}</button>`).join('')}</div>`);
  };

  const openRoom = async (timeControl: TimeControl) => {
    await ensurePlayer();
    const dialog = waitDialog('⏳', t('방을 만드는 중…', 'Creating room…'), '');
    cancelSeek = createRoom(settings.variant, timeControl, {
      onRoomCreated: code => {
        roomCode = code;
        waitDialog('🔑', t('방을 만들었어요 · 방 번호', 'Room created · number'),
          `<p class="room-code">${code}</p>
           <p class="muted">${variantLabel(settings.variant)} · ${timeControl} · ${t('친구가 번호를 넣거나 링크를 누르면 바로 시작해요', 'Starts as soon as a friend enters the number or opens the link')}</p>
           <button type="button" class="primary wide" data-action="share-room">🔗 ${t('링크 공유', 'Share link')}</button>
           <p class="muted small room-link">${roomLink(code)}</p>`);
        query(dialog, '#seek-info').textContent = t('친구를 기다리는 중…', 'Waiting for your friend…');
      },
      onMatched: goToGame,
      onError: message => (query(dialog, '#seek-info').textContent = message),
    });
  };

  const enterRoom = async (code: string) => {
    if (!/^\d{4}$/.test(code)) return alert(t('방 번호는 숫자 네 자리예요', 'Room numbers are four digits'));
    await ensurePlayer();
    const dialog = waitDialog('🚪', t(`방 ${code}에 들어가는 중…`, `Joining room ${code}…`), '');
    cancelSeek = joinRoom(code, {
      onMatched: goToGame,
      onError: message => (query(dialog, '#seek-info').textContent = message),
    });
  };

  /** 폰(터치)은 공유 창 · 컴퓨터는 바로 복사 · 공유가 안 되면 복사 · 사용자가 공유 창을 닫은 건 그대로 둠 */
  const shareRoom = async (button: HTMLElement) => {
    if (!roomCode) return;
    const url = roomLink(roomCode);
    const text = t(`체스업 방 ${roomCode}에서 한 판 둬요!`, `Play me in Chessup room ${roomCode}!`);
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: t('체스업', 'Chessup'), text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      button.textContent = `✅ ${t('링크를 복사했어요', 'Link copied')}`;
    } catch {
      button.textContent = t('아래 링크를 길게 눌러 복사해 주세요', 'Copy the link below');
    }
  };

  const stopSeeking = () => {
    cancelSeek?.();
    cancelSeek = null;
    roomCode = null;
    root.querySelector<HTMLDialogElement>('#seeking')?.close();
  };

  root.onsubmit = event => {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>('.join-room');
    if (!form) return;
    event.preventDefault();
    void enterRoom(String(new FormData(form).get('code') ?? '').trim());
  };

  root.onclick = async event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!button || button.closest('.level-wheel')) return;   // 휠은 스스로 처리(다시 그리면 위치가 처음으로 감)
    const { action, variant, color, seek: timeControl, roomTime } = button.dataset;
    if (variant) settings.variant = variant as VariantId;
    if (color) settings.color = color as ColorChoice;
    if (timeControl) return startSeeking(timeControl as TimeControl);
    if (roomTime) return openRoom(roomTime as TimeControl);
    if (action === 'room') return chooseRoomTime();
    if (action === 'share-room') return shareRoom(button);
    if (action === 'cancel-seek') return stopSeeking();
    if (button.closest('form')) return;   // 방 들어가기는 아래 onsubmit
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

/** 도움 없이 깬 단계 ✓ · 힌트·무르기로만 깬 단계 ✓🤝 */
function clearMark(level: number, cleared: number, unassisted: number): string {
  if (level <= unassisted) return '✓';
  return level <= cleared ? '✓🤝' : '';
}
