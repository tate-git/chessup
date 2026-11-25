package com.chessup.game;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 「더 보기」 시작점: 이 대국 다음(더 오래된 것)부터 · 끝난 시각이 같으면 id 로 줄 세움 */
public record GameCursor(OffsetDateTime endedAt, UUID id) {
}
