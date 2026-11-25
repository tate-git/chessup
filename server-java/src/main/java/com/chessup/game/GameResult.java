package com.chessup.game;

/** 대국 결과와 백 기준 점수 */
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
}
