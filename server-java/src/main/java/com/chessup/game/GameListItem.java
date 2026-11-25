package com.chessup.game;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 내 대국 목록 한 줄 */
public record GameListItem(
        UUID id,
        Variant variant,
        String timeControl,
        String opponent,
        Color color,
        Outcome outcome,
        int rating,
        int ratingChange,
        OffsetDateTime endedAt) {
}
