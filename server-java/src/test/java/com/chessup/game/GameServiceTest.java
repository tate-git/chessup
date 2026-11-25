package com.chessup.game;

import static com.chessup.db.Tables.GAMES;
import static com.chessup.db.Tables.RATINGS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;

import com.chessup.TestDatabase;
import com.chessup.user.UserRepository;

@SpringBootTest
@Import(TestDatabase.class)
class GameServiceTest {

    @Autowired
    private GameService service;

    @Autowired
    private UserRepository users;

    @Autowired
    private DSLContext dsl;

    @Test
    void 처음_두는_두_사람_이긴_쪽은_오르고_진_쪽은_내리며_대국이_저장된다() {
        var white = newUser();
        var black = newUser();

        var rated = service.finish(game(white, black, GameResult.WHITE_WINS));

        assertThat(rated.whiteRating()).isEqualTo(1500);
        assertThat(rated.whiteChange()).isPositive().isEqualTo(-rated.blackChange());
        assertThat(ratingOf(white)).isEqualTo(1500 + rated.whiteChange());
        assertThat(gamesOf(white)).isEqualTo(1);
        assertThat(dsl.fetchExists(GAMES, GAMES.ID.eq(rated.id()))).isTrue();
    }

    @Test
    void 두_번째_대국은_바뀐_레이팅에서_시작한다() {
        var white = newUser();
        var black = newUser();
        var first = service.finish(game(white, black, GameResult.WHITE_WINS));

        var second = service.finish(game(white, black, GameResult.DRAW));

        assertThat(second.whiteRating()).isEqualTo(1500 + first.whiteChange());
        assertThat(gamesOf(white)).isEqualTo(2);
    }

    @Test
    void 대국_저장이_실패하면_레이팅도_바뀌지_않는다() {
        var white = newUser();
        var black = newUser();
        var first = game(white, black, GameResult.WHITE_WINS);
        service.finish(first);
        int before = ratingOf(white);

        // 같은 대국 id 로 또 저장 → 레이팅 갱신 뒤 대국 insert 에서 실패 → 전부 되돌림
        var duplicate = new FinishedGame(first.id(), Variant.STANDARD, "5+3", white, black, GameResult.WHITE_WINS, "checkmate", List.of("e2e4"), first.startedAt(), first.endedAt());
        assertThatThrownBy(() -> service.finish(duplicate)).isInstanceOf(DuplicateKeyException.class);

        assertThat(ratingOf(white)).isEqualTo(before);
        assertThat(gamesOf(white)).isEqualTo(1);
    }

    @Test
    void 한_사람의_대국_여러_판이_동시에_끝나도_하나도_빠지지_않는다() throws Exception {
        var player = newUser();
        int simultaneous = 8;
        List<Callable<RatedGame>> finishes = IntStream.range(0, simultaneous)
                .<Callable<RatedGame>>mapToObj(index -> () -> service.finish(game(player, newUser(), GameResult.WHITE_WINS)))
                .toList();

        try (var pool = Executors.newFixedThreadPool(simultaneous)) {
            for (var future : pool.invokeAll(finishes)) {
                future.get();
            }
        }

        assertThat(gamesOf(player)).isEqualTo(simultaneous);
        assertThat(dsl.fetchValue(RATINGS.WINS, RATINGS.USER_ID.eq(player))).isEqualTo(simultaneous);
    }

    private UUID newUser() {
        return users.create("p" + UUID.randomUUID().toString().substring(0, 12), "hash").orElseThrow().id();
    }

    private static FinishedGame game(UUID white, UUID black, GameResult result) {
        var now = OffsetDateTime.now();
        return new FinishedGame(UUID.randomUUID(), Variant.STANDARD, "5+3", white, black, result, "checkmate", List.of("e2e4", "e7e5"), now.minusMinutes(5), now);
    }

    private int ratingOf(UUID userId) {
        return (int) Math.round(dsl.fetchValue(RATINGS.RATING, RATINGS.USER_ID.eq(userId).and(RATINGS.VARIANT.eq(Variant.STANDARD))));
    }

    private int gamesOf(UUID userId) {
        return dsl.fetchValue(RATINGS.GAMES, RATINGS.USER_ID.eq(userId).and(RATINGS.VARIANT.eq(Variant.STANDARD)));
    }
}
