// Glicko-2 레이팅(Glickman, 2013 · http://www.glicko.net/glicko/glicko2.pdf) — 대국 하나를 한 평가 기간으로 봄
export interface GlickoRating {
  readonly rating: number;
  readonly deviation: number;
  readonly volatility: number;
}

export interface GlickoResult {
  readonly opponent: GlickoRating;
  /** 1 = 이김 · 0.5 = 비김 · 0 = 짐 */
  readonly score: number;
}

export const INITIAL_RATING: GlickoRating = { rating: 1500, deviation: 350, volatility: 0.06 };
const SCALE = 173.7178;
const TAU = 0.5;   // 변동성이 얼마나 빨리 바뀌나(0.3~1.2)
const CONVERGENCE = 0.000001;
const MAX_DEVIATION = 350;
const MIN_DEVIATION = 45;   // 너무 굳지 않게(오래 둔 사람도 조금씩은 움직임)

export function updateRating(player: GlickoRating, results: readonly GlickoResult[]): GlickoRating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  if (results.length === 0) return { ...player, deviation: clampDeviation(Math.sqrt(phi ** 2 + player.volatility ** 2) * SCALE) };

  const games = results.map(({ opponent, score }) => {
    const opponentMu = (opponent.rating - 1500) / SCALE;
    const g = impact(opponent.deviation / SCALE);
    return { g, expected: expectedScore(mu, opponentMu, g), score };
  });
  const variance = 1 / games.reduce((sum, { g, expected }) => sum + g ** 2 * expected * (1 - expected), 0);
  const improvement = variance * games.reduce((sum, { g, expected, score }) => sum + g * (score - expected), 0);

  const volatility = nextVolatility(phi, variance, improvement, player.volatility);
  const preDeviation = Math.sqrt(phi ** 2 + volatility ** 2);
  const newPhi = 1 / Math.sqrt(1 / preDeviation ** 2 + 1 / variance);
  const newMu = mu + newPhi ** 2 * games.reduce((sum, { g, expected, score }) => sum + g * (score - expected), 0);

  return { rating: newMu * SCALE + 1500, deviation: clampDeviation(newPhi * SCALE), volatility };
}

const impact = (phi: number) => 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
const expectedScore = (mu: number, opponentMu: number, g: number) => 1 / (1 + Math.exp(-g * (mu - opponentMu)));
const clampDeviation = (deviation: number) => Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, deviation));

/** 논문 5단계: Illinois 방법으로 새 변동성 찾기 */
function nextVolatility(phi: number, variance: number, improvement: number, volatility: number): number {
  const a = Math.log(volatility ** 2);
  const f = (x: number) =>
    (Math.exp(x) * (improvement ** 2 - phi ** 2 - variance - Math.exp(x))) / (2 * (phi ** 2 + variance + Math.exp(x)) ** 2) - (x - a) / TAU ** 2;

  let lower = a;
  let upper: number;
  if (improvement ** 2 > phi ** 2 + variance) {
    upper = Math.log(improvement ** 2 - phi ** 2 - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    upper = a - k * TAU;
  }
  let fLower = f(lower);
  let fUpper = f(upper);
  while (Math.abs(upper - lower) > CONVERGENCE) {
    const next = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fNext = f(next);
    if (fNext * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = next;
    fUpper = fNext;
  }
  return Math.exp(lower / 2);
}
