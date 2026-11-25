package com.chessup.game;

import java.util.UUID;

/** 저장된 대국: 두는 시점 레이팅(반올림)과 바뀐 폭 */
public record RatedGame(UUID id, int whiteRating, int blackRating, int whiteChange, int blackChange) {
}
