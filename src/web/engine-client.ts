// 엔진 스레드에 묻고 답을 Promise 로 받기
import type { VariantId } from '../engine';
import type { EngineRequest, EngineResponse } from './engine.worker';

type Pending = (uci: string | null) => void;
type RequestBody = Omit<Extract<EngineRequest, { kind: 'bot' }>, 'id'> | Omit<Extract<EngineRequest, { kind: 'hint' }>, 'id'>;

class EngineClient {
  readonly #worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;

  constructor() {
    this.#worker.onmessage = ({ data }: MessageEvent<EngineResponse>) => {
      this.#pending.get(data.id)?.(data.uci);
      this.#pending.delete(data.id);
    };
  }

  botMove(variant: VariantId, fen: string, level: number): Promise<string | null> {
    return this.#ask({ kind: 'bot', variant, fen, level });
  }

  hint(variant: VariantId, fen: string): Promise<string | null> {
    return this.#ask({ kind: 'hint', variant, fen });
  }

  #ask(body: RequestBody): Promise<string | null> {
    const id = this.#nextId++;
    return new Promise(resolve => {
      this.#pending.set(id, resolve);
      this.#worker.postMessage({ id, ...body } satisfies EngineRequest);
    });
  }
}

export const engine = new EngineClient();
