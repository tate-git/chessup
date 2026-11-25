package com.chessup.practice;

import static com.chessup.db.Tables.HINT_USES;
import static com.chessup.db.Tables.PRACTICE_CLEARS;
import static com.chessup.db.Tables.USERS;
import static org.jooq.impl.DSL.excluded;
import static org.jooq.impl.DSL.greatest;
import static org.jooq.impl.DSL.row;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.jooq.DSLContext;
import org.jooq.Record2;
import org.springframework.stereotype.Repository;

import com.chessup.game.Variant;

/** 봇 격파 기록 · 힌트 쓴 기록 */
@Repository
public class PracticeRepository {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

    private final DSLContext dsl;

    public PracticeRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 기록이 있는 종목만 · 없는 종목은 부르는 쪽에서 ClearLevels.NONE */
    public Map<Variant, ClearLevels> clears(UUID userId) {
        return dsl.select(PRACTICE_CLEARS.VARIANT, row(PRACTICE_CLEARS.LEVEL, PRACTICE_CLEARS.UNASSISTED_LEVEL).mapping(ClearLevels::new))
                .from(PRACTICE_CLEARS)
                .where(PRACTICE_CLEARS.USER_ID.eq(userId))
                .fetch()
                .stream()
                .collect(Collectors.toMap(Record2::value1, Record2::value2));
    }

    /** 최고 단계만 남김: INSERT … ON CONFLICT DO UPDATE SET level = greatest(level, excluded.level) · 도움 받았으면 「도움 없이」 쪽은 0 으로 넣어 그대로 둠 */
    public void saveClear(UUID userId, Variant variant, int level, boolean assisted) {
        dsl.insertInto(PRACTICE_CLEARS)
                .set(PRACTICE_CLEARS.USER_ID, userId)
                .set(PRACTICE_CLEARS.VARIANT, variant)
                .set(PRACTICE_CLEARS.LEVEL, level)
                .set(PRACTICE_CLEARS.UNASSISTED_LEVEL, assisted ? 0 : level)
                .onConflict(PRACTICE_CLEARS.USER_ID, PRACTICE_CLEARS.VARIANT)
                .doUpdate()
                .set(PRACTICE_CLEARS.LEVEL, greatest(PRACTICE_CLEARS.LEVEL, excluded(PRACTICE_CLEARS.LEVEL)))
                .set(PRACTICE_CLEARS.UNASSISTED_LEVEL, greatest(PRACTICE_CLEARS.UNASSISTED_LEVEL, excluded(PRACTICE_CLEARS.UNASSISTED_LEVEL)))
                .execute();
    }

    /** 트랜잭션 안에서 부름: 회원 행을 잠가 같은 사람의 힌트 요청을 한 줄로 세움 */
    public void lockUser(UUID userId) {
        dsl.selectOne().from(USERS).where(USERS.ID.eq(userId)).forUpdate().execute();
    }

    public int countHints(UUID userId, String practiceGameId) {
        return dsl.fetchCount(HINT_USES, HINT_USES.USER_ID.eq(userId).and(HINT_USES.PRACTICE_GAME_ID.eq(practiceGameId)));
    }

    public void recordHint(UUID userId, String practiceGameId) {
        var now = OffsetDateTime.now(KOREA);
        dsl.insertInto(HINT_USES)
                .set(HINT_USES.USER_ID, userId)
                .set(HINT_USES.DAY, LocalDate.from(now))
                .set(HINT_USES.PRACTICE_GAME_ID, practiceGameId)
                .set(HINT_USES.USED_AT, now)
                .execute();
    }
}
