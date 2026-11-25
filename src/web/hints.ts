// 힌트 횟수: 누구나 한 판 3번 · 로그인하면 서버에도 기록(서버도 판마다 3번까지만 받음)
import { HINTS_PER_GAME } from '../shared/protocol';
import { api } from './api';

export interface HintSource {
  readonly remaining: number;
  /** 쓸 수 있으면 하나 쓰고 true */
  use(): Promise<boolean>;
}

export class LocalHints implements HintSource {
  #remaining = HINTS_PER_GAME;

  get remaining(): number {
    return this.#remaining;
  }

  async use(): Promise<boolean> {
    if (this.#remaining <= 0) return false;
    this.#remaining -= 1;
    return true;
  }
}

export class ServerHints implements HintSource {
  readonly #practiceGameId = crypto.randomUUID();
  #remaining = HINTS_PER_GAME;

  get remaining(): number {
    return this.#remaining;
  }

  async use(): Promise<boolean> {
    if (this.#remaining <= 0) return false;
    try {
      this.#remaining = (await api.useHint(this.#practiceGameId)).remaining;
      return true;
    } catch {
      this.#remaining = 0;
      return false;
    }
  }
}
