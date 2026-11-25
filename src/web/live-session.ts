// 사람과 실시간 대국: 서버가 기준(수·시계) · 내 수는 바로 보여 주고 서버 확인을 받음 · 끊기면 다시 접속
import { Game, typeOf, PAWN, BLACK, WHITE, type Side } from '../engine';
import type { Clocks, Color, GameServerMessage, GameSummary, LiveGame } from '../shared/protocol';
import { t } from './i18n';
import { socketUrl } from './lobby-client';
import { BoardView } from './ui/board-view';
import { escapeHtml, formatClock, moveListHtml } from './ui/dom';
import { pickPromotion } from './ui/promotion-picker';

export interface LiveView {
  readonly board: HTMLElement;
  readonly title: HTMLElement;
  readonly topPlayer: HTMLElement;
  readonly bottomPlayer: HTMLElement;
  readonly topClock: HTMLElement;
  readonly bottomClock: HTMLElement;
  readonly moves: HTMLElement;
  readonly status: HTMLElement;
  readonly drawButtons: HTMLElement;
  readonly onEnd: (summary: GameSummary, you: Color | 'spectator') => void;
}

const RECONNECT_MS = 1500;
const sideOfColor = (color: Color): Side => (color === 'white' ? WHITE : BLACK);
const colorOfSide = (side: Side): Color => (side === WHITE ? 'white' : 'black');

export class LiveSession {
  #socket: WebSocket | null = null;
  #state: LiveGame | null = null;
  #game: Game | null = null;
  #clocks: Clocks = { white: 0, black: 0 };
  #clockStamp = performance.now();
  #ended = false;
  #closed = false;
  #timer = 0;
  readonly #board: BoardView;

  constructor(private readonly gameId: string, private readonly view: LiveView) {
    this.#board = new BoardView(view.board, {
      movableSide: () => this.#mySideToMove(),
      targetsFrom: from => this.#game?.legalMoves().filter(move => move.from === from).map(move => move.to) ?? [],
      onMove: (from, to) => void this.#playMove(from, to),
    });
    this.#connect();
    this.#timer = window.setInterval(() => this.#renderClocks(), 100);
  }

  resign(): void {
    this.#send({ type: 'resign' });
  }

  offerDraw(): void {
    this.#send({ type: 'offerDraw' });
    this.view.status.textContent = t('무승부를 제안했어요', 'Draw offered');
  }

  answerDraw(accept: boolean): void {
    this.#send({ type: accept ? 'acceptDraw' : 'declineDraw' });
    this.view.drawButtons.hidden = true;
  }

  close(): void {
    this.#closed = true;
    window.clearInterval(this.#timer);
    this.#socket?.close();
  }

  #connect(): void {
    const socket = new WebSocket(socketUrl(`/api/games/${encodeURIComponent(this.gameId)}/live`));
    this.#socket = socket;
    socket.addEventListener('message', event => this.#onMessage(JSON.parse(String(event.data)) as GameServerMessage));
    socket.addEventListener('close', () => {
      if (!this.#closed && !this.#ended) setTimeout(() => this.#connect(), RECONNECT_MS);
    });
  }

  #onMessage(message: GameServerMessage): void {
    switch (message.type) {
      case 'state': return this.#loadState(message.game);
      case 'move': return this.#applyServerMove(message.uci, message.ply, message.clocks);
      case 'drawOffered': return this.#showDrawOffer(message.by);
      case 'end': return this.#finish(message.game);
      case 'error':
        this.view.status.textContent = message.message;
        this.#socket?.close();   // 다시 접속해 서버 상태로 맞춤
    }
  }

  #loadState(state: LiveGame): void {
    this.#state = state;
    this.#game = new Game(state.variant);
    for (const uci of state.moves) this.#game.playUci(uci);
    this.#setClocks(state.clocks);
    this.#board.orientation = state.you === 'black' ? BLACK : WHITE;
    this.view.title.textContent = `⚔️ ${t('랭킹 대결', 'Ranked match')}`;
    this.view.drawButtons.hidden = !(state.drawOfferBy && state.you !== 'spectator' && state.drawOfferBy !== state.you);
    this.#render();
  }

  #applyServerMove(uci: string, ply: number, clocks: Clocks): void {
    const game = this.#game;
    if (!game) return;
    if (ply === game.history.length) game.playUci(uci);   // 상대 수(내 수는 이미 둠)
    this.#setClocks(clocks);
    this.view.drawButtons.hidden = true;
    this.#render();
  }

  async #playMove(from: number, to: number): Promise<void> {
    const game = this.#game;
    const side = this.#mySideToMove();
    if (!game || side === null) return;
    const candidates = game.legalMoves().filter(move => move.from === from && move.to === to);
    if (candidates.length === 0) return;
    const promotes = candidates.length > 1 && typeOf(candidates[0].piece) === PAWN;
    const promotion = promotes ? side * (await pickPromotion(side)) : 0;
    const move = candidates.find(candidate => candidate.promotion === promotion) ?? candidates[0];
    const ply = game.history.length;
    const played = game.play(move);
    this.#send({ type: 'move', uci: played.uci, ply });
    this.#render();
  }

  #showDrawOffer(by: Color): void {
    if (this.#state?.you === 'spectator' || by === this.#state?.you) return;
    this.view.drawButtons.hidden = false;
    this.view.status.textContent = t('상대가 무승부를 제안했어요', 'Your opponent offers a draw');
  }

  #finish(summary: GameSummary): void {
    this.#ended = true;
    this.view.drawButtons.hidden = true;
    this.#render();
    this.view.onEnd(summary, this.#state?.you ?? 'spectator');
  }

  #mySideToMove(): Side | null {
    const you = this.#state?.you;
    if (!this.#game || this.#ended || !you || you === 'spectator') return null;
    const side = sideOfColor(you);
    return this.#game.turn === side ? side : null;
  }

  #setClocks(clocks: Clocks): void {
    this.#clocks = clocks;
    this.#clockStamp = performance.now();
  }

  /** 서버가 준 시각에서 흐른 만큼 둘 차례인 쪽 시계를 줄여 보여 줌(첫 수 두 개는 안 줄어듦) */
  #renderClocks(): void {
    const game = this.#game;
    const state = this.#state;
    if (!game || !state) return;
    const running = !this.#ended && game.history.length >= 2 ? colorOfSide(game.turn) : null;
    const shown = (color: Color) => this.#clocks[color] - (running === color ? performance.now() - this.#clockStamp : 0);
    const bottom: Color = state.you === 'black' ? 'black' : 'white';
    const top: Color = bottom === 'white' ? 'black' : 'white';
    for (const [element, color] of [[this.view.topClock, top], [this.view.bottomClock, bottom]] as const) {
      element.textContent = formatClock(shown(color));
      element.classList.toggle('running', running === color);
      element.classList.toggle('low', shown(color) < 20_000);
    }
  }

  #render(): void {
    const game = this.#game;
    const state = this.#state;
    if (!game || !state) return;
    const position = game.position;
    this.#board.render({
      board: position.board,
      width: position.geometry.width,
      height: position.geometry.height,
      lastMove: game.history.at(-1)?.move,
      checkSquare: position.inCheck() ? position.kingSquare(position.turn) : undefined,
    });
    const bottom: Color = state.you === 'black' ? 'black' : 'white';
    const top: Color = bottom === 'white' ? 'black' : 'white';
    const player = (color: Color) => `${color === 'white' ? '⚪' : '⚫'} <b>${state[color].bot ? `🤖 ${t(`봇 ${state[color].bot}단`, `Bot lv ${state[color].bot}`)}` : escapeHtml(state[color].username)}</b> ${state[color].guest ? `<span class="tag">${t('게스트', 'Guest')}</span>` : ''}${state[color].bot ? `<span class="tag">${t('랜덤 봇', 'Random bot')}</span> ` : ''}${state[color].rating === undefined ? '' : `<span class="muted">${state[color].rating}</span>`}`;
    this.view.topPlayer.innerHTML = player(top);
    this.view.bottomPlayer.innerHTML = player(bottom);
    this.view.moves.innerHTML = moveListHtml(game.history.map(played => played.san));
    this.view.moves.scrollTop = this.view.moves.scrollHeight;
    if (!this.#ended) this.view.status.textContent = this.#mySideToMove() !== null ? t('내 차례', 'Your move') : state.you === 'spectator' ? t('관전 중', 'Spectating') : t('상대 차례', "Opponent's move");
    this.#renderClocks();
  }

  #send(message: unknown): void {
    if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(message));
  }
}
