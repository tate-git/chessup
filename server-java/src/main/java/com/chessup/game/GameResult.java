package com.chessup.game;

import java.util.Arrays;

/** 대국 결과와 백 기준 점수 · DB 칸은 jOOQ 컨버터로 이 타입이 됨(pom.xml forcedTypes) */
public enum GameResult {
    WHITE_WINS("1-0", 1),
    BLACK_WINS("0-1", 0),
    DRAW("1/2-1/2", 0.5);

    private final String code;
    private final double whiteScore;

    GameResult(String code, double whiteScore) {
        this.code = code;
        this.whiteScore = whiteScore;
    }

    public String code() {
        return code;
    }

    public double whiteScore() {
        return whiteScore;
    }

    public double blackScore() {
        return 1 - whiteScore;
    }

    public static GameResult fromCode(String code) {
        return Arrays.stream(values())
                .filter(result -> result.code.equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("모르는 결과: " + code));
    }
}
