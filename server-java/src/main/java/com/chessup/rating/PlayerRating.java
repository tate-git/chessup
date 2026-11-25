package com.chessup.rating;

import java.util.List;

/** 종목 하나의 레이팅과 전적 */
public record PlayerRating(GlickoRating glicko, int games, int wins, int losses, int draws) {

    /** 대국 하나를 반영한 다음 값(점수 1 = 이김 · 0.5 = 비김 · 0 = 짐) */
    public PlayerRating after(PlayerRating opponent, double score) {
        return new PlayerRating(
                Glicko2.update(glicko, List.of(new GlickoResult(opponent.glicko, score))),
                games + 1,
                wins + (score == 1 ? 1 : 0),
                losses + (score == 0 ? 1 : 0),
                draws + (score == 0.5 ? 1 : 0));
    }

    /** 화면에 보이는 정수 레이팅 */
    public int shown() {
        return (int) Math.round(glicko.rating());
    }
}
