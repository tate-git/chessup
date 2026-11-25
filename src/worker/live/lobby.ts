// 매칭 로비(Durable Object · 하나): 회원·게스트 한 줄 — 같은 종목·시간끼리, 레이팅 차이가 허용 범위면 짝(오래 기다릴수록 넓어짐, 게스트는 1500)
// 방: 방 번호(숫자 네 자리)를 만들어 기다리면, 번호를 넣은 사람과 바로 짝 · 줄 서 있다가 「봇과 바로」면 내 레이팅 근처 랜덤 봇과
import { DurableObject } from 'cloudflare:workers';
import { isVariantId } from '../../engine/variants';
import { TIME_CONTROLS, type LobbyClientMessage, type LobbyServerMessage, type TimeControl } from '../../shared/protocol';
import type { VariantId } from '../../engine/variants';
import { INITIAL_RATING } from '../rating/glicko2';
import { pickBotLevel } from '../rating/bot-rating';
import type { SeatedPlayer } from './game-room';
import { loadRating } from '../db/ratings';
import type { Env } from '../env';

/** 접속마다 붙여 두는 정보(로비가 잠들었다 깨어나도 남음) */
interface Seeker {
  readonly userId: string;
  readonly username: string;
  readonly member: boolean;
  seek?: { readonly variant: VariantId; readonly timeControl: TimeControl; readonly rating: number; readonly since: number };
  room?: { readonly code: string; readonly variant: VariantId; readonly timeControl: TimeControl };
}

const BASE_WINDOW = 150;
const WINDOW_GROWTH_PER_STEP = 50;
const WINDOW_STEP_MS = 5_000;
const MAX_WINDOW = 800;
const RETRY_MS = 3_000;
const ROOM_CODE = /^\d{4}$/;

export class Lobby extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get('X-User-Id');
    const username = request.headers.get('X-Username');
    if (!userId || !username) return new Response('unauthorized', { status: 401 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username: decodeURIComponent(username), member: request.headers.get('X-Member') === '1' } satisfies Seeker);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const message = parseMessage(raw);
    const seeker = socket.deserializeAttachment() as Seeker;
    if (!message) return send(socket, { type: 'error', code: 'invalid_input', message: '알 수 없는 글' });

    switch (message.type) {
      case 'cancel':
        return socket.serializeAttachment(idle(seeker));
      case 'joinRoom':
        return this.#joinRoom(socket, seeker, message.code);
      case 'playBot':
        return this.#playBot(socket, seeker);
      case 'createRoom':
      case 'seek': {
        if (!isVariantId(message.variant) || !TIME_CONTROLS[message.variant].includes(message.timeControl)) {
          return send(socket, { type: 'error', code: 'invalid_input', message: '종목·시간을 확인해 주세요' });
        }
        this.#dropOtherWaits(seeker.userId, socket);   // 같은 사람이 탭 여러 개로 줄 서지 않게
        if (message.type === 'createRoom') return this.#createRoom(socket, seeker, message.variant, message.timeControl);
        const rating = seeker.member ? (await loadRating(this.env.DB, seeker.userId, message.variant)).rating : INITIAL_RATING.rating;
        socket.serializeAttachment({ ...idle(seeker), seek: { variant: message.variant, timeControl: message.timeControl, rating, since: Date.now() } });
        return this.#matchWaiting();
      }
    }
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    socket.close();
  }

  override async alarm(): Promise<void> {
    await this.#matchWaiting();
  }

  #createRoom(socket: WebSocket, seeker: Seeker, variant: VariantId, timeControl: TimeControl): void {
    const taken = new Set(this.#entries().flatMap(({ seeker: other }) => (other.room ? [other.room.code] : [])));
    let code: string;
    do code = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    while (taken.has(code));
    socket.serializeAttachment({ ...idle(seeker), room: { code, variant, timeControl } });
    send(socket, { type: 'roomCreated', code });
  }

  async #joinRoom(socket: WebSocket, seeker: Seeker, code: string): Promise<void> {
    if (!ROOM_CODE.test(code)) return send(socket, { type: 'error', code: 'invalid_input', message: '방 번호는 숫자 네 자리예요' });
    const host = this.#entries().find(entry => entry.seeker.room?.code === code);
    if (!host) return send(socket, { type: 'error', code: 'not_found', message: '없는 방이에요. 번호를 확인해 주세요' });
    if (host.seeker.userId === seeker.userId) return send(socket, { type: 'error', code: 'invalid_input', message: '내가 만든 방이에요. 친구에게 번호를 알려 주세요' });
    const { variant, timeControl } = host.seeker.room!;
    await this.#startGame(host, { socket, seeker: idle(seeker) }, variant, timeControl);
  }

  /** 줄 서 있던 조건(종목·시간) 그대로 랜덤 봇과 · 봇 단계는 내 레이팅 근처 */
  async #playBot(socket: WebSocket, seeker: Seeker): Promise<void> {
    if (!seeker.seek) return send(socket, { type: 'error', code: 'invalid_input', message: '먼저 시간을 골라 주세요' });
    const { variant, timeControl, rating } = seeker.seek;
    const level = pickBotLevel(rating);
    const human = { socket, seeker: idle(seeker) };
    const [white, black] = Math.random() < 0.5 ? [seat(seeker), botSeat(level)] : [botSeat(level), seat(seeker)];
    const gameId = crypto.randomUUID();
    await this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(gameId)).start({ id: gameId, variant, timeControl, white, black });
    socket.serializeAttachment(human.seeker);
    send(socket, { type: 'matched', gameId, color: white.bot ? 'black' : 'white' });
  }

  /** 기다리는 사람들 중 짝이 되는 둘을 계속 묶음 · 남은 사람이 있으면 잠시 뒤 다시 */
  async #matchWaiting(): Promise<void> {
    const now = Date.now();
    let waiting = this.#seeking();
    for (const [first, second] of findPairs(waiting.map(entry => entry.seeker), now)) {
      const { variant, timeControl } = waiting[first].seeker.seek!;
      await this.#startGame(waiting[first], waiting[second], variant, timeControl);
    }
    waiting = this.#seeking();
    for (const { socket, seeker } of waiting) {
      send(socket, { type: 'queued', waiting: waiting.filter(other => sameQueue(other.seeker, seeker)).length });
    }
    if (waiting.length > 0) await this.ctx.storage.setAlarm(now + RETRY_MS);
  }

  async #startGame(a: WaitingEntry, b: WaitingEntry, variant: VariantId, timeControl: TimeControl): Promise<void> {
    const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a];
    const gameId = crypto.randomUUID();
    const room = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(gameId));
    await room.start({ id: gameId, variant, timeControl, white: seat(white.seeker), black: seat(black.seeker) });
    for (const [entry, color] of [[white, 'white'], [black, 'black']] as const) {
      entry.socket.serializeAttachment(idle(entry.seeker));
      send(entry.socket, { type: 'matched', gameId, color });
    }
  }

  #entries(): WaitingEntry[] {
    return this.ctx.getWebSockets().map(socket => ({ socket, seeker: socket.deserializeAttachment() as Seeker }));
  }

  #seeking(): WaitingEntry[] {
    return this.#entries().filter(entry => entry.seeker.seek);
  }

  #dropOtherWaits(userId: string, keep: WebSocket): void {
    for (const { socket, seeker } of this.#entries()) {
      if (seeker.userId === userId && socket !== keep && (seeker.seek || seeker.room)) socket.serializeAttachment(idle(seeker));
    }
  }
}

interface WaitingEntry {
  readonly socket: WebSocket;
  readonly seeker: Seeker;
}

const seat = (seeker: Seeker): SeatedPlayer => ({ id: seeker.userId, username: seeker.username, member: seeker.member });
const botSeat = (level: number): SeatedPlayer => ({ id: `bot-${level}`, username: `봇 ${level}단`, member: false, bot: level });

/** 줄·방에서 빠진 상태 */
const idle = (seeker: Seeker): Seeker => ({ userId: seeker.userId, username: seeker.username, member: seeker.member });

const sameQueue = (a: Seeker, b: Seeker) => a.seek?.variant === b.seek?.variant && a.seek?.timeControl === b.seek?.timeControl;

/** 기다린 시간에 따라 넓어지는 레이팅 허용 범위 */
export function ratingWindow(waitedMs: number): number {
  return Math.min(MAX_WINDOW, BASE_WINDOW + Math.floor(waitedMs / WINDOW_STEP_MS) * WINDOW_GROWTH_PER_STEP);
}

/** 오래 기다린 사람부터, 허용 범위 안에서 레이팅이 가장 가까운 상대와 짝(같은 사람끼리는 안 됨) */
export function findPairs(seekers: readonly Seeker[], now: number): [number, number][] {
  const order = [...seekers.keys()].sort((a, b) => seekers[a].seek!.since - seekers[b].seek!.since);
  const taken = new Set<number>();
  const pairs: [number, number][] = [];
  for (const index of order) {
    if (taken.has(index)) continue;
    const me = seekers[index];
    const window = ratingWindow(now - me.seek!.since);
    const partner = order
      .filter(other => other !== index && !taken.has(other) && sameQueue(seekers[other], me) && seekers[other].userId !== me.userId)
      .filter(other => Math.abs(seekers[other].seek!.rating - me.seek!.rating) <= Math.max(window, ratingWindow(now - seekers[other].seek!.since)))
      .sort((a, b) => Math.abs(seekers[a].seek!.rating - me.seek!.rating) - Math.abs(seekers[b].seek!.rating - me.seek!.rating))[0];
    if (partner === undefined) continue;
    taken.add(index).add(partner);
    pairs.push([index, partner]);
  }
  return pairs;
}

const MESSAGE_TYPES = new Set(['seek', 'createRoom', 'joinRoom', 'playBot', 'cancel']);

function parseMessage(raw: string | ArrayBuffer): LobbyClientMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const message = JSON.parse(raw) as LobbyClientMessage;
    return MESSAGE_TYPES.has(message?.type) ? message : null;
  } catch {
    return null;
  }
}

function send(socket: WebSocket, message: LobbyServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // 끊긴 연결
  }
}
