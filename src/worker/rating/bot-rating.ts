// 랭킹 대결의 랜덤 봇: 단계마다 정해진 레이팅(1단 800 ~ 10단 2200) · 내 레이팅 근처 단계를 고르고 앞뒤 한 단계 안에서 무작위
import { BOT_LEVELS } from '../../engine/bot';
import type { GlickoRating } from './glicko2';

const LOWEST = 800;
const HIGHEST = 2200;
/** 봇은 실력이 고정이라 편차를 작게 둠 */
const BOT_DEVIATION = 50;

export function botRating(level: number): GlickoRating {
  const step = (HIGHEST - LOWEST) / (BOT_LEVELS.length - 1);
  return { rating: Math.round(LOWEST + (level - 1) * step), deviation: BOT_DEVIATION, volatility: 0.06 };
}

/** 레이팅이 가장 가까운 단계 ±1(무작위) · 1~10 안 */
export function pickBotLevel(playerRating: number, random: () => number = Math.random): number {
  const nearest = BOT_LEVELS.reduce((best, { level }) =>
    Math.abs(botRating(level).rating - playerRating) < Math.abs(botRating(best).rating - playerRating) ? level : best, 1);
  const offset = Math.floor(random() * 3) - 1;
  return Math.min(BOT_LEVELS.length, Math.max(1, nearest + offset));
}
