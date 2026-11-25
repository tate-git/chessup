// docs/api.yaml 의 TypeScript 꼴(화면·Cloudflare 서버가 함께 씀) — 바꾸면 api.yaml 도 같이
import type { VariantId } from '../engine/variants';

export type { VariantId };
export type Color = 'white' | 'black';
export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type EndReason = 'checkmate' | 'stalemate' | 'repetition' | 'fiftyMove' | 'insufficient' | 'resign' | 'timeout' | 'agreement' | 'abandon';
export type ErrorCode =
  | 'invalid_input' | 'username_taken' | 'invalid_credentials' | 'unauthorized' | 'not_found'
  | 'rate_limited' | 'no_hints_left' | 'illegal_move' | 'not_your_turn' | 'game_over';

export const TIME_CONTROLS: Readonly<Record<VariantId, readonly TimeControl[]>> = {
  standard: ['3+2', '5+3', '10+0'],
  mini: ['2+1', '3+2'],
};
export type TimeControl = '3+2' | '5+3' | '10+0' | '2+1';

export function parseTimeControl(timeControl: TimeControl): { initialMs: number; incrementMs: number } {
  const [minutes, seconds] = timeControl.split('+').map(Number);
  return { initialMs: minutes * 60_000, incrementMs: seconds * 1000 };
}

export interface ErrorBody {
  readonly error: { readonly code: ErrorCode; readonly message: string };
}

export interface Rating {
  readonly rating: number;
  readonly deviation: number;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly provisional: boolean;
}
export type Ratings = Readonly<Record<VariantId, Rating>>;

export interface Me {
  readonly username: string;
  readonly createdAt: string;
  readonly ratings: Ratings;
  readonly beginner: boolean;
}

export interface PlayerInfo {
  readonly username: string;
  /** 게스트는 없음(레이팅은 회원만 쌓임) */
  readonly rating?: number;
  readonly guest?: boolean;
  /** 랜덤 봇이면 단계 */
  readonly bot?: number;
  readonly ratingChange?: number;
}

export interface GameSummary {
  readonly id: string;
  readonly variant: VariantId;
  readonly timeControl: TimeControl;
  readonly white: PlayerInfo;
  readonly black: PlayerInfo;
  readonly result: GameResult;
  readonly reason: EndReason;
  readonly endedAt: string;
}

export interface GameRecord extends GameSummary {
  readonly moves: readonly string[];
  readonly startedAt: string;
}

export interface Profile {
  readonly username: string;
  readonly createdAt: string;
  readonly ratings: Ratings;
  readonly recentGames: readonly GameSummary[];
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly username: string;
  readonly rating: number;
  readonly games: number;
}

/** 이번 주 랭킹 한 줄(게스트 포함) · 승점 = 승 1 · 무 0.5 */
export interface WeeklyEntry {
  readonly rank: number;
  readonly username: string;
  readonly guest: boolean;
  readonly points: number;
  readonly games: number;
  readonly wins: number;
  /** 보고 있는 사람 본인 */
  readonly mine: boolean;
}

/** 봇 대국 한 판에 쓸 수 있는 힌트·무르기 수(누구나 같음) */
export const HINTS_PER_GAME = 3;
export const UNDOS_PER_GAME = 3;

export interface HintAllowance {
  /** 이 판에 남은 힌트 */
  readonly remaining: number;
}

export interface PracticeState {
  /** 깬 최고 단계(힌트·무르기 써도 포함) */
  readonly cleared: Readonly<Record<VariantId, number>>;
  /** 힌트·무르기 없이 깬 최고 단계 */
  readonly unassisted: Readonly<Record<VariantId, number>>;
}

// ───────── WebSocket 글
export interface Clocks {
  readonly white: number;
  readonly black: number;
}

export interface LiveGame {
  readonly id: string;
  readonly variant: VariantId;
  readonly timeControl: TimeControl;
  readonly white: PlayerInfo;
  readonly black: PlayerInfo;
  readonly moves: readonly string[];
  readonly clocks: Clocks;
  readonly you: Color | 'spectator';
  readonly drawOfferBy?: Color;
}

export interface ErrorMessage {
  readonly type: 'error';
  readonly code: ErrorCode;
  readonly message: string;
}

export type LobbyClientMessage =
  | { readonly type: 'seek'; readonly variant: VariantId; readonly timeControl: TimeControl }
  /** 방 만들기: 방 번호를 받아 친구가 들어올 때까지 기다림 */
  | { readonly type: 'createRoom'; readonly variant: VariantId; readonly timeControl: TimeControl }
  | { readonly type: 'joinRoom'; readonly code: string }
  /** 줄 서 있는 중에 사람 대신 랜덤 봇과 바로(내 레이팅 근처 단계) */
  | { readonly type: 'playBot' }
  | { readonly type: 'cancel' };

export type LobbyServerMessage =
  | { readonly type: 'queued'; readonly waiting: number }
  | { readonly type: 'roomCreated'; readonly code: string }
  | { readonly type: 'matched'; readonly gameId: string; readonly color: Color }
  | ErrorMessage;

export type GameClientMessage =
  | { readonly type: 'move'; readonly uci: string; readonly ply: number }
  | { readonly type: 'resign' }
  | { readonly type: 'offerDraw' }
  | { readonly type: 'acceptDraw' }
  | { readonly type: 'declineDraw' };

export type GameServerMessage =
  | { readonly type: 'state'; readonly game: LiveGame }
  | { readonly type: 'move'; readonly uci: string; readonly san: string; readonly ply: number; readonly clocks: Clocks }
  | { readonly type: 'drawOffered'; readonly by: Color }
  | { readonly type: 'end'; readonly game: GameSummary }
  | ErrorMessage;
