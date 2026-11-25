package com.chessup.game;

import static com.chessup.db.Tables.GAMES;
import static com.chessup.db.Tables.USERS;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.noCondition;
import static org.jooq.impl.DSL.not;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.function.Function;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.ResultQuery;
import org.springframework.stereotype.Repository;

import com.chessup.db.tables.Users;

/** 내 대국 검색: 주어진 조건만 붙이는 동적 쿼리 · 키셋 페이징(seek) */
@Repository
public class GameSearchRepository {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    /** 상대 회원(users 를 한 번 더 쓰니 별칭) */
    private static final Users OPPONENT = USERS.as("opponent");

    private final DSLContext dsl;

    public GameSearchRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 최근에 끝난 순 · after 가 있으면 그 다음부터 */
    public GamePage search(GameSearch search, GameCursor after, int size) {
        var me = new Perspective(search.userId());
        var asWhite = field(me.asWhite());
        var ordered = dsl.select(GAMES.ID, GAMES.VARIANT, GAMES.TIME_CONTROL, OPPONENT.USERNAME, asWhite, GAMES.RESULT, me.ratingBefore(), me.ratingChange(), GAMES.ENDED_AT)
                .from(GAMES)
                .join(OPPONENT).on(OPPONENT.ID.eq(me.opponentId()))
                .where(me.played())
                .and(filters(me, search))
                .orderBy(GAMES.ENDED_AT.desc(), GAMES.ID.desc());
        // 한 줄 더 읽어서 다음 쪽이 있는지 앎 · seek 는 (ended_at, id) < (?, ?) 로 렌더링됨
        ResultQuery<? extends Record> page = after == null
                ? ordered.limit(size + 1)
                : ordered.seek(after.endedAt(), after.id()).limit(size + 1);

        var items = page.fetch(record -> new GameListItem(
                record.get(GAMES.ID),
                record.get(GAMES.VARIANT),
                record.get(GAMES.TIME_CONTROL),
                record.get(OPPONENT.USERNAME),
                record.get(asWhite) ? Color.WHITE : Color.BLACK,
                Outcome.of(record.get(GAMES.RESULT), record.get(asWhite)),
                record.get(me.ratingBefore()),
                record.get(me.ratingChange()),
                record.get(GAMES.ENDED_AT)));
        if (items.size() <= size) {
            return new GamePage(items, null);
        }
        var shown = items.subList(0, size);
        var last = shown.getLast();
        return new GamePage(shown, new GameCursor(last.endedAt(), last.id()));
    }

    /** 조건마다 값이 있을 때만 붙고, 없으면 noCondition() 이라 SQL 에서 사라짐 */
    private static Condition filters(Perspective me, GameSearch search) {
        return ifGiven(search.variant(), GAMES.VARIANT::eq)
                .and(ifGiven(search.outcome(), outcome -> switch (outcome) {
                    case WIN -> me.won();
                    case DRAW -> me.drew();
                    case LOSS -> me.lost();
                }))
                .and(ifGiven(search.color(), color -> color == Color.WHITE ? me.asWhite() : not(me.asWhite())))
                .and(ifGiven(search.opponent(), name -> OPPONENT.USERNAME_KEY.startsWith(name.toLowerCase(Locale.ROOT))))
                .and(ifGiven(search.from(), day -> GAMES.ENDED_AT.ge(startOf(day))))
                .and(ifGiven(search.to(), day -> GAMES.ENDED_AT.lt(startOf(day.plusDays(1)))));
    }

    private static <T> Condition ifGiven(T value, Function<T, Condition> condition) {
        return value == null ? noCondition() : condition.apply(value);
    }

    /** 한국 날짜의 0시(시각 칸 그대로 비교해서 ended_at 색인을 씀) */
    private static OffsetDateTime startOf(LocalDate day) {
        return day.atStartOfDay(KOREA).toOffsetDateTime();
    }
}
