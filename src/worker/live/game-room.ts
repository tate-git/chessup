// 대결방(Durable Object · 대결 하나에 하나): 수 검사 · 시계 · 무승부 제안 · 랜덤 봇은 서버가 둠 · 끝나면 회원만 레이팅 반영(게스트 1500 · 봇은 단계 레이팅) · 기록은 회원끼리만 · 접속한 모두에게 알림
import { DurableObject } from 'cloudflare:workers';
import { Game, type EndReason as EngineEndReason } from '../../engine/game';
import { parseTimeControl, type Clocks, type Color, type EndReason, type GameClientMessage, type GameResult, type GameServerMessage, type GameSummary, type LiveGame, type TimeControl } from '../../shared/protocol';
import type { VariantId } from '../../engine/variants';
import { chooseBotMove } from '../../engine/bot';
import type { Move } from '../../engine/move';
import { insertGameStatement } from '../db/games';
import { botRating } from '../rating/bot-rating';
import { resultStatements, type ResultPlayer } from '../db/weekly';
import { freshRating, loadRating, saveRatingStatement, type RatingRow } from '../db/ratings';
import type { Env } from '../env';
import { updateRating } from '../rating/glicko2';
import { clocksAfterMove, colorToMove, liveClocks, nextDeadline } from './clock';

export interface SeatedPlayer {
  readonly id: string;
  readonly username: string;
  /** false = 게스트·봇(레이팅 저장 안 함) · 예전에 저장된 대결엔 없음 → 회원 */
  readonly member?: boolean;
  /** 랜덤 봇이면 단계(서버가 수를 둠) */
  readonly bot?: number;
}

export interface GameSetup {
  readonly id: string;
  readonly variant: VariantId;
  readonly timeControl: TimeControl;
  readonly white: SeatedPlayer;
  readonly black: SeatedPlayer;
}

interface PlayerState extends SeatedPlayer {
  readonly rating: RatingRow;
}

interface StoredGame {
  readonly id: string;
  readonly variant: VariantId;
  readonly timeControl: TimeControl;
  readonly white: PlayerState;
  readonly black: PlayerState;
  readonly moves: string[];
  clocks: Clocks;
  turnStartedAt: number;
  drawOfferBy?: Color;
  readonly startedAt: string;
  ended?: GameSummary;
}

type Seat = Color | 'spectator';
const STORAGE_KEY = 'game';
/** 봇이 너무 빨리 두지 않게 · 서버 계산은 한 수 1초까지 */
const BOT_DELAY_MS = 400;
const BOT_THINK_CAP_MS = 1_000;

export class GameRoom extends DurableObject<Env> {
  #game: StoredGame | null = null;

  /** 로비가 짝을 지으면 부름 */
  async start(setup: GameSetup): Promise<void> {
    // 게스트는 DB 에 없으니 처음 값(1500) · 봇은 단계 레이팅
    const ratingOf = async (player: SeatedPlayer): Promise<RatingRow> => {
      if (player.bot) return { ...freshRating(setup.variant), ...botRating(player.bot) };
      return isMember(player) ? loadRating(this.env.DB, player.id, setup.variant) : freshRating(setup.variant);
    };
    const [white, black] = await Promise.all([ratingOf(setup.white), ratingOf(setup.black)]);
    const { initialMs } = parseTimeControl(setup.timeControl);
    const game: StoredGame = {
      ...setup,
      white: { ...setup.white, rating: white },
      black: { ...setup.black, rating: black },
      moves: [],
      clocks: { white: initialMs, black: initialMs },
      turnStartedAt: Date.now(),
      startedAt: new Date().toISOString(),
    };
    await this.#save(game);
    await this.#scheduleNext(game);   // 봇이 백이면 첫 수
  }

  /** WebSocket 접속(Worker 가 X-User-Id 를 붙여 보냄 — 없으면 관전) */
  override async fetch(request: Request): Promise<Response> {
    const game = await this.#load();
    if (!game) return Response.json({ error: { code: 'not_found', message: '대결을 찾을 수 없어요' } }, { status: 404 });
    const { 0: client, 1: server } = new WebSocketPair();
    const seat = seatOf(game, request.headers.get('X-User-Id'));
    this.ctx.acceptWebSocket(server, [seat]);
    send(server, { type: 'state', game: this.#liveView(game, seat) });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const game = await this.#load();
    const seat = this.ctx.getTags(socket)[0] as Seat;
    if (!game || seat === 'spectator' || typeof raw !== 'string') return;
    if (game.ended) return send(socket, errorMessage('game_over', '이미 끝난 대결이에요'));

    const message = parseMessage(raw);
    if (!message) return send(socket, errorMessage('invalid_input', '알 수 없는 글'));
    switch (message.type) {
      case 'move': return this.#move(game, seat, socket, message.uci, message.ply);
      case 'resign': return this.#finish(game, seat === 'white' ? '0-1' : '1-0', 'resign');
      case 'offerDraw': return this.#offerDraw(game, seat);
      case 'acceptDraw': return game.drawOfferBy && game.drawOfferBy !== seat ? this.#finish(game, '1/2-1/2', 'agreement') : undefined;
      case 'declineDraw': return this.#clearDrawOffer(game, seat);
    }
  }

  /** 봇 차례면 봇이 둠 · 아니면 시간 초과 · 첫 수 제한 */
  override async alarm(): Promise<void> {
    const game = await this.#load();
    if (!game || game.ended) return;
    if (botToMove(game)) return this.#botMove(game);
    const ply = game.moves.length;
    if (ply < 2) return this.#finish(game, '1/2-1/2', 'abandon');
    const loser = colorToMove(ply);
    if (liveClocks(game.clocks, ply, game.turnStartedAt, Date.now())[loser] > 0) return this.#scheduleDeadline(game);
    return this.#finish(game, loser === 'white' ? '0-1' : '1-0', 'timeout');
  }

  async #move(game: StoredGame, seat: Color, socket: WebSocket, uci: string, ply: number): Promise<void> {
    if (ply !== game.moves.length) return;   // 늦게 온 중복 글
    if (colorToMove(ply) !== seat) return send(socket, errorMessage('not_your_turn', '상대 차례예요'));
    const board = replay(game);
    const move = board.findMove(uci);
    if (!move) return send(socket, errorMessage('illegal_move', '둘 수 없는 수예요'));
    await this.#play(game, seat, board, move);
  }

  /** 봇 한 수(서버에서 계산 · 생각 시간 상한) */
  async #botMove(game: StoredGame): Promise<void> {
    const seat = colorToMove(game.moves.length);
    const board = replay(game);
    const move = chooseBotMove(board.position, game[seat].bot!, Math.random, BOT_THINK_CAP_MS);
    if (move) await this.#play(game, seat, board, move);
  }

  /** 수 하나 반영(사람·봇 공통): 시계 · 저장 · 알림 · 끝났는지 · 다음 차례 준비 */
  async #play(game: StoredGame, seat: Color, board: Game, move: Move): Promise<void> {
    const ply = game.moves.length;
    const now = Date.now();
    const { incrementMs } = parseTimeControl(game.timeControl);
    const clocks = clocksAfterMove(game.clocks, ply, game.turnStartedAt, now, incrementMs);
    if (clocks[seat] <= 0 && ply >= 2) return this.#finish(game, seat === 'white' ? '0-1' : '1-0', 'timeout');

    const played = board.play(move);
    game.moves.push(played.uci);
    game.clocks = clocks;
    game.turnStartedAt = now;
    if (game.drawOfferBy && game.drawOfferBy !== seat) game.drawOfferBy = undefined;   // 수를 두면 받은 제안은 거절한 셈
    await this.#save(game);
    this.#broadcast({ type: 'move', uci: played.uci, san: played.san, ply, clocks });

    const status = board.status();
    if (status.over) return this.#finish(game, status.result, toEndReason(status.reason));
    await this.#scheduleNext(game);
  }

  async #offerDraw(game: StoredGame, seat: Color): Promise<void> {
    if (game.drawOfferBy) return game.drawOfferBy !== seat ? this.#finish(game, '1/2-1/2', 'agreement') : undefined;
    game.drawOfferBy = seat;
    await this.#save(game);
    this.#broadcast({ type: 'drawOffered', by: seat });
  }

  async #clearDrawOffer(game: StoredGame, seat: Color): Promise<void> {
    if (!game.drawOfferBy || game.drawOfferBy === seat) return;
    game.drawOfferBy = undefined;
    await this.#save(game);
    this.#broadcast({ type: 'state', game: this.#liveView(game, 'spectator') });
  }

  /** 끝: 레이팅 계산 · DB 저장(취소된 판은 저장 안 함) · 모두에게 알림 */
  async #finish(game: StoredGame, result: GameResult, reason: EndReason): Promise<void> {
    const rated = reason !== 'abandon';
    const [whiteAfter, blackAfter] = rated ? rateGame(game.white.rating, game.black.rating, result) : [game.white.rating, game.black.rating];
    const endedAt = new Date().toISOString();
    const change = (before: RatingRow, after: RatingRow) => Math.round(after.rating) - Math.round(before.rating);
    const info = (player: PlayerState, after: RatingRow) =>
      player.bot ? { username: player.username, rating: Math.round(player.rating.rating), bot: player.bot }
        : isMember(player) ? { username: player.username, rating: Math.round(player.rating.rating), ratingChange: change(player.rating, after) } : { username: player.username, guest: true };
    const summary: GameSummary = {
      id: game.id,
      variant: game.variant,
      timeControl: game.timeControl,
      white: info(game.white, whiteAfter),
      black: info(game.black, blackAfter),
      result,
      reason,
      endedAt,
    };

    if (rated) {
      const db = this.env.DB;
      const bothMembers = isMember(game.white) && isMember(game.black);
      const statements = [
        ...(bothMembers ? [insertGameStatement(db, {
          id: game.id, variant: game.variant, time_control: game.timeControl, white_id: game.white.id, black_id: game.black.id,
          result, reason, moves: game.moves.join(' '),
          white_rating: summary.white.rating ?? 0, black_rating: summary.black.rating ?? 0,
          white_change: summary.white.ratingChange ?? 0, black_change: summary.black.ratingChange ?? 0,
          started_at: game.startedAt, ended_at: endedAt,
        })] : []),
        ...(isMember(game.white) ? [saveRatingStatement(db, game.white.id, whiteAfter)] : []),
        ...(isMember(game.black) ? [saveRatingStatement(db, game.black.id, blackAfter)] : []),
        // 이번 주 랭킹(게스트 포함)
        ...resultStatements(db, { id: game.id, variant: game.variant, result, endedAt }, resultPlayer(game.white), resultPlayer(game.black)),   // 봇 줄은 빠짐
      ];
      await db.batch(statements);
    }
    game.ended = summary;
    await this.#save(game);
    await this.ctx.storage.deleteAlarm();
    this.#broadcast({ type: 'end', game: summary });
  }

  #scheduleDeadline(game: StoredGame): Promise<void> {
    return this.ctx.storage.setAlarm(nextDeadline(game.clocks, game.moves.length, game.turnStartedAt));
  }

  /** 다음 차례가 봇이면 잠깐 뒤 봇이 두게, 사람이면 시간 마감 */
  #scheduleNext(game: StoredGame): Promise<void> {
    return botToMove(game) ? this.ctx.storage.setAlarm(Date.now() + BOT_DELAY_MS) : this.#scheduleDeadline(game);
  }

  #liveView(game: StoredGame, seat: Seat): LiveGame {
    const player = (state: PlayerState) =>
      state.bot ? { username: state.username, rating: Math.round(state.rating.rating), bot: state.bot }
        : isMember(state) ? { username: state.username, rating: Math.round(state.rating.rating) } : { username: state.username, guest: true };
    return {
      id: game.id,
      variant: game.variant,
      timeControl: game.timeControl,
      white: player(game.white),
      black: player(game.black),
      moves: game.moves,
      clocks: liveClocks(game.clocks, game.moves.length, game.turnStartedAt, Date.now()),
      you: seat,
      drawOfferBy: game.drawOfferBy,
    };
  }

  #broadcast(message: GameServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      const seat = this.ctx.getTags(socket)[0] as Seat;
      send(socket, message.type === 'state' ? { ...message, game: { ...message.game, you: seat } } : message);
    }
  }

  async #load(): Promise<StoredGame | null> {
    this.#game ??= (await this.ctx.storage.get<StoredGame>(STORAGE_KEY)) ?? null;
    return this.#game;
  }

  async #save(game: StoredGame): Promise<void> {
    this.#game = game;
    await this.ctx.storage.put(STORAGE_KEY, game);
    if (game.moves.length === 0 && !game.ended) await this.#scheduleDeadline(game);
  }
}

function seatOf(game: StoredGame, userId: string | null): Seat {
  if (userId === game.white.id) return 'white';
  if (userId === game.black.id) return 'black';
  return 'spectator';
}

function replay(game: StoredGame): Game {
  const board = new Game(game.variant);
  for (const uci of game.moves) board.playUci(uci);
  return board;
}

function rateGame(white: RatingRow, black: RatingRow, result: GameResult): [RatingRow, RatingRow] {
  const whiteScore = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
  return [tally(white, black, whiteScore), tally(black, white, 1 - whiteScore)];
}

/** 대국 하나 반영: 새 레이팅 + 전적 */
function tally(player: RatingRow, opponent: RatingRow, score: number): RatingRow {
  return {
    ...player,
    ...updateRating(player, [{ opponent, score }]),
    games: player.games + 1,
    wins: player.wins + (score === 1 ? 1 : 0),
    losses: player.losses + (score === 0 ? 1 : 0),
    draws: player.draws + (score === 0.5 ? 1 : 0),
  };
}

const toEndReason = (reason: EngineEndReason): EndReason => reason;

function parseMessage(raw: string): GameClientMessage | null {
  try {
    const message = JSON.parse(raw) as GameClientMessage;
    return typeof message?.type === 'string' ? message : null;
  } catch {
    return null;
  }
}

const errorMessage = (code: Extract<GameServerMessage, { type: 'error' }>['code'], message: string): GameServerMessage => ({ type: 'error', code, message });

function send(socket: WebSocket, message: GameServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // 끊긴 연결 — 다시 접속하면 state 로 따라잡음
  }
}

const isMember = (player: SeatedPlayer) => player.member !== false && !player.bot;

const resultPlayer = (player: SeatedPlayer): ResultPlayer | null => (player.bot ? null : { id: player.id, name: player.username, guest: !isMember(player) });
const botToMove = (game: StoredGame) => Boolean(game[colorToMove(game.moves.length)].bot);
