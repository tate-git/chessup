package com.chessup.leaderboard;

import java.util.List;

/** 내 순위: 앞뒤 사람들(나 포함) · 랭킹에 오른 전체 인원 */
public record Standing(int rank, int players, List<LeaderboardEntry> nearby) {
}
