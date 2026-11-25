package com.chessup.stats;

import static com.chessup.db.Tables.GAMES;
import static com.chessup.db.Tables.USERS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.noCondition;
import static org.jooq.impl.DSL.not;
import static org.jooq.impl.DSL.or;
import static org.jooq.impl.DSL.row;
import static org.jooq.impl.DSL.when;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record1;
import org.jooq.SelectField;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Repository;

import com.chessup.game.GameResult;
import com.chessup.game.Variant;

/** 내 전적 통계: 상대별 · 백/흑 · 날마다 레이팅 — 모두 「나」 기준으로 대국 표를 읽음 */
@Repository
public class StatsRepository {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

    private final DSLContext dsl;

    public StatsRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 많이 둔 상대 순 */
    public List<OpponentRecord> byOpponent(UUID userId, Variant variant, int limit) {
        var me = new Perspective(userId);
        return dsl.select(row(USERS.USERNAME, me.tally()).mapping(OpponentRecord::new))
                .from(GAMES)
                .join(USERS).on(USERS.ID.eq(me.opponentId()))
                .where(me.played(variant))
                .groupBy(me.opponentId(), USERS.USERNAME)
                .orderBy(count().desc(), USERS.USERNAME)
                .limit(limit)
                .fetch(Record1::value1);
    }

    public ColorRecord byColor(UUID userId, Variant variant) {
        var me = new Perspective(userId);
        return dsl.select(me.tally(GAMES.WHITE_ID.eq(userId)), me.tally(GAMES.BLACK_ID.eq(userId)))
                .from(GAMES)
                .where(me.played(variant))
                .fetchSingle(record -> new ColorRecord(record.value1(), record.value2()));
    }

    /** 최근 days 일 동안 둔 날마다 그날 마지막 레이팅(DISTINCT ON) */
    public List<RatingPoint> ratingHistory(UUID userId, Variant variant, int days) {
        var me = new Perspective(userId);
        // jOOQ 에 「시간대 바꿔 날짜로」 함수가 없어 SQL 조각으로 씀({0} 자리에 칸이 들어감 · 타입은 지정한 LocalDate)
        Field<LocalDate> day = field("cast({0} at time zone 'Asia/Seoul' as date)", SQLDataType.LOCALDATE, GAMES.ENDED_AT);
        var since = OffsetDateTime.now(KOREA).toLocalDate().minusDays(days - 1L).atStartOfDay(KOREA).toOffsetDateTime();
        return dsl.selectDistinct(row(day, me.ratingAfter()).mapping(RatingPoint::new))
                .on(day)
                .from(GAMES)
                .where(me.played(variant))
                .and(GAMES.ENDED_AT.ge(since))
                .orderBy(day, GAMES.ENDED_AT.desc())
                .fetch(Record1::value1);
    }

    /** 「나」 쪽에서 본 대국 칸·조건 */
    private record Perspective(UUID userId) {

        Condition asWhite() {
            return GAMES.WHITE_ID.eq(userId);
        }

        Condition played(Variant variant) {
            return or(GAMES.WHITE_ID.eq(userId), GAMES.BLACK_ID.eq(userId)).and(GAMES.VARIANT.eq(variant));
        }

        Field<UUID> opponentId() {
            return when(asWhite(), GAMES.BLACK_ID).otherwise(GAMES.WHITE_ID);
        }

        Condition won() {
            return asWhite().and(GAMES.RESULT.eq(GameResult.WHITE_WINS))
                    .or(not(asWhite()).and(GAMES.RESULT.eq(GameResult.BLACK_WINS)));
        }

        Condition drew() {
            return GAMES.RESULT.eq(GameResult.DRAW);
        }

        Field<Integer> ratingAfter() {
            return when(asWhite(), GAMES.WHITE_RATING.plus(GAMES.WHITE_CHANGE)).otherwise(GAMES.BLACK_RATING.plus(GAMES.BLACK_CHANGE));
        }

        SelectField<Tally> tally() {
            return tally(noCondition());
        }

        /** scope 에 맞는 판만 세기: count(*) FILTER (WHERE …) */
        SelectField<Tally> tally(Condition scope) {
            return row(
                    count().filterWhere(scope),
                    count().filterWhere(scope.and(won())),
                    count().filterWhere(scope.and(drew())),
                    count().filterWhere(scope.and(not(won())).and(not(drew()))))
                    .mapping(Tally::new);
        }
    }
}
