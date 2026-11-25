import { describe, expect, it } from 'vitest';
import { koreaWeekStart } from '../src/shared/week';

describe('이번 주(한국 월요일 0시부터)', () => {
  it('한국 월요일 0시가 새 주의 시작', () => {
    expect(koreaWeekStart(new Date('2026-11-22T15:00:00Z'))).toBe('2026-11-23');   // 한국 11-23(월) 00:00
    expect(koreaWeekStart(new Date('2026-11-22T14:59:59Z'))).toBe('2026-11-16');   // 한국 11-22(일) 23:59
  });

  it('주 중간·일요일 밤도 그 주 월요일', () => {
    expect(koreaWeekStart(new Date('2026-11-25T03:00:00Z'))).toBe('2026-11-23');   // 수요일
    expect(koreaWeekStart(new Date('2026-11-29T14:00:00Z'))).toBe('2026-11-23');   // 한국 일요일 23:00
  });
});
