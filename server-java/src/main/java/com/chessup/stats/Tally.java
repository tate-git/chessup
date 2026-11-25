package com.chessup.stats;

/** 승·무·패 묶음 */
public record Tally(int games, int wins, int draws, int losses) {

    /** 승률(비김은 반 승) · 판이 없으면 0 */
    public double score() {
        return games == 0 ? 0 : (wins + draws * 0.5) / games;
    }
}
