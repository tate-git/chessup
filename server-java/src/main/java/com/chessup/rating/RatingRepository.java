package com.chessup.rating;

import static com.chessup.db.Tables.RATINGS;
import static org.jooq.impl.DSL.row;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.jooq.DSLContext;
import org.jooq.Record2;
import org.jooq.SelectField;
import org.springframework.stereotype.Repository;

import com.chessup.game.Variant;

/** 종목별 레이팅 표 */
@Repository
public class RatingRepository {

    private static final SelectField<PlayerRating> PLAYER_RATING = row(
            row(RATINGS.RATING, RATINGS.DEVIATION, RATINGS.VOLATILITY).mapping(GlickoRating::new),
            RATINGS.GAMES, RATINGS.WINS, RATINGS.LOSSES, RATINGS.DRAWS).mapping(PlayerRating::new);

    private final DSLContext dsl;

    public RatingRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /**
     * 트랜잭션 안에서 부름: 행이 없으면 처음 값으로 만든 뒤, 아이디 순서로 잠그고 읽음.
     * 처음 두는 사람은 잠글 행이 없어서 먼저 만들어 둠 · 순서를 정해 두 대국이 서로 기다리는 교착을 막음.
     */
    public Map<UUID, PlayerRating> lockForUpdate(Collection<UUID> userIds, Variant variant) {
        var now = OffsetDateTime.now();
        dsl.insertInto(RATINGS, RATINGS.USER_ID, RATINGS.VARIANT, RATINGS.UPDATED_AT)
                .valuesOfRows(userIds.stream().map(userId -> row(userId, variant, now)).toList())
                .onConflictDoNothing()
                .execute();

        return dsl.select(RATINGS.USER_ID, PLAYER_RATING)
                .from(RATINGS)
                .where(RATINGS.USER_ID.in(userIds))
                .and(RATINGS.VARIANT.eq(variant))
                .orderBy(RATINGS.USER_ID)
                .forUpdate()
                .fetch()
                .stream()
                .collect(Collectors.toMap(Record2::value1, Record2::value2));
    }

    public void save(UUID userId, Variant variant, PlayerRating rating) {
        dsl.update(RATINGS)
                .set(RATINGS.RATING, rating.glicko().rating())
                .set(RATINGS.DEVIATION, rating.glicko().deviation())
                .set(RATINGS.VOLATILITY, rating.glicko().volatility())
                .set(RATINGS.GAMES, rating.games())
                .set(RATINGS.WINS, rating.wins())
                .set(RATINGS.LOSSES, rating.losses())
                .set(RATINGS.DRAWS, rating.draws())
                .set(RATINGS.UPDATED_AT, OffsetDateTime.now())
                .where(RATINGS.USER_ID.eq(userId))
                .and(RATINGS.VARIANT.eq(variant))
                .execute();
    }
}
