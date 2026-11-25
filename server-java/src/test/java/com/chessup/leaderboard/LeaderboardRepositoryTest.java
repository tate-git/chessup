package com.chessup.leaderboard;

import static com.chessup.db.Tables.RATINGS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.time.OffsetDateTime;
import java.util.UUID;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import com.chessup.TestDatabase;
import com.chessup.game.Variant;
import com.chessup.rating.GlickoRating;
import com.chessup.rating.PlayerRating;
import com.chessup.user.UserRepository;

/** 시험마다 넣은 회원·레이팅은 끝나면 되돌림(다른 시험과 같은 DB 를 써서) */
@SpringBootTest
@Import(TestDatabase.class)
@Transactional
class LeaderboardRepositoryTest {

    @Autowired
    private LeaderboardRepository leaderboard;

    @Autowired
    private UserRepository users;

    @Autowired
    private DSLContext dsl;

    @Test
    void 높은_순으로_같은_레이팅은_같은_순위_10판_미만은_빠진다() {
        player("alpha", 1800.4, 12);
        player("bravo", 1700.2, 30);
        player("charlie", 1699.6, 15);   // 표시 1700 → bravo 와 같은 순위
        player("delta", 1650, 10);
        player("rookie", 2000, 9);       // 10판 미만

        var top = leaderboard.top(Variant.MINI, 10);

        assertThat(top).extracting(LeaderboardEntry::rank, LeaderboardEntry::username, LeaderboardEntry::rating)
                .containsExactly(
                        tuple(1, "alpha", 1800),
                        tuple(2, "bravo", 1700),
                        tuple(2, "charlie", 1700),
                        tuple(4, "delta", 1650));
    }

    @Test
    void 랭킹의_표시_레이팅은_대국_화면과_같게_반올림한다() {
        player("half", 1700.5, 10);
        var shownInGame = new PlayerRating(new GlickoRating(1700.5, 100, 0.06), 10, 5, 5, 0).shown();

        assertThat(leaderboard.top(Variant.MINI, 1)).extracting(LeaderboardEntry::rating).containsExactly(shownInGame);
        assertThat(shownInGame).isEqualTo(1701);
    }

    @Test
    void 개수_제한() {
        for (int index = 0; index < 5; index++) {
            player("limit" + index, 1500 + index, 10);
        }

        assertThat(leaderboard.top(Variant.MINI, 3)).extracting(LeaderboardEntry::username).containsExactly("limit4", "limit3", "limit2");
    }

    @Test
    void 내_순위는_앞뒤_5명과_전체_인원() {
        UUID me = null;
        for (int index = 0; index < 20; index++) {
            var id = player("n" + (char) ('a' + index), 2000 - index * 10, 10);
            if (index == 10) {
                me = id;
            }
        }

        var standing = leaderboard.standing(me, Variant.MINI).orElseThrow();

        assertThat(standing.rank()).isEqualTo(11);
        assertThat(standing.players()).isEqualTo(20);
        assertThat(standing.nearby()).extracting(LeaderboardEntry::rank).containsExactly(6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    }

    @Test
    void 일등이면_뒤로_5명만() {
        var first = player("top", 2500, 10);
        for (int index = 0; index < 8; index++) {
            player("below" + index, 1500 - index, 10);
        }

        var standing = leaderboard.standing(first, Variant.MINI).orElseThrow();

        assertThat(standing.rank()).isEqualTo(1);
        assertThat(standing.nearby()).hasSize(6).first().extracting(LeaderboardEntry::username).isEqualTo("top");
    }

    @Test
    void 십_판_미만이면_순위_없음() {
        var newbie = player("newbie", 1900, 3);

        assertThat(leaderboard.standing(newbie, Variant.MINI)).isEmpty();
    }

    private UUID player(String username, double rating, int games) {
        var id = users.create(username, "hash").orElseThrow().id();
        dsl.insertInto(RATINGS)
                .set(RATINGS.USER_ID, id)
                .set(RATINGS.VARIANT, Variant.MINI)
                .set(RATINGS.RATING, rating)
                .set(RATINGS.GAMES, games)
                .set(RATINGS.UPDATED_AT, OffsetDateTime.now())
                .execute();
        return id;
    }
}
