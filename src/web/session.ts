// 로그인한 나(없으면 null) · 화면 설정(종목·색)
import type { Me, VariantId } from '../shared/protocol';
import { api, ApiError } from './api';
import { storage } from './storage';

export type ColorChoice = 'white' | 'black' | 'random';

export const session = {
  me: null as Me | null,

  async refresh(): Promise<Me | null> {
    try {
      this.me = await api.me();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      this.me = null;
    }
    return this.me;
  },
};

export const settings = {
  get variant(): VariantId {
    return storage.get('variant') === 'mini' ? 'mini' : 'standard';
  },
  set variant(value: VariantId) {
    storage.set('variant', value);
  },
  get color(): ColorChoice {
    const saved = storage.get('color');
    return saved === 'black' || saved === 'random' ? saved : 'white';
  },
  set color(value: ColorChoice) {
    storage.set('color', value);
  },
};
