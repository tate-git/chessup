// 봇 단계 가로 휠: 옆으로 넘기면 가운데 단계가 선택됨 · 누르거나 ←→ 키로도 고름
export interface WheelLevel {
  readonly level: number;
  readonly label: string;
  /** 단계 아래 작은 표시(✓ · ✓🤝 · 빈 글자) */
  readonly mark: string;
}

/** wheel 안에 단계들을 그리고, 고를 때마다 onSelect · 처음엔 initial 을 가운데로 */
export function mountLevelWheel(wheel: HTMLElement, levels: readonly WheelLevel[], initial: number, onSelect: (level: number) => void): void {
  wheel.setAttribute('role', 'listbox');
  wheel.tabIndex = 0;
  wheel.innerHTML = levels
    .map(({ level, label, mark }) => `<button type="button" role="option" class="wheel-item" data-level="${level}"><span>${label}</span><small>${mark}</small></button>`)
    .join('');
  const items = [...wheel.querySelectorAll<HTMLElement>('.wheel-item')];
  let selected = -1;

  const select = (level: number) => {
    if (level === selected) return;
    selected = level;
    for (const item of items) item.setAttribute('aria-selected', String(Number(item.dataset.level) === level));
    onSelect(level);
  };
  const center = (level: number, behavior: ScrollBehavior) => {
    const item = items.find(element => Number(element.dataset.level) === level);
    if (item) wheel.scrollTo({ left: item.offsetLeft + item.offsetWidth / 2 - wheel.clientWidth / 2, behavior });
  };
  /** 가운데에 가장 가까운 단계 */
  const nearest = () => {
    const middle = wheel.scrollLeft + wheel.clientWidth / 2;
    const closest = items.reduce((best, item) =>
      Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - middle) ? item : best);
    return Number(closest.dataset.level);
  };

  let frame = 0;
  wheel.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => select(nearest()));
  });
  wheel.addEventListener('click', event => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('.wheel-item');
    if (item) center(Number(item.dataset.level), 'smooth');
  });
  wheel.addEventListener('keydown', event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = Math.min(Math.max(selected + step, levels[0].level), levels.at(-1)!.level);
    center(next, 'smooth');
  });

  select(initial);
  center(initial, 'instant');
}
