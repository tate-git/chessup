// 힌트 횟수: 로그인하면 서버가 셈, 아니면 이 기기에서(초보처럼 한 판 1번)
import type { HintAllowance } from '../shared/protocol';
import { api } from './api';

export interface HintSource {
  readonly allowance: HintAllowance;
  /** 쓸 수 있으면 하나 쓰고 true */
  use(): Promise<boolean>;
}

export class LocalHints implements HintSource {
  #used = false;

  get allowance(): HintAllowance {
    return { remaining: this.#used ? 0 : 1, scope: 'game' };
  }

  async use(): Promise<boolean> {
    if (this.#used) return false;
    this.#used = true;
    return true;
  }
}

export class ServerHints implements HintSource {
  readonly #practiceGameId = crypto.randomUUID();

  constructor(private current: HintAllowance) {}

  get allowance(): HintAllowance {
    return this.current;
  }

  async use(): Promise<boolean> {
    if (this.current.remaining <= 0) return false;
    try {
      this.current = await api.useHint(this.#practiceGameId);
      return true;
    } catch {
      this.current = { ...this.current, remaining: 0 };
      return false;
    }
  }
}
