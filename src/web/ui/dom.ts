// 화면 조각 도우미
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function query<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`화면 요소 없음: ${selector}`);
  return element;
}

/** 분:초(10초 미만이면 소수 한 자리) */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 10_000) return (safe / 1000).toFixed(1);
  const totalSeconds = Math.ceil(safe / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function moveListHtml(sans: readonly string[]): string {
  const rows: string[] = [];
  for (let index = 0; index < sans.length; index += 2) {
    rows.push(`<li><span class="no">${index / 2 + 1}.</span><span>${sans[index]}</span><span>${sans[index + 1] ?? ''}</span></li>`);
  }
  return rows.join('');
}

/** 판 아래 버튼 글자: 아이콘 위 · 이름 아래(안에 넣는 글은 이 앱이 만든 고정 문구) */
export const actionLabel = (icon: string, label: string) => `<span class="action-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
