package com.chessup.game;

import java.time.LocalDate;
import java.util.UUID;

/**
 * 내 대국 검색 조건 · null 인 조건은 쓰지 않음.
 * opponent 는 아이디 앞부분(대소문자 무시) · from·to 는 한국 날짜(양 끝 포함).
 */
public record GameSearch(UUID userId, Variant variant, Outcome outcome, Color color, String opponent, LocalDate from, LocalDate to) {

    public static GameSearch mine(UUID userId) {
        return new GameSearch(userId, null, null, null, null, null, null);
    }

    public GameSearch withVariant(Variant value) {
        return new GameSearch(userId, value, outcome, color, opponent, from, to);
    }

    public GameSearch withOutcome(Outcome value) {
        return new GameSearch(userId, variant, value, color, opponent, from, to);
    }

    public GameSearch withColor(Color value) {
        return new GameSearch(userId, variant, outcome, value, opponent, from, to);
    }

    public GameSearch withOpponent(String value) {
        return new GameSearch(userId, variant, outcome, color, value, from, to);
    }

    public GameSearch between(LocalDate fromDay, LocalDate toDay) {
        return new GameSearch(userId, variant, outcome, color, opponent, fromDay, toDay);
    }
}
