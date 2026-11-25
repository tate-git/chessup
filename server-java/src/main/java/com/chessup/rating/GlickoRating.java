package com.chessup.rating;

/** Glicko-2 세 값 */
public record GlickoRating(double rating, double deviation, double volatility) {

    public static final GlickoRating INITIAL = new GlickoRating(1500, 350, 0.06);
}
