package com.chessup.game;

/** 내 쪽에서 본 결과 */
public enum Outcome {
    WIN, DRAW, LOSS;

    public static Outcome of(GameResult result, boolean asWhite) {
        if (result == GameResult.DRAW) {
            return DRAW;
        }
        return (result == GameResult.WHITE_WINS) == asWhite ? WIN : LOSS;
    }
}
