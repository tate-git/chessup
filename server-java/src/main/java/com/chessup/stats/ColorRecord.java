package com.chessup.stats;

/** 백으로 둔 판 · 흑으로 둔 판 전적 */
public record ColorRecord(Tally white, Tally black) {
}
