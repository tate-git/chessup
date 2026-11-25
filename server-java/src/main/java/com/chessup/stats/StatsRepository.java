package com.chessup.stats;

import static com.chessup.db.Tables.GAMES;
import static com.chessup.db.Tables.USERS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.noCondition;
import static org.jooq.impl.DSL.not;
import static org.jooq.impl.DSL.row;

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

import com.chessup.game.Perspective;
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
        return dsl.select(row(USERS.USERNAME, tally(me, noCondition())).mapping(OpponentRecord::new))
                .from(GAMES)
                .join(USERS).on(USERS.ID.eq(me.opponentId()))
                .where(me.played().and(GAMES.VARIANT.eq(variant)))
                .groupBy(me.opponentId(), USERS.USERNAME)
                .orderBy(count().desc(), USERS.USERNAME)
                .limit(limit)
                .fetch(Record1::value1);
    }

    public ColorRecord byColor(UUID userId, Variant variant) {
        var me = new Perspective(userId);
        return dsl.select(tally(me, me.asWhite()), tally(me, not(me.asWhite())))
                .from(GAMES)
                .where(me.played().and(GAMES.VARIANT.eq(variant)))
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
                .where(me.played().and(GAMES.VARIANT.eq(variant)))
                .and(GAMES.ENDED_AT.ge(since))
                .orderBy(day, GAMES.ENDED_AT.desc())
                .fetch(Record1::value1);
    }

    /** scope 에 맞는 판만 세기: count(*) FILTER (WHERE …) · 조건이 없으면 noCondition() 이라 FILTER 도 빠짐 */
    private static SelectField<Tally> tally(Perspective me, Condition scope) {
        return row(
                count().filterWhere(scope),
                count().filterWhere(scope.and(me.won())),
                count().filterWhere(scope.and(me.drew())),
                count().filterWhere(scope.and(me.lost())))
                .mapping(Tally::new);
    }
}
