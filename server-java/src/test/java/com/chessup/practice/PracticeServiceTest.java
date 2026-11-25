package com.chessup.practice;

import static com.chessup.db.Tables.HINT_USES;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.chessup.TestDatabase;
import com.chessup.game.Variant;
import com.chessup.user.UserRepository;

@SpringBootTest
@Import(TestDatabase.class)
class PracticeServiceTest {

    @Autowired
    private PracticeService practice;

    @Autowired
    private UserRepository users;

    @Autowired
    private DSLContext dsl;

    @Test
    void 격파는_최고_단계만_남고_도움_받고_깨면_도움_없이_단계는_그대로() {
        var user = newUser();
        practice.recordClear(user, Variant.MINI, 4, false);
        practice.recordClear(user, Variant.MINI, 2, false);

        var helped = practice.recordClear(user, Variant.MINI, 6, true);
        assertThat(helped.get(Variant.MINI)).isEqualTo(new ClearLevels(6, 4));
        assertThat(helped.get(Variant.STANDARD)).isEqualTo(ClearLevels.NONE);

        var alone = practice.recordClear(user, Variant.MINI, 6, false);
        assertThat(alone.get(Variant.MINI)).isEqualTo(new ClearLevels(6, 6));
    }

    @Test
    void 힌트는_한_판에_3번_다른_판이면_다시_3번() {
        var user = newUser();

        assertThat(IntStream.range(0, 4).mapToObj(index -> practice.useHint(user, "g1")))
                .containsExactly(OptionalInt.of(2), OptionalInt.of(1), OptionalInt.of(0), OptionalInt.empty());
        assertThat(practice.useHint(user, "g2")).hasValue(2);
    }

    @Test
    void 한_판에서_동시에_10번_눌러도_3번만_쓰인다() throws Exception {
        var user = newUser();
        List<Callable<OptionalInt>> presses = IntStream.range(0, 10)
                .<Callable<OptionalInt>>mapToObj(index -> () -> practice.useHint(user, "same-game"))
                .toList();

        try (var pool = Executors.newFixedThreadPool(10)) {
            var results = pool.invokeAll(presses).stream().map(future -> {
                try {
                    return future.get();
                } catch (Exception error) {
                    throw new IllegalStateException(error);
                }
            }).toList();
            assertThat(results).filteredOn(OptionalInt::isPresent).hasSize(3);
        }
        assertThat(dsl.fetchCount(HINT_USES, HINT_USES.USER_ID.eq(user))).isEqualTo(3);
    }

    private UUID newUser() {
        return users.create("q" + UUID.randomUUID().toString().substring(0, 12), "hash").orElseThrow().id();
    }
}
