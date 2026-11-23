// Worker 에 묶인 자원(wrangler.toml)
import type { GameRoom } from './live/game-room';
import type { Lobby } from './live/lobby';

export interface Env {
  readonly DB: D1Database;
  readonly LOBBY: DurableObjectNamespace<Lobby>;
  readonly GAME_ROOM: DurableObjectNamespace<GameRoom>;
  readonly ASSETS: Fetcher;
}

export interface SessionUser {
  readonly id: string;
  readonly username: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
