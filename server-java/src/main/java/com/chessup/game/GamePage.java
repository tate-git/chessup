package com.chessup.game;

import java.util.List;

/** 한 쪽 분량 · next 가 null 이면 마지막 쪽 */
public record GamePage(List<GameListItem> games, GameCursor next) {
}
