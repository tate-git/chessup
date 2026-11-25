package com.chessup.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import com.chessup.TestDatabase;
import com.chessup.game.FinishedGame;
import com.chessup.game.GameRepository;
import com.chessup.game.GameResult;
import com.chessup.game.RatedGame;
import com.chessup.game.Variant;
import com.chessup.user.UserRepository;

@SpringBootTest
@Import(TestDatabase.class)
@Transactional
class StatsRepositoryTest {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

    @Autowired
    private StatsRepository stats;

    @Autowired
    private UserRepository users;

    @Autowired
    private GameRepository games;

    @Test
    void 상대별_전적은_많이_둔_상대부터_승무패를_나_기준으로_센다() {
        var me = user("me");
        var anna = user("anna");
        var bora = user("bora");
        play(me, anna, GameResult.WHITE_WINS, 1500, 10, ago(3));   // 백으로 이김
        play(anna, me, GameResult.WHITE_WINS, 1510, -8, ago(2));   // 흑으로 짐
        play(anna, me, GameResult.BLACK_WINS, 1502, 9, ago(1));    // 흑으로 이김
        play(me, bora, GameResult.DRAW, 1511, 0, ago(0));

        var records = stats.byOpponent(me, Variant.STANDARD, 10);

        assertThat(records).containsExactly(
                new OpponentRecord("anna", new Tally(3, 2, 0, 1)),
                new OpponentRecord("bora", new Tally(1, 0, 1, 0)));
    }

    @Test
    void 백_흑으로_나눠_센다() {
        var me = user("me");
        var rival = user("rival");
        play(me, rival, GameResult.WHITE_WINS, 1500, 10, ago(2));
        play(me, rival, GameResult.BLACK_WINS, 1510, -9, ago(1));
        play(rival, me, GameResult.DRAW, 1501, 0, ago(0));

        var colors = stats.byColor(me, Variant.STANDARD);

        assertThat(colors.white()).isEqualTo(new Tally(2, 1, 0, 1));
        assertThat(colors.black()).isEqualTo(new Tally(1, 0, 1, 0));
        assertThat(colors.white().score()).isEqualTo(0.5);
    }

    @Test
    void 레이팅_추이는_한국_날짜마다_그날_마지막_대국_뒤_값() {
        var me = user("me");
        var rival = user("rival");
        var today = LocalDate.now(KOREA);
        // 한국 날짜 기준: 오늘 새벽 0시 30분은 UTC 로는 어제 15시 30분 → 오늘로 셈
        play(me, rival, GameResult.WHITE_WINS, 1500, 12, at(today.minusDays(1), 21));
        play(me, rival, GameResult.WHITE_WINS, 1512, 10, at(today, 0));
        play(rival, me, GameResult.BLACK_WINS, 1530, -7, at(today, 1));   // 오늘 마지막: 흑으로 이겨 1522 + 7
        play(me, rival, GameResult.WHITE_WINS, 1400, 30, at(today.minusDays(40), 12));   // 30일 밖

        var history = stats.ratingHistory(me, Variant.STANDARD, 30);

        assertThat(history).extracting(RatingPoint::day).containsExactly(today.minusDays(1), today);
        assertThat(history.get(0).rating()).isEqualTo(1512);
        assertThat(history.get(1).rating()).isEqualTo(1529);
    }

    private UUID user(String name) {
        return users.create(name, "hash").orElseThrow().id();
    }

    /** 흑은 늘 1522 에서 시작해 백과 반대로 바뀐다고 둠(통계 계산만 봄) */
    private void play(UUID white, UUID black, GameResult result, int whiteRating, int whiteChange, OffsetDateTime endedAt) {
        var game = new FinishedGame(UUID.randomUUID(), Variant.STANDARD, "5+3", white, black, result, "checkmate", List.of("e2e4"), endedAt.minusMinutes(5), endedAt);
        games.insert(game, new RatedGame(game.id(), whiteRating, 1522, whiteChange, -whiteChange));
    }

    private static OffsetDateTime ago(int days) {
        return OffsetDateTime.now(ZoneOffset.UTC).minusDays(days);
    }

    /** 한국 시각 hour 시 30분 */
    private static OffsetDateTime at(LocalDate day, int hour) {
        return day.atTime(hour, 30).atZone(KOREA).toOffsetDateTime();
    }
}
