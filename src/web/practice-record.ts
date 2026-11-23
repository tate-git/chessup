// 봇 격파 기록: 로그인하면 서버, 아니면 이 기기
import type { VariantId } from '../shared/protocol';
import { api } from './api';
import { session } from './session';
import { storage } from './storage';

let serverCleared: Record<VariantId, number> | null = null;

export async function loadCleared(): Promise<Record<VariantId, number>> {
  if (!session.me) return { standard: localCleared('standard'), mini: localCleared('mini') };
  serverCleared = (await api.practice()).cleared;
  return serverCleared;
}

export async function recordClear(variant: VariantId, level: number): Promise<void> {
  if (session.me) {
    serverCleared = (await api.recordClear(variant, level)).cleared;
    return;
  }
  if (level > localCleared(variant)) storage.set(`cleared:${variant}`, String(level));
}

const localCleared = (variant: VariantId) => Number(storage.get(`cleared:${variant}`) ?? 0);
