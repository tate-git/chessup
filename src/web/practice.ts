// 봇과 연습: 내가 두면 → 봇이 생각해서 둠 → 끝나면 결과 · 힌트 · 판 뒤집기 · 기권
import { Game, opponent, PAWN, typeOf, WHITE, winnerOf, type GameStatus, type Side, type VariantId } from '../engine';
import { engine } from './engine-client';
import { t } from './i18n';
import type { HintSource } from './hints';
import { recordClear } from './practice-record';
import { moveListHtml } from './ui/dom';
import { BoardView } from './ui/board-view';
import { pickPromotion } from './ui/promotion-picker';

const BOT_MIN_THINK_MS = 350;   // 너무 빨리 두면 정신없음

export interface PracticeSetup {
  readonly variant: VariantId;
  readonly level: number;
  readonly playerSide: Side;
  readonly clearedBefore: number;
  readonly hints: HintSource;
}

export interface PracticeView {
  readonly board: HTMLElement;
  readonly status: HTMLElement;
  readonly moves: HTMLElement;
  readonly hintButton: HTMLButtonElement;
  readonly onFinish: (outcome: PracticeOutcome) => void;
}

export interface PracticeOutcome {
  readonly status: Extract<GameStatus, { over: true }> | { over: true; result: '1-0' | '0-1'; reason: 'resign' };
  readonly won: boolean;
  readonly newClear: boolean;
}

export class PracticeSession {
  readonly game: Game;
  readonly #board: BoardView;
  #orientation: Side;
  #botThinking = false;
  #finished = false;

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
    this.#updateHintButton();
    const uci = await engine.hint(this.setup.variant, this.game.position.toFen());
    const move = uci ? this.game.findMove(uci) : undefined;
    if (move) this.#board.showArrow(move);
  }

  resign(): void {
    if (this.#finished) return;
    this.#finish({ over: true, result: this.setup.playerSide === WHITE ? '0-1' : '1-0', reason: 'resign' });
  }

  #isPlayerTurn(): boolean {
    return !this.#finished && !this.#botThinking && this.game.turn === this.setup.playerSide;
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
    const won = winnerOf(status.result) === this.setup.playerSide;
    const newClear = won && this.setup.level > this.setup.clearedBefore;
    if (won) void recordClear(this.setup.variant, this.setup.level);
    this.view.onFinish({ status, won, newClear });
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
    this.view.status.textContent = this.#finished ? t('대국 끝', 'Game over') : this.#botThinking ? t('🤖 생각 중…', '🤖 Thinking…') : t('내 차례', 'Your move');
    this.view.moves.innerHTML = moveListHtml(this.game.history.map(played => played.san));
    this.view.moves.scrollTop = this.view.moves.scrollHeight;
    this.#updateHintButton();
  }

  #updateHintButton(): void {
    const { remaining, scope } = this.setup.hints.allowance;
    this.view.hintButton.disabled = remaining <= 0 || !this.#isPlayerTurn();
    this.view.hintButton.textContent = `💡 ${t('힌트', 'Hint')} ${Math.max(0, remaining)}`;
    this.view.hintButton.title = scope === 'game' ? t('초보: 한 판에 1번', 'Beginner: 1 per game') : t('하루 1번', '1 per day');
  }

}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
