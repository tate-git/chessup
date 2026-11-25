// 봇과 연습: 내가 두면 → 봇이 생각해서 둠 → 끝나면 결과 · 힌트·무르기(한 판 3번씩) · 판 뒤집기 · 기권
import { Game, opponent, PAWN, typeOf, WHITE, winnerOf, type GameStatus, type Side, type VariantId } from '../engine';
import { UNDOS_PER_GAME } from '../shared/protocol';
import { engine } from './engine-client';
import { t } from './i18n';
import type { HintSource } from './hints';
import { recordClear } from './practice-record';
import { actionLabel, moveListHtml } from './ui/dom';
import { BoardView } from './ui/board-view';
import { pickPromotion } from './ui/promotion-picker';

const BOT_MIN_THINK_MS = 350;   // 너무 빨리 두면 정신없음

export interface PracticeSetup {
  readonly variant: VariantId;
  readonly level: number;
  readonly playerSide: Side;
  readonly clearedBefore: number;
  readonly unassistedBefore: number;
  readonly hints: HintSource;
}

export interface PracticeView {
  readonly board: HTMLElement;
  readonly status: HTMLElement;
  readonly moves: HTMLElement;
  readonly hintButton: HTMLButtonElement;
  readonly undoButton: HTMLButtonElement;
  readonly onFinish: (outcome: PracticeOutcome) => void;
}

export interface PracticeOutcome {
  readonly status: Extract<GameStatus, { over: true }> | { over: true; result: '1-0' | '0-1'; reason: 'resign' };
  readonly won: boolean;
  /** 힌트나 무르기를 한 번이라도 썼는지 */
  readonly assisted: boolean;
  readonly newClear: boolean;
  /** 도움 없이는 처음 깸(전에 도움 받고 깬 단계 포함) */
  readonly newUnassistedClear: boolean;
}

export class PracticeSession {
  readonly game: Game;
  readonly #board: BoardView;
  #orientation: Side;
  #botThinking = false;
  #finished = false;
  #undosLeft = UNDOS_PER_GAME;
  #assisted = false;

  constructor(readonly setup: PracticeSetup, private readonly view: PracticeView) {
    this.game = new Game(setup.variant);
    this.#board = new BoardView(view.board, {
      movableSide: () => (this.#isPlayerTurn() ? setup.playerSide : null),
      targetsFrom: from => this.game.legalMoves().filter(move => move.from === from).map(move => move.to),
      onMove: (from, to) => void this.#playerMove(from, to),
    });
    this.#orientation = setup.playerSide;
    this.#board.orientation = this.#orientation;
    this.#refresh();
    if (!this.#isPlayerTurn()) void this.#botMove();
  }

  flip(): void {
    this.#orientation = opponent(this.#orientation);
    this.#board.orientation = this.#orientation;
  }

  async hint(): Promise<void> {
    if (!this.#isPlayerTurn() || !(await this.setup.hints.use())) return;
    this.#assisted = true;
    this.#updateButtons();
    const uci = await engine.hint(this.setup.variant, this.game.position.toFen());
    const move = uci ? this.game.findMove(uci) : undefined;
    if (move) this.#board.showArrow(move);
  }

  /** 봇의 마지막 수와 내 마지막 수를 되돌려 다시 내 차례로 */
  undo(): void {
    if (!this.#canUndo()) return;
    this.game.undo();
    this.game.undo();
    this.#undosLeft -= 1;
    this.#assisted = true;
    this.#board.showArrow(null);
    this.#refresh();
  }

  resign(): void {
    if (this.#finished) return;
    this.#finish({ over: true, result: this.setup.playerSide === WHITE ? '0-1' : '1-0', reason: 'resign' });
  }

  #isPlayerTurn(): boolean {
    return !this.#finished && !this.#botThinking && this.game.turn === this.setup.playerSide;
  }

  /** 내 차례이고, 되돌릴 내 수가 있을 때(흑이면 봇의 첫수는 남김) */
  #canUndo(): boolean {
    const firstMine = this.setup.playerSide === WHITE ? 0 : 1;
    return this.#undosLeft > 0 && this.#isPlayerTurn() && this.game.history.length >= firstMine + 2;
  }

  async #playerMove(from: number, to: number): Promise<void> {
    const candidates = this.game.legalMoves().filter(move => move.from === from && move.to === to);
    if (candidates.length === 0) return;
    const promotes = candidates.length > 1 && typeOf(candidates[0].piece) === PAWN;
    const promotion = promotes ? this.setup.playerSide * (await pickPromotion(this.setup.playerSide)) : 0;
    const move = candidates.find(candidate => candidate.promotion === promotion) ?? candidates[0];
    this.#board.showArrow(null);
    this.game.play(move);
    this.#afterMove();
  }

  async #botMove(): Promise<void> {
    this.#botThinking = true;
    this.#refresh();
    const started = Date.now();
    const uci = await engine.botMove(this.setup.variant, this.game.position.toFen(), this.setup.level);
    await sleep(BOT_MIN_THINK_MS - (Date.now() - started));
    this.#botThinking = false;
    if (this.#finished || !uci) return;
    this.game.playUci(uci);
    this.#afterMove();
  }

  #afterMove(): void {
    const status = this.game.status();
    if (status.over) {
      this.#finish(status);
      return;
    }
    this.#refresh();
    if (!this.#isPlayerTurn()) void this.#botMove();
  }

  #finish(status: PracticeOutcome['status']): void {
    this.#finished = true;
    this.#refresh();
    const { level } = this.setup;
    const won = winnerOf(status.result) === this.setup.playerSide;
    const assisted = this.#assisted;
    const newClear = won && level > this.setup.clearedBefore;
    const newUnassistedClear = won && !assisted && level > this.setup.unassistedBefore;
    if (won) void recordClear(this.setup.variant, level, assisted);
    this.view.onFinish({ status, won, assisted, newClear, newUnassistedClear });
  }

  #refresh(): void {
    const position = this.game.position;
    const last = this.game.history.at(-1)?.move;
    this.#board.render({
      board: position.board,
      width: position.geometry.width,
      height: position.geometry.height,
      lastMove: last,
      checkSquare: position.inCheck() ? position.kingSquare(position.turn) : undefined,
    });
    // 내 차례는 글자 대신 판 테두리로 알림 · 글자는 화면 읽기용으로만 남김
    this.view.board.classList.toggle('my-turn', this.#isPlayerTurn());
    this.view.status.textContent = this.#finished ? t('대결 끝', 'Game over') : this.#botThinking ? t('🤖 생각 중…', '🤖 Thinking…') : t('내 차례', 'Your move');
    this.view.moves.innerHTML = moveListHtml(this.game.history.map(played => played.san));
    this.view.moves.scrollTop = this.view.moves.scrollHeight;
    this.#updateButtons();
  }

  #updateButtons(): void {
    const hints = this.setup.hints.remaining;
    this.view.hintButton.disabled = hints <= 0 || !this.#isPlayerTurn();
    this.view.hintButton.innerHTML = actionLabel('💡', `${t('힌트', 'Hint')} ${Math.max(0, hints)}`);
    this.view.undoButton.disabled = !this.#canUndo();
    this.view.undoButton.innerHTML = actionLabel('↩️', `${t('무르기', 'Undo')} ${this.#undosLeft}`);
    const note = t('한 판에 3번 · 쓰고 이기면 격파에 🤝 표시', '3 per game · wins using it are marked 🤝');
    this.view.hintButton.title = note;
    this.view.undoButton.title = note;
  }

}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
