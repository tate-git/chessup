package com.chessup.leaderboard;

import static com.chessup.db.Tables.RATINGS;
import static com.chessup.db.Tables.USERS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.floor;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.orderBy;
import static org.jooq.impl.DSL.rank;
import static org.jooq.impl.DSL.row;
import static org.jooq.impl.DSL.rowNumber;
import static org.jooq.impl.DSL.select;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jooq.CommonTableExpression;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record1;
import org.jooq.Record3;
import org.jooq.Record7;
import org.jooq.SelectField;
import org.springframework.stereotype.Repository;

import com.chessup.game.Variant;

/** 랭킹(종목별 · 10판 이상 둔 사람만) — 순위는 윈도 함수로 DB 가 매김 */
@Repository
public class LeaderboardRepository {

    public static final int MIN_GAMES = 10;
    /** 내 순위 앞뒤로 몇 명 */
    public static final int RADIUS = 5;

    /** 표시 레이팅: Java Math.round 와 같게 0.5 는 올림(PostgreSQL 실수 round 는 짝수 쪽이라 1700.5 → 1700) */
    private static final Field<Integer> SHOWN = floor(RATINGS.RATING.plus(0.5)).cast(Integer.class);
    private static final Field<Integer> RATING = SHOWN.as("rating");
    private static final Field<Integer> RANK = rank().over(orderBy(SHOWN.desc())).as("rank");
    /** 같은 순위 안에서도 줄 세우기(앞뒤 몇 명을 자를 때 씀) */
    private static final Field<Integer> POSITION = rowNumber().over(orderBy(SHOWN.desc(), USERS.USERNAME_KEY)).as("position");
    private static final Field<Integer> PLAYERS = count().over().as("players");

    private final DSLContext dsl;

    public LeaderboardRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<LeaderboardEntry> top(Variant variant, int limit) {
        var ranked = ranked(variant);
        return dsl.with(ranked)
                .select(entryOf(ranked))
                .from(ranked)
                .orderBy(ranked.field(POSITION))
                .limit(limit)
                .fetch(Record1::value1);
    }

    /** 랭킹에 없으면(10판 미만) 빈 값 */
    public Optional<Standing> standing(UUID userId, Variant variant) {
        var ranked = ranked(variant);
        var position = ranked.field(POSITION);
        var mine = field(select(position).from(ranked).where(ranked.field(RATINGS.USER_ID).eq(userId)));

        var rows = dsl.with(ranked)
                .select(entryOf(ranked), ranked.field(RATINGS.USER_ID), ranked.field(PLAYERS))
                .from(ranked)
                .where(position.between(mine.minus(RADIUS), mine.plus(RADIUS)))
                .orderBy(position)
                .fetch();
        return rows.stream()
                .filter(row -> row.value2().equals(userId))
                .findFirst()
                .map(me -> new Standing(me.value1().rank(), me.value3(), rows.map(Record3::value1)));
    }

    /** WITH ranked AS (…): 이름·표시 레이팅·판 수·순위·줄 번호·전체 인원 */
    private static CommonTableExpression<Record7<UUID, String, Integer, Integer, Integer, Integer, Integer>> ranked(Variant variant) {
        return name("ranked").as(
                select(RATINGS.USER_ID, USERS.USERNAME, RATING, RATINGS.GAMES, RANK, POSITION, PLAYERS)
                        .from(RATINGS)
                        .join(USERS).on(USERS.ID.eq(RATINGS.USER_ID))
                        .where(RATINGS.VARIANT.eq(variant))
                        .and(RATINGS.GAMES.ge(MIN_GAMES)));
    }

    private static SelectField<LeaderboardEntry> entryOf(CommonTableExpression<?> ranked) {
        return row(ranked.field(RANK), ranked.field(USERS.USERNAME), ranked.field(RATING), ranked.field(RATINGS.GAMES)).mapping(LeaderboardEntry::new);
    }
}
