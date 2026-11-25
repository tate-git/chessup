package com.chessup.practice;

/** 종목 하나의 봇 격파: 깬 최고 단계 · 힌트·무르기 없이 깬 최고 단계 */
public record ClearLevels(int cleared, int unassisted) {

    public static final ClearLevels NONE = new ClearLevels(0, 0);
}
