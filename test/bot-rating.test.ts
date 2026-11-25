import { describe, expect, it } from 'vitest';
import { botRating, pickBotLevel } from '../src/worker/rating/bot-rating';

describe('랜덤 봇 레이팅', () => {
  it('1단 800 ~ 10단 2200 · 단계가 오를수록 높음', () => {
    expect(botRating(1).rating).toBe(800);
    expect(botRating(10).rating).toBe(2200);
    for (let level = 2; level <= 10; level++) expect(botRating(level).rating).toBeGreaterThan(botRating(level - 1).rating);
  });

  it('내 레이팅에 가장 가까운 단계 ±1 · 1~10 안', () => {
    // 1500 에 가장 가까운 건 5단(1422)
    expect([pickBotLevel(1500, () => 0), pickBotLevel(1500, () => 0.5), pickBotLevel(1500, () => 0.99)]).toEqual([4, 5, 6]);
    expect(pickBotLevel(300, () => 0)).toBe(1);
    expect(pickBotLevel(3000, () => 0.99)).toBe(10);
  });
});
