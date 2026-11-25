// 봇 연습 대국 화면
import { BLACK, BOT_LEVELS, WHITE, type Side } from '../../engine';
import { LocalHints, ServerHints, type HintSource } from '../hints';
import { t } from '../i18n';
import { PracticeSession, type PracticeOutcome } from '../practice';
import { loadCleared } from '../practice-record';
import { session, settings, type ColorChoice } from '../session';
import { askResign } from '../ui/ask-resign';
import { actionLabel, query } from '../ui/dom';
import { endReasonLabel, variantLabel } from './labels';
import type { Screen } from './screen';

function resolveColor(choice: ColorChoice): Side {
  if (choice === 'random') return Math.random() < 0.5 ? WHITE : BLACK;
  return choice === 'white' ? WHITE : BLACK;
}

const hintSource = (): HintSource => (session.me ? new ServerHints() : new LocalHints());

export const practiceScreen = (level: number): Screen => async root => {
  const variant = settings.variant;
  root.innerHTML = `
    <section class="play">
      <header class="play-bar">
        <a href="#/" class="back">← ${t('홈', 'Home')}</a>
        <span>${variantLabel(variant)} · 🤖 ${t(`봇 ${level}단`, `Bot level ${level}`)}</span>
      </header>
      <div class="table slim">
        <div class="board-stack">
          <div class="board-wrap"><div id="board"></div></div>
          <p id="status" class="sr-only" aria-live="polite"></p>
          <div class="board-actions">
            <button type="button" id="hint"></button>
            <button type="button" id="undo"></button>
            <button type="button" data-action="flip">${actionLabel('🔄', t('판 뒤집기', 'Flip board'))}</button>
            <button type="button" data-action="resign">${actionLabel('🏳️', t('기권', 'Resign'))}</button>
          </div>
        </div>
        <aside class="side">
          <ol id="moves" class="moves"></ol>
        </aside>
      </div>
      <dialog id="result" class="result"></dialog>
    </section>`;

  const progress = await loadCleared();
  const session = new PracticeSession(
    {
      variant,
      level,
      playerSide: resolveColor(settings.color),
      clearedBefore: progress.cleared[variant],
      unassistedBefore: progress.unassisted[variant],
      hints: hintSource(),
    },
    {
      board: query(root, '#board'),
      status: query(root, '#status'),
      moves: query(root, '#moves'),
      hintButton: query<HTMLButtonElement>(root, '#hint'),
      undoButton: query<HTMLButtonElement>(root, '#undo'),
      onFinish: outcome => showResult(root, level, outcome),
    },
  );
  query(root, '#hint').onclick = () => void session.hint();
  query(root, '#undo').onclick = () => session.undo();
  query(root, '[data-action="flip"]').onclick = () => session.flip();
  query(root, '[data-action="resign"]').onclick = async () => {
    if (await askResign()) session.resign();
  };
};

function showResult(root: HTMLElement, level: number, { status, won, assisted, newClear, newUnassistedClear }: PracticeOutcome): void {
  const dialog = query<HTMLDialogElement>(root, '#result');
  const draw = status.result === '1/2-1/2';
  const canAdvance = won && level < BOT_LEVELS.length;
  dialog.innerHTML = `
    <p class="result-icon">${won ? '🏆' : draw ? '🤝' : '😵'}</p>
    <h2>${won ? t('승리!', 'You win!') : draw ? t('무승부', 'Draw') : t('패배', 'You lost')}</h2>
    <p class="muted">${endReasonLabel(status.reason)}${clearNote(level, assisted, newClear, newUnassistedClear)}</p>
    <div class="row">
      ${canAdvance ? `<a class="button primary" href="#/practice/${level + 1}">${t(`${level + 1}단 도전`, `Try level ${level + 1}`)}</a>` : ''}
      <button type="button" data-action="again">${t('한 판 더', 'Play again')}</button>
      <a class="button ghost" href="#/">${t('홈', 'Home')}</a>
    </div>`;
  query(dialog, '[data-action="again"]').onclick = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  dialog.showModal();
}

/** 결과 아래 한 줄: 첫 격파 · 도움 없이 첫 격파 · 도움 받아 이김 */
function clearNote(level: number, assisted: boolean, newClear: boolean, newUnassistedClear: boolean): string {
  if (newUnassistedClear) return ` · ${t(`봇 ${level}단 도움 없이 격파!`, `Level ${level} cleared on your own!`)}`;
  if (newClear) return ` · ${t(`봇 ${level}단 첫 격파 🤝(힌트·뒤로가기 사용)`, `Level ${level} cleared 🤝 (with help)`)}`;
  if (assisted) return ` · ${t('도움 없이 이기면 🤝 표시가 사라져요', 'Win without help to drop the 🤝')}`;
  return '';
}
