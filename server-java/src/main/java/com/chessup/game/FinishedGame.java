package com.chessup.game;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** 레이팅에 반영할 끝난 대국(취소된 판은 오지 않음) · reason 은 docs/api.yaml 의 EndReason */
public record FinishedGame(
        UUID id,
        Variant variant,
        String timeControl,
        UUID whiteId,
        UUID blackId,
        GameResult result,
        String reason,
        List<String> moves,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt) {
}
