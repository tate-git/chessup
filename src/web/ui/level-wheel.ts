// 봇 단계 가로 휠(룰렛처럼): 가운데(바늘)에 온 단계가 선택됨
// 크기·밝기는 가운데와의 거리로 매 프레임 바뀜 · 마우스는 끌어서 던지면 관성으로 굴러가다 가까운 단계에 부드럽게 멈춤
// 손가락(터치)은 브라우저 기본 관성 + 스냅 · 누르거나 ←→ 키로도 고름
export interface WheelLevel {
  readonly level: number;
  readonly label: string;
  /** 단계 아래 작은 표시(✓ · ✓🤝 · 빈 글자) */
  readonly mark: string;
}

/** 관성: 프레임마다 속도에 곱하는 값(1 에 가까울수록 오래 굴러감) */
const FRICTION = 0.94;
/** 이보다 느려지면 멈추고 가까운 단계로 */
const STOP_SPEED = 0.25;
/** 마지막 단계로 붙는 시간 */
const SETTLE_MS = 280;
/** 이만큼 넘게 끌었으면 「누름」이 아니라 「끌기」 */
const DRAG_THRESHOLD_PX = 5;
/** 끌다가 이만큼 멈췄다 놓으면 던지지 않음 */
const STILL_MS = 80;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** wheel 안에 단계들을 그리고, 고를 때마다 onSelect · 처음엔 initial 을 가운데로 */
export function mountLevelWheel(wheel: HTMLElement, levels: readonly WheelLevel[], initial: number, onSelect: (level: number) => void): void {
  wheel.setAttribute('role', 'listbox');
  wheel.tabIndex = 0;
  wheel.innerHTML = levels
    .map(({ level, label, mark }) => `<button type="button" role="option" class="wheel-item" data-level="${level}"><span>${label}</span><small>${mark}</small></button>`)
    .join('');
  const items = [...wheel.querySelectorAll<HTMLElement>('.wheel-item')];
  const levelOf = (item: HTMLElement) => Number(item.dataset.level);
  /** 휠 내용 기준 칸 가운데(offsetLeft 는 휠이 아니라 바깥 틀 기준이라 화면 좌표로 계산 · 크기 변환은 가운데를 안 바꿈) */
  const centerOf = (item: HTMLElement) => {
    const box = item.getBoundingClientRect();
    return box.left + box.width / 2 - wheel.getBoundingClientRect().left + wheel.scrollLeft;
  };
  const targetFor = (item: HTMLElement) => centerOf(item) - wheel.clientWidth / 2;
  let selected = -1;
  let animation = 0;

  const select = (level: number) => {
    if (level === selected) return;
    selected = level;
    for (const item of items) item.setAttribute('aria-selected', String(levelOf(item) === level));
    onSelect(level);
  };

  /** 가운데에 가장 가까운 칸 */
  const nearest = () => {
    const middle = wheel.scrollLeft + wheel.clientWidth / 2;
    return items.reduce((best, item) => (Math.abs(centerOf(item) - middle) < Math.abs(centerOf(best) - middle) ? item : best));
  };

  /** 가운데와 거리에 따라 크기·밝기(가운데 1.15배 · 멀수록 작고 흐림) */
  const paint = () => {
    const middle = wheel.scrollLeft + wheel.clientWidth / 2;
    for (const item of items) {
      const distance = Math.min(Math.abs(centerOf(item) - middle) / (item.offsetWidth * 2.5), 1);
      item.style.transform = `scale(${1.15 - 0.3 * distance})`;
      item.style.opacity = String(1 - 0.65 * distance);
    }
    select(levelOf(nearest()));
  };

  /** 스냅을 잠시 끄고 우리가 직접 움직임(끝나면 다시 켬) */
  const takeControl = () => {
    cancelAnimationFrame(animation);
    wheel.style.scrollSnapType = 'none';
  };
  const releaseControl = () => {
    wheel.style.scrollSnapType = '';
  };

  /** item 이 가운데에 오도록 부드럽게(ease-out) */
  const settleOn = (item: HTMLElement) => {
    takeControl();
    const from = wheel.scrollLeft;
    const to = targetFor(item);
    if (reducedMotion() || Math.abs(to - from) < 1) {
      wheel.scrollLeft = to;
      releaseControl();
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - started) / SETTLE_MS, 1);
      wheel.scrollLeft = from + (to - from) * easeOutCubic(progress);
      if (progress < 1) animation = requestAnimationFrame(step);
      else releaseControl();
    };
    animation = requestAnimationFrame(step);
  };

  /** 던진 속도(px/프레임)로 굴러가다 느려지면 가까운 단계에 붙음 */
  const roll = (velocity: number) => {
    if (reducedMotion()) return settleOn(nearest());
    takeControl();
    let speed = velocity;
    const step = () => {
      wheel.scrollLeft += speed;
      speed *= FRICTION;
      const atEdge = wheel.scrollLeft <= 0 || wheel.scrollLeft >= wheel.scrollWidth - wheel.clientWidth;
      if (Math.abs(speed) > STOP_SPEED && !atEdge) animation = requestAnimationFrame(step);
      else settleOn(nearest());
    };
    animation = requestAnimationFrame(step);
  };

  // 마우스로 끌기(터치는 브라우저 기본 스크롤이 더 자연스러워서 그대로) · 포인터를 휠이 잡아 두어 window 에 듣는 곳을 안 남김
  let drag: { startX: number; startScroll: number; lastX: number; lastTime: number; velocity: number; moved: boolean } | null = null;
  let suppressClick = false;
  wheel.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    takeControl();
    wheel.setPointerCapture(event.pointerId);
    drag = { startX: event.clientX, startScroll: wheel.scrollLeft, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false };
  });
  wheel.addEventListener('pointermove', event => {
    if (!drag) return;
    const now = performance.now();
    if (Math.abs(event.clientX - drag.startX) > DRAG_THRESHOLD_PX) drag.moved = true;
    wheel.scrollLeft = drag.startScroll - (event.clientX - drag.startX);
    // 마지막 움직임의 속도(px/16ms 프레임) · 끌던 반대 방향으로 스크롤
    const elapsed = Math.max(now - drag.lastTime, 1);
    drag.velocity = (-(event.clientX - drag.lastX) / elapsed) * 16;
    drag.lastX = event.clientX;
    drag.lastTime = now;
  });
  const endDrag = () => {
    if (!drag) return;
    const { moved, lastTime } = drag;
    const velocity = performance.now() - lastTime > STILL_MS ? 0 : drag.velocity;
    drag = null;
    suppressClick = moved;   // 끌고 손을 뗄 때 생기는 「누름」은 무시
    if (moved) roll(velocity);
    else releaseControl();
  };
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  let frame = 0;
  wheel.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(paint);
  });
  wheel.addEventListener('click', event => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>('.wheel-item');
    if (item) settleOn(item);
  });
  wheel.addEventListener('keydown', event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = items.findIndex(item => levelOf(item) === selected);
    const next = items[Math.min(Math.max(index + step, 0), items.length - 1)];
    settleOn(next);
  });

  const start = items.find(item => levelOf(item) === initial) ?? items[0];
  wheel.scrollLeft = targetFor(start);
  paint();
}
