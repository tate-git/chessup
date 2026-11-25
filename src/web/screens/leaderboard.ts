// 랭킹: 이번 주(승점 · 게스트 포함 · 한국 월요일 0시부터) / 전체(레이팅 · 회원 10판 이상)
import type { LeaderboardEntry, VariantId, WeeklyEntry } from '../../shared/protocol';
import { api } from '../api';
import { t } from '../i18n';
import { session, settings } from '../session';
import { escapeHtml } from '../ui/dom';
import { variantLabel } from './labels';
import type { Screen } from './screen';

type Tab = 'weekly' | 'all';

const guestTag = () => `<span class="tag">${t('게스트', 'Guest')}</span>`;
const points = (value: number) => t(`${value}점`, `${value} pt`);

/** 「11월 23일(월)부터」 */
function weekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split('-').map(Number);
  return t(`${month}월 ${day}일(월)부터`, `Since Mon ${month}/${day}`);
}

function weeklyRows(entries: readonly WeeklyEntry[]): string {
  if (entries.length === 0) return `<li class="muted">${t('이번 주에 둔 사람이 아직 없어요 · 첫 판을 둬 보세요', 'No games this week yet — be the first')}</li>`;
  return entries
    .map(entry => `<li class="${entry.mine ? 'mine' : ''}">
      <span class="rank">${entry.rank}</span>
      <span class="name">${escapeHtml(entry.username)}${entry.guest ? ` ${guestTag()}` : ''}</span>
      <span class="games muted">${entry.games}${t('판', ' games')} · ${entry.wins}${t('승', 'W')}</span>
      <b>${points(entry.points)}</b>
    </li>`)
    .join('');
}

function allTimeRows(entries: readonly LeaderboardEntry[]): string {
  if (entries.length === 0) return `<li class="muted">${t('아직 10판 이상 둔 회원이 없어요', 'No member has played 10 games yet')}</li>`;
  return entries
    .map(entry => `<li class="${entry.username === session.me?.username ? 'mine' : ''}">
      <span class="rank">${entry.rank}</span>
      <span class="name">${escapeHtml(entry.username)}</span>
      <span class="games muted">${entry.games}${t('판', ' games')}</span>
      <b>${entry.rating}</b>
    </li>`)
    .join('');
}

export const leaderboardScreen: Screen = async root => {
  let tab: Tab = 'weekly';

  const render = async () => {
    const variant = settings.variant;
    const [note, rows] = tab === 'weekly'
      ? await api.weekly(variant).then(({ weekStart, entries }) => [
          `${weekLabel(weekStart)} · ${t('승 1점 · 무 0.5점 · 게스트도 함께', 'win 1 · draw 0.5 · guests included')}`,
          weeklyRows(entries),
        ])
      : await api.leaderboard(variant).then(({ entries }) => [t('레이팅 순 · 회원만 · 10판 이상', 'By rating · members · 10+ games'), allTimeRows(entries)]);
    root.innerHTML = `
      <section class="board-page">
        <a href="#/" class="back">← ${t('홈', 'Home')}</a>
        <h1>🏆 ${t('랭킹', 'Leaderboard')}</h1>
        <div class="segmented">${(['weekly', 'all'] as const).map(id => `<button type="button" aria-selected="${id === tab}" data-tab="${id}">${id === 'weekly' ? t('이번 주', 'This week') : t('전체', 'All time')}</button>`).join('')}</div>
        <div class="segmented small">${(['standard', 'mini'] as const).map(id => `<button type="button" aria-selected="${id === variant}" data-variant="${id}">${variantLabel(id)}</button>`).join('')}</div>
        <p class="muted small">${note}</p>
        <ol class="ranking card">${rows}</ol>
      </section>`;
  };

  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-variant], [data-tab]');
    if (!button) return;
    if (button.dataset.variant) settings.variant = button.dataset.variant as VariantId;
    if (button.dataset.tab) tab = button.dataset.tab as Tab;
    void render();
  };
  await render();
};
