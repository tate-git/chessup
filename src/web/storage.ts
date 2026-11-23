// localStorage 감싸기(사생활 보호 모드 등에서 실패해도 게임은 계속)
const PREFIX = 'chessup:';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      // 저장 못 해도 진행에는 지장 없음
    }
  },
  getJson<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};
