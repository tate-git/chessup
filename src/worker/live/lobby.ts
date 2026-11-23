// 매칭 로비(Durable Object · 하나): 같은 종목·시간끼리, 레이팅 차이가 허용 범위면 짝 — 오래 기다릴수록 범위가 넓어짐
import { DurableObject } from 'cloudflare:workers';
import { isVariantId } from '../../engine/variants';
import { TIME_CONTROLS, type LobbyClientMessage, type LobbyServerMessage, type TimeControl } from '../../shared/protocol';
import type { VariantId } from '../../engine/variants';
import { loadRating } from '../db/ratings';
import type { Env } from '../env';

/** 접속마다 붙여 두는 정보(로비가 잠들었다 깨어나도 남음) */
interface Seeker {
  readonly userId: string;
  readonly username: string;
  seek?: { readonly variant: VariantId; readonly timeControl: TimeControl; readonly rating: number; readonly since: number };
}

const BASE_WINDOW = 150;
const WINDOW_GROWTH_PER_STEP = 50;
const WINDOW_STEP_MS = 5_000;
const MAX_WINDOW = 800;
const RETRY_MS = 3_000;

export class Lobby extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get('X-User-Id');
    const username = request.headers.get('X-Username');
    if (!userId || !username) return new Response('unauthorized', { status: 401 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username } satisfies Seeker);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const message = parseMessage(raw);
    const seeker = socket.deserializeAttachment() as Seeker;
    if (!message) return send(socket, { type: 'error', code: 'invalid_input', message: '알 수 없는 글' });

    if (message.type === 'cancel') {
      socket.serializeAttachment({ ...seeker, seek: undefined });
      return;
    }
    if (!isVariantId(message.variant) || !TIME_CONTROLS[message.variant].includes(message.timeControl)) {
      return send(socket, { type: 'error', code: 'invalid_input', message: '종목·시간을 확인해 주세요' });
    }
    this.#dropOtherSeeks(seeker.userId, socket);   // 같은 사람이 탭 여러 개로 줄 서지 않게
    const rating = await loadRating(this.env.DB, seeker.userId, message.variant);
    socket.serializeAttachment({ ...seeker, seek: { variant: message.variant, timeControl: message.timeControl, rating: rating.rating, since: Date.now() } });
    await this.#matchWaiting();
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    socket.close();
  }

  override async alarm(): Promise<void> {
    await this.#matchWaiting();
  }

  /** 기다리는 사람들 중 짝이 되는 둘을 계속 묶음 · 남은 사람이 있으면 잠시 뒤 다시 */
  async #matchWaiting(): Promise<void> {
    const now = Date.now();
    let waiting = this.#waiting();
    for (const [first, second] of findPairs(waiting.map(entry => entry.seeker), now)) {
      await this.#startGame(waiting[first], waiting[second]);
    }
    waiting = this.#waiting();
    for (const { socket, seeker } of waiting) {
      send(socket, { type: 'queued', waiting: waiting.filter(other => sameQueue(other.seeker, seeker)).length });
    }
    if (waiting.length > 0) await this.ctx.storage.setAlarm(now + RETRY_MS);
  }

  async #startGame(a: WaitingEntry, b: WaitingEntry): Promise<void> {
    const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a];
    const { variant, timeControl } = a.seeker.seek!;
    const gameId = crypto.randomUUID();
    const room = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(gameId));
    await room.start({
      id: gameId,
      variant,
      timeControl,
      white: { id: white.seeker.userId, username: white.seeker.username },
      black: { id: black.seeker.userId, username: black.seeker.username },
    });
    for (const [entry, color] of [[white, 'white'], [black, 'black']] as const) {
      entry.socket.serializeAttachment({ ...entry.seeker, seek: undefined });
      send(entry.socket, { type: 'matched', gameId, color });
    }
  }

  #waiting(): WaitingEntry[] {
    return this.ctx
      .getWebSockets()
      .map(socket => ({ socket, seeker: socket.deserializeAttachment() as Seeker }))
      .filter(entry => entry.seeker.seek);
  }

  #dropOtherSeeks(userId: string, keep: WebSocket): void {
    for (const { socket, seeker } of this.#waiting()) {
      if (seeker.userId === userId && socket !== keep) socket.serializeAttachment({ ...seeker, seek: undefined });
    }
  }
}

interface WaitingEntry {
  readonly socket: WebSocket;
  readonly seeker: Seeker;
}

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

function parseMessage(raw: string | ArrayBuffer): LobbyClientMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const message = JSON.parse(raw) as LobbyClientMessage;
    return message?.type === 'seek' || message?.type === 'cancel' ? message : null;
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
