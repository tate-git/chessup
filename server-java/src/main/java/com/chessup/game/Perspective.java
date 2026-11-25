package com.chessup.game;

import static com.chessup.db.Tables.GAMES;
import static org.jooq.impl.DSL.not;
import static org.jooq.impl.DSL.or;
import static org.jooq.impl.DSL.when;

import java.util.UUID;

import org.jooq.Condition;
import org.jooq.Field;

/** 대국 표를 「나」 쪽에서 본 칸·조건(통계·검색이 함께 씀) */
public record Perspective(UUID userId) {

    public Condition asWhite() {
        return GAMES.WHITE_ID.eq(userId);
    }

    public Condition played() {
        return or(GAMES.WHITE_ID.eq(userId), GAMES.BLACK_ID.eq(userId));
    }

    public Field<UUID> opponentId() {
        return when(asWhite(), GAMES.BLACK_ID).otherwise(GAMES.WHITE_ID);
    }

    public Condition won() {
        return asWhite().and(GAMES.RESULT.eq(GameResult.WHITE_WINS))
                .or(not(asWhite()).and(GAMES.RESULT.eq(GameResult.BLACK_WINS)));
    }

    public Condition drew() {
        return GAMES.RESULT.eq(GameResult.DRAW);
    }

    public Condition lost() {
        return not(won()).and(not(drew()));
    }

    /** 두는 시점 내 레이팅 */
    public Field<Integer> ratingBefore() {
        return when(asWhite(), GAMES.WHITE_RATING).otherwise(GAMES.BLACK_RATING);
    }

    public Field<Integer> ratingChange() {
        return when(asWhite(), GAMES.WHITE_CHANGE).otherwise(GAMES.BLACK_CHANGE);
    }

    public Field<Integer> ratingAfter() {
        return ratingBefore().plus(ratingChange());
    }
}
