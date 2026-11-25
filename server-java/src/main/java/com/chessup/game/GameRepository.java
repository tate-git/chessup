package com.chessup.game;

import static com.chessup.db.Tables.GAMES;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** 끝난 사람 대국 표 */
@Repository
public class GameRepository {

    private final DSLContext dsl;

    public GameRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void insert(FinishedGame game, RatedGame rated) {
        dsl.insertInto(GAMES)
                .set(GAMES.ID, game.id())
                .set(GAMES.VARIANT, game.variant())
                .set(GAMES.TIME_CONTROL, game.timeControl())
                .set(GAMES.WHITE_ID, game.whiteId())
                .set(GAMES.BLACK_ID, game.blackId())
                .set(GAMES.RESULT, game.result())
                .set(GAMES.REASON, game.reason())
                .set(GAMES.MOVES, String.join(" ", game.moves()))
                .set(GAMES.WHITE_RATING, rated.whiteRating())
                .set(GAMES.BLACK_RATING, rated.blackRating())
                .set(GAMES.WHITE_CHANGE, rated.whiteChange())
                .set(GAMES.BLACK_CHANGE, rated.blackChange())
                .set(GAMES.STARTED_AT, game.startedAt())
                .set(GAMES.ENDED_AT, game.endedAt())
                .execute();
    }
}
