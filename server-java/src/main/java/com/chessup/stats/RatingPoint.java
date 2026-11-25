package com.chessup.stats;

import java.time.LocalDate;

/** 그날(한국 날짜) 마지막 대국 뒤 레이팅 */
public record RatingPoint(LocalDate day, int rating) {
}
