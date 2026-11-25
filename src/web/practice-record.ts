// 봇 격파 기록(깬 최고 단계 · 도움 없이 깬 최고 단계): 로그인하면 서버, 아니면 이 기기
import type { PracticeState, VariantId } from '../shared/protocol';
import { api } from './api';
import { session } from './session';
import { storage } from './storage';

export async function loadCleared(): Promise<PracticeState> {
  if (!session.me) return { cleared: localLevels('cleared'), unassisted: localLevels('unassisted') };
  return api.practice();
}

export async function recordClear(variant: VariantId, level: number, assisted: boolean): Promise<void> {
  if (session.me) {
    await api.recordClear(variant, level, assisted);
    return;
  }
  raiseLocal('cleared', variant, level);
  if (!assisted) raiseLocal('unassisted', variant, level);
}

type LocalKind = 'cleared' | 'unassisted';

const localLevel = (kind: LocalKind, variant: VariantId) => Number(storage.get(`${kind}:${variant}`) ?? 0);
const localLevels = (kind: LocalKind) => ({ standard: localLevel(kind, 'standard'), mini: localLevel(kind, 'mini') });

function raiseLocal(kind: LocalKind, variant: VariantId, level: number): void {
  if (level > localLevel(kind, variant)) storage.set(`${kind}:${variant}`, String(level));
}
