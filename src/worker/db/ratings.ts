// 종목별 레이팅 표(행이 없으면 처음 값)
import { VARIANTS, type VariantId } from '../../engine/variants';
import type { Rating, Ratings } from '../../shared/protocol';
import { INITIAL_RATING, type GlickoRating } from '../rating/glicko2';

export interface RatingRow extends GlickoRating {
  readonly variant: VariantId;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

const PROVISIONAL_DEVIATION = 110;
const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];

export const freshRating = (variant: VariantId): RatingRow => ({ variant, ...INITIAL_RATING, games: 0, wins: 0, losses: 0, draws: 0 });

export async function loadRatings(db: D1Database, userId: string): Promise<Record<VariantId, RatingRow>> {
  const { results } = await db
    .prepare('SELECT variant, rating, deviation, volatility, games, wins, losses, draws FROM ratings WHERE user_id = ?')
    .bind(userId)
    .all<RatingRow>();
  return Object.fromEntries(VARIANT_IDS.map(variant => [variant, results.find(row => row.variant === variant) ?? freshRating(variant)])) as Record<VariantId, RatingRow>;
}

export async function loadRating(db: D1Database, userId: string, variant: VariantId): Promise<RatingRow> {
  return (await loadRatings(db, userId))[variant];
}

export function saveRatingStatement(db: D1Database, userId: string, row: RatingRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO ratings (user_id, variant, rating, deviation, volatility, games, wins, losses, draws, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, variant) DO UPDATE SET
         rating = excluded.rating, deviation = excluded.deviation, volatility = excluded.volatility,
         games = excluded.games, wins = excluded.wins, losses = excluded.losses, draws = excluded.draws, updated_at = excluded.updated_at`,
    )
    .bind(userId, row.variant, row.rating, row.deviation, row.volatility, row.games, row.wins, row.losses, row.draws, new Date().toISOString());
}

export function toRatingView(row: RatingRow): Rating {
  return {
    rating: Math.round(row.rating),
    deviation: Math.round(row.deviation),
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    provisional: row.deviation > PROVISIONAL_DEVIATION,
  };
}

export function toRatingsView(rows: Record<VariantId, RatingRow>): Ratings {
  return Object.fromEntries(VARIANT_IDS.map(variant => [variant, toRatingView(rows[variant])])) as Ratings;
}

export const totalGames = (rows: Record<VariantId, RatingRow>) => VARIANT_IDS.reduce((sum, variant) => sum + rows[variant].games, 0);
