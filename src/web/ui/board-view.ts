// 체스판 화면: 칸·말 그리기 · 눌러서/끌어서 두기 · 둘 수 있는 칸 표시 · 마지막 수·체크·힌트 화살표
import { pieceToChar, sideOf, WHITE, type Side } from '../../engine';

export interface BoardSnapshot {
  readonly board: Int8Array;
  readonly width: number;
  readonly height: number;
  readonly lastMove?: { readonly from: number; readonly to: number };
  readonly checkSquare?: number;
}

export interface BoardViewOptions {
  /** 지금 움직일 수 있는 쪽(없으면 null — 상대 차례·끝난 판) */
  readonly movableSide: () => Side | null;
  readonly targetsFrom: (from: number) => readonly number[];
  readonly onMove: (from: number, to: number) => void;
}

const DRAG_THRESHOLD_PX = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';

export const pieceImage = (piece: number): string => `/piece/${sideOf(piece) === WHITE ? 'l' : 'd'}${pieceToChar(piece).toLowerCase()}.svg`;

export class BoardView {
  readonly #root: HTMLElement;
  readonly #grid: HTMLElement;
  readonly #arrows: SVGSVGElement;
  #squares: HTMLElement[] = [];
  #snapshot: BoardSnapshot | null = null;
  #orientation: Side = WHITE;
  #selected: number | null = null;
  #drag: { from: number; startX: number; startY: number; ghost: HTMLImageElement | null } | null = null;

  constructor(root: HTMLElement, private readonly options: BoardViewOptions) {
    this.#root = root;
    this.#root.classList.add('board');
    this.#grid = document.createElement('div');
    this.#grid.className = 'board-grid';
    this.#arrows = document.createElementNS(SVG_NS, 'svg');
    this.#arrows.classList.add('board-arrows');
    this.#root.replaceChildren(this.#grid, this.#arrows);
    this.#grid.addEventListener('pointerdown', event => this.#onPointerDown(event));
    window.addEventListener('pointermove', event => this.#onPointerMove(event));
    window.addEventListener('pointerup', event => this.#onPointerUp(event));
  }

  set orientation(side: Side) {
    this.#orientation = side;
    this.#build();
  }

  render(snapshot: BoardSnapshot): void {
    const sizeChanged = snapshot.width !== this.#snapshot?.width || snapshot.height !== this.#snapshot?.height;
    this.#snapshot = snapshot;
    if (sizeChanged) this.#build();
    else this.#paint();
  }

  /** 힌트·추천 수 화살표(없으면 지움) */
  showArrow(arrow: { from: number; to: number } | null): void {
    this.#arrows.replaceChildren();
    if (!arrow || !this.#snapshot) return;
    const [x1, y1] = this.#center(arrow.from);
    const [x2, y2] = this.#center(arrow.to);
    const line = document.createElementNS(SVG_NS, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([key, value]) => line.setAttribute(key, String(value)));
    this.#arrows.append(arrowHead(), line);
  }

  clearSelection(): void {
    this.#selected = null;
    this.#paint();
  }

  #build(): void {
    if (!this.#snapshot) return;
    const { width, height } = this.#snapshot;
    this.#root.style.setProperty('--files', String(width));
    this.#root.style.setProperty('--ranks', String(height));
    this.#arrows.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.#squares = Array.from({ length: width * height }, (_, square) => {
      const element = document.createElement('div');
      element.className = `square ${isDarkSquare(square, width) ? 'dark' : 'light'}`;
      element.dataset.square = String(square);
      return element;
    });
    const ordered = [...this.#squares.keys()].sort((a, b) => this.#displayIndex(a) - this.#displayIndex(b));
    this.#grid.replaceChildren(...ordered.map(square => this.#squares[square]));
    this.#addCoordinates();
    this.#paint();
  }

  #paint(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const targets = this.#selected === null ? [] : this.options.targetsFrom(this.#selected);
    this.#squares.forEach((element, square) => {
      const piece = snapshot.board[square];
      const image = element.querySelector<HTMLImageElement>('img.piece');
      if (piece === 0) image?.remove();
      else if (image) image.src = pieceImage(piece);
      else element.prepend(pieceElement(piece));
      element.classList.toggle('selected', square === this.#selected);
      element.classList.toggle('target', targets.includes(square));
      element.classList.toggle('occupied', piece !== 0);
      element.classList.toggle('last-move', square === snapshot.lastMove?.from || square === snapshot.lastMove?.to);
      element.classList.toggle('in-check', square === snapshot.checkSquare);
      element.classList.toggle('dragging-from', square === this.#drag?.from && this.#drag.ghost !== null);
    });
  }

  /** 화면 위→아래, 왼→오 순서(백이 아래면 8랭크가 맨 위) */
  #displayIndex(square: number): number {
    const { width, height } = this.#snapshot!;
    const file = square % width;
    const rank = Math.floor(square / width);
    const row = this.#orientation === WHITE ? height - 1 - rank : rank;
    const column = this.#orientation === WHITE ? file : width - 1 - file;
    return row * width + column;
  }

  #center(square: number): [number, number] {
    const { width } = this.#snapshot!;
    const index = this.#displayIndex(square);
    return [(index % width) + 0.5, Math.floor(index / width) + 0.5];
  }

  #addCoordinates(): void {
    const { width, height } = this.#snapshot!;
    this.#squares.forEach((element, square) => {
      const index = this.#displayIndex(square);
      if (Math.floor(index / width) === height - 1) element.append(label('file', String.fromCharCode(97 + (square % width))));
      if (index % width === 0) element.append(label('rank', String(Math.floor(square / width) + 1)));
    });
  }

  #squareAt(x: number, y: number): number | null {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('.square');
    return element && this.#grid.contains(element) ? Number(element.dataset.square) : null;
  }

  #isMovablePiece(square: number): boolean {
    const piece = this.#snapshot?.board[square] ?? 0;
    const side = this.options.movableSide();
    return piece !== 0 && side !== null && sideOf(piece) === side;
  }

  #onPointerDown(event: PointerEvent): void {
    const square = this.#squareAt(event.clientX, event.clientY);
    if (square === null || event.button > 0) return;
    if (this.#selected !== null && this.options.targetsFrom(this.#selected).includes(square)) {
      this.#commit(this.#selected, square);
      return;
    }
    if (!this.#isMovablePiece(square)) {
      this.clearSelection();
      return;
    }
    event.preventDefault();
    this.#selected = square;
    this.#drag = { from: square, startX: event.clientX, startY: event.clientY, ghost: null };
    this.#paint();
  }

  #onPointerMove(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.ghost = this.#createGhost(drag.from);
      this.#paint();
    }
    drag.ghost.style.translate = `${event.clientX}px ${event.clientY}px`;
  }

  #onPointerUp(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = null;
    drag.ghost?.remove();
    if (!drag.ghost) return;   // 끌지 않고 누르기만 했으면 선택 상태로 둠
    const to = this.#squareAt(event.clientX, event.clientY);
    if (to !== null && this.options.targetsFrom(drag.from).includes(to)) this.#commit(drag.from, to);
    else this.#paint();
  }

  #createGhost(from: number): HTMLImageElement {
    const size = this.#squares[from].getBoundingClientRect().width;
    const ghost = pieceElement(this.#snapshot!.board[from]);
    ghost.classList.add('ghost');
    ghost.style.width = ghost.style.height = `${size}px`;
    document.body.append(ghost);
    return ghost;
  }

  #commit(from: number, to: number): void {
    this.#selected = null;
    this.options.onMove(from, to);
  }
}

/** a1 이 어두운 칸 */
const isDarkSquare = (square: number, width: number) => ((square % width) + Math.floor(square / width)) % 2 === 0;

function pieceElement(piece: number): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'piece';
  image.src = pieceImage(piece);
  image.alt = '';
  image.draggable = false;
  return image;
}

function label(kind: 'file' | 'rank', text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = `coord ${kind}`;
  element.textContent = text;
  return element;
}

function arrowHead(): SVGDefsElement {
  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = '<marker id="arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 10 5 0 10z"/></marker>';
  return defs;
}
