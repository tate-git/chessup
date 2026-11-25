package com.chessup.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import com.chessup.TestDatabase;
import com.chessup.user.UserRepository;

@SpringBootTest
@Import(TestDatabase.class)
@Transactional
class GameSearchRepositoryTest {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private static final LocalDate DAY = LocalDate.of(2026, 11, 20);

    @Autowired
    private GameSearchRepository repository;

    @Autowired
    private GameRepository games;

    @Autowired
    private UserRepository users;

    @Test
    void 조건이_없으면_내_대국만_최근_순으로_내_쪽에서_본_결과와_레이팅() {
        var me = user("me");
        var anna = user("Anna");
        var someone = user("someone");
        var won = play(me, anna, Variant.STANDARD, GameResult.WHITE_WINS, at(DAY, 10));
        var lost = play(anna, me, Variant.MINI, GameResult.WHITE_WINS, at(DAY, 11));
        play(anna, someone, Variant.STANDARD, GameResult.DRAW, at(DAY, 12));   // 남의 대국

        var page = repository.search(GameSearch.mine(me), null, 10);

        assertThat(page.games()).extracting(GameListItem::id).containsExactly(lost, won);
        var latest = page.games().getFirst();
        assertThat(latest.opponent()).isEqualTo("Anna");
        assertThat(latest.color()).isEqualTo(Color.BLACK);
        assertThat(latest.outcome()).isEqualTo(Outcome.LOSS);
        assertThat(latest.rating()).isEqualTo(1400);           // 흑 레이팅
        assertThat(latest.ratingChange()).isEqualTo(-10);
        assertThat(page.next()).isNull();
    }

    @Test
    void 조건마다_주어진_것만_걸린다() {
        var me = user("me");
        var anna = user("Anna");
        var bora = user("bora");
        var a = play(me, anna, Variant.STANDARD, GameResult.WHITE_WINS, at(DAY, 9));    // 백 · 이김
        var b = play(anna, me, Variant.STANDARD, GameResult.BLACK_WINS, at(DAY, 10));   // 흑 · 이김
        var c = play(me, bora, Variant.MINI, GameResult.DRAW, at(DAY, 11));             // 백 · 비김
        var d = play(bora, me, Variant.STANDARD, GameResult.WHITE_WINS, at(DAY.plusDays(1), 0));   // 흑 · 짐 · 다음 날 새벽(한국)

        var mine = GameSearch.mine(me);
        assertThat(ids(mine.withVariant(Variant.MINI))).containsExactly(c);
        assertThat(ids(mine.withOutcome(Outcome.WIN))).containsExactly(b, a);
        assertThat(ids(mine.withOutcome(Outcome.LOSS))).containsExactly(d);
        assertThat(ids(mine.withColor(Color.WHITE))).containsExactly(c, a);
        assertThat(ids(mine.withOpponent("AN"))).containsExactly(b, a);          // 앞부분 · 대소문자 무시
        assertThat(ids(mine.between(DAY, DAY))).containsExactly(c, b, a);        // 한국 날짜 하루
        assertThat(ids(mine.withOutcome(Outcome.WIN).withColor(Color.BLACK).withOpponent("anna"))).containsExactly(b);
    }

    @Test
    void 더_보기는_빠짐도_겹침도_없다_끝난_시각이_같은_판까지() {
        var me = user("me");
        var rival = user("rival");
        var expected = new ArrayList<UUID>();
        var sameMoment = at(DAY, 15);
        for (int index = 0; index < 7; index++) {
            // 앞의 네 판은 같은 시각에 끝남 → id 로 줄 세움
            var endedAt = index < 4 ? sameMoment : sameMoment.plusMinutes(index);
            expected.add(play(me, rival, Variant.STANDARD, GameResult.DRAW, endedAt));
        }

        var seen = new ArrayList<UUID>();
        var sizes = new ArrayList<Integer>();
        GameCursor cursor = null;
        do {
            var page = repository.search(GameSearch.mine(me), cursor, 3);
            page.games().forEach(game -> seen.add(game.id()));
            sizes.add(page.games().size());
            cursor = page.next();
        } while (cursor != null);

        assertThat(sizes).containsExactly(3, 3, 1);
        assertThat(seen).hasSize(7).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(expected);
    }

    @Test
    void 쪽을_넘기는_사이_새_대국이_끝나도_다음_쪽이_밀리지_않는다() {
        var me = user("me");
        var rival = user("rival");
        for (int index = 0; index < 4; index++) {
            play(me, rival, Variant.STANDARD, GameResult.DRAW, at(DAY, 10 + index));
        }
        var first = repository.search(GameSearch.mine(me), null, 2);

        play(me, rival, Variant.STANDARD, GameResult.DRAW, at(DAY, 20));   // 그사이 새 대국
        var second = repository.search(GameSearch.mine(me), first.next(), 2);

        // OFFSET 2 였다면 첫 쪽 마지막 판이 다시 나왔을 것
        assertThat(second.games()).extracting(GameListItem::id).doesNotContainAnyElementsOf(first.games().stream().map(GameListItem::id).toList());
        assertThat(second.games()).extracting(GameListItem::endedAt).allMatch(endedAt -> endedAt.isBefore(first.games().getLast().endedAt()));
    }

    private List<UUID> ids(GameSearch search) {
        return repository.search(search, null, 50).games().stream().map(GameListItem::id).toList();
    }

    private UUID user(String name) {
        return users.create(name, "hash").orElseThrow().id();
    }

    /** 백은 1500 에서 +10, 흑은 1400 에서 -10 으로 둠(검색만 봄) */
    private UUID play(UUID white, UUID black, Variant variant, GameResult result, OffsetDateTime endedAt) {
        var game = new FinishedGame(UUID.randomUUID(), variant, "5+3", white, black, result, "checkmate", List.of("e2e4"), endedAt.minusMinutes(5), endedAt);
        games.insert(game, new RatedGame(game.id(), 1500, 1400, 10, -10));
        return game.id();
    }

    /** 한국 시각 hour 시 30분 */
    private static OffsetDateTime at(LocalDate day, int hour) {
        return day.atTime(hour, 30).atZone(KOREA).toOffsetDateTime();
    }
}
