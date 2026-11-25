package com.chessup.rating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;

import org.junit.jupiter.api.Test;

/** TS 의 test/glicko2.test.ts 와 같은 검사 */
class Glicko2Test {

    @Test
    void 논문_예제_1승_2패() {
        var next = Glicko2.update(new GlickoRating(1500, 200, 0.06), List.of(
                new GlickoResult(new GlickoRating(1400, 30, 0.06), 1),
                new GlickoResult(new GlickoRating(1550, 100, 0.06), 0),
                new GlickoResult(new GlickoRating(1700, 300, 0.06), 0)));

        assertThat(next.rating()).isCloseTo(1464.06, within(0.05));
        assertThat(next.deviation()).isCloseTo(151.52, within(0.05));
        assertThat(next.volatility()).isCloseTo(0.05999, within(0.00005));
    }

    @Test
    void 처음_두_사람이_두면_오르고_내리는_폭이_같다() {
        var fresh = GlickoRating.INITIAL;
        var winner = Glicko2.update(fresh, List.of(new GlickoResult(fresh, 1)));
        var loser = Glicko2.update(fresh, List.of(new GlickoResult(fresh, 0)));

        assertThat(winner.rating()).isGreaterThan(1600);
        assertThat(winner.rating() - 1500).isCloseTo(1500 - loser.rating(), within(0.000001));
    }
}
