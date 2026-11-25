package com.chessup.game;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chessup.rating.RatingRepository;

/** 대국 끝: 레이팅 계산 · 대국 기록과 두 사람 레이팅을 한 트랜잭션으로 저장 */
@Service
public class GameService {

    private final RatingRepository ratings;
    private final GameRepository games;

    public GameService(RatingRepository ratings, GameRepository games) {
        this.ratings = ratings;
        this.games = games;
    }

    @Transactional
    public RatedGame finish(FinishedGame game) {
        var locked = ratings.lockForUpdate(List.of(game.whiteId(), game.blackId()), game.variant());
        var white = locked.get(game.whiteId());
        var black = locked.get(game.blackId());
        var whiteAfter = white.after(black, game.result().whiteScore());
        var blackAfter = black.after(white, game.result().blackScore());

        var rated = new RatedGame(game.id(), white.shown(), black.shown(), whiteAfter.shown() - white.shown(), blackAfter.shown() - black.shown());
        ratings.save(game.whiteId(), game.variant(), whiteAfter);
        ratings.save(game.blackId(), game.variant(), blackAfter);
        games.insert(game, rated);
        return rated;
    }
}
