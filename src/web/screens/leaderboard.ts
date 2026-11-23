// 랭킹(10판 이상 둔 사람)
import type { VariantId } from '../../shared/protocol';
import { api } from '../api';
import { t } from '../i18n';
import { session, settings } from '../session';
import { escapeHtml } from '../ui/dom';
import { variantLabel } from './labels';
import type { Screen } from './screen';

export const leaderboardScreen: Screen = async root => {
  const render = async (variant: VariantId) => {
    const { entries } = await api.leaderboard(variant);
    root.innerHTML = `
      <section class="board-page">
        <a href="#/" class="back">← ${t('홈', 'Home')}</a>
        <h1>🏆 ${t('랭킹', 'Leaderboard')}</h1>
        <div class="segmented">${(['standard', 'mini'] as const).map(id => `<button type="button" aria-selected="${id === variant}" data-variant="${id}">${variantLabel(id)}</button>`).join('')}</div>
        <ol class="ranking card">
          ${entries.length === 0 ? `<li class="muted">${t('아직 10판 이상 둔 사람이 없어요', 'Nobody has played 10 games yet')}</li>` : ''}
          ${entries.map(entry => `<li class="${entry.username === session.me?.username ? 'mine' : ''}"><span class="rank">${entry.rank}</span><span class="name">${escapeHtml(entry.username)}</span><span class="games muted">${entry.games}${t('판', ' games')}</span><b>${entry.rating}</b></li>`).join('')}
        </ol>
      </section>`;
  };
  root.onclick = event => {
    const variant = (event.target as HTMLElement).closest<HTMLElement>('[data-variant]')?.dataset.variant as VariantId | undefined;
    if (!variant) return;
    settings.variant = variant;
    void render(variant);
  };
  await render(settings.variant);
};
