import { describe, expect, it } from 'vitest';
import { updateRating } from '../src/worker/rating/glicko2';

describe('Glicko-2', () => {
  it('논문 예제: 1500/200 이 1400·1550·1700 과 두어 1승 2패 → 1464.06 / 151.52 / 0.05999', () => {
    const next = updateRating({ rating: 1500, deviation: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.deviation).toBeCloseTo(151.52, 1);
    expect(next.volatility).toBeCloseTo(0.05999, 4);   // 논문 값은 반올림(실제 0.059996)
  });

  it('처음 두 사람이 두면 이긴 쪽은 오르고 진 쪽은 같은 만큼 내림', () => {
    const fresh = { rating: 1500, deviation: 350, volatility: 0.06 };
    const winner = updateRating(fresh, [{ opponent: fresh, score: 1 }]);
    const loser = updateRating(fresh, [{ opponent: fresh, score: 0 }]);
    expect(winner.rating).toBeGreaterThan(1600);
    expect(winner.rating - 1500).toBeCloseTo(1500 - loser.rating, 6);
  });
});
