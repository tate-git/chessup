package com.chessup.rating;

import java.util.List;
import java.util.function.DoubleUnaryOperator;

/** Glicko-2(Glickman, 2013 · http://www.glicko.net/glicko/glicko2.pdf) — TS 의 src/worker/rating/glicko2.ts 와 같은 계산 */
public final class Glicko2 {

    private static final double SCALE = 173.7178;
    /** 변동성이 얼마나 빨리 바뀌나(0.3~1.2) */
    private static final double TAU = 0.5;
    private static final double CONVERGENCE = 0.000001;
    private static final double MAX_DEVIATION = 350;
    /** 너무 굳지 않게(오래 둔 사람도 조금씩은 움직임) */
    private static final double MIN_DEVIATION = 45;

    private Glicko2() {
    }

    public static GlickoRating update(GlickoRating player, List<GlickoResult> results) {
        double mu = (player.rating() - 1500) / SCALE;
        double phi = player.deviation() / SCALE;
        if (results.isEmpty()) {
            return new GlickoRating(player.rating(), clampDeviation(Math.sqrt(phi * phi + player.volatility() * player.volatility()) * SCALE), player.volatility());
        }

        List<Game> games = results.stream().map(result -> Game.of(mu, result)).toList();
        double variance = 1 / games.stream().mapToDouble(game -> game.g * game.g * game.expected * (1 - game.expected)).sum();
        double scoreSum = games.stream().mapToDouble(game -> game.g * (game.score - game.expected)).sum();
        double improvement = variance * scoreSum;

        double volatility = nextVolatility(phi, variance, improvement, player.volatility());
        double preDeviation = Math.sqrt(phi * phi + volatility * volatility);
        double newPhi = 1 / Math.sqrt(1 / (preDeviation * preDeviation) + 1 / variance);
        double newMu = mu + newPhi * newPhi * scoreSum;

        return new GlickoRating(newMu * SCALE + 1500, clampDeviation(newPhi * SCALE), volatility);
    }

    private record Game(double g, double expected, double score) {

        static Game of(double mu, GlickoResult result) {
            double opponentMu = (result.opponent().rating() - 1500) / SCALE;
            double g = impact(result.opponent().deviation() / SCALE);
            return new Game(g, 1 / (1 + Math.exp(-g * (mu - opponentMu))), result.score());
        }
    }

    private static double impact(double phi) {
        return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
    }

    private static double clampDeviation(double deviation) {
        return Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, deviation));
    }

    /** 논문 5단계: Illinois 방법으로 새 변동성 찾기 */
    private static double nextVolatility(double phi, double variance, double improvement, double volatility) {
        double a = Math.log(volatility * volatility);
        double base = phi * phi + variance;
        DoubleUnaryOperator f = x ->
                Math.exp(x) * (improvement * improvement - base - Math.exp(x)) / (2 * Math.pow(base + Math.exp(x), 2)) - (x - a) / (TAU * TAU);

        double lower = a;
        double upper;
        if (improvement * improvement > base) {
            upper = Math.log(improvement * improvement - base);
        } else {
            int k = 1;
            while (f.applyAsDouble(a - k * TAU) < 0) {
                k++;
            }
            upper = a - k * TAU;
        }
        double fLower = f.applyAsDouble(lower);
        double fUpper = f.applyAsDouble(upper);
        while (Math.abs(upper - lower) > CONVERGENCE) {
            double next = lower + (lower - upper) * fLower / (fUpper - fLower);
            double fNext = f.applyAsDouble(next);
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
}
