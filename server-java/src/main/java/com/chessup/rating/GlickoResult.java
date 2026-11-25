package com.chessup.rating;

/** 대국 하나의 상대와 점수(1 = 이김 · 0.5 = 비김 · 0 = 짐) */
public record GlickoResult(GlickoRating opponent, double score) {
}
