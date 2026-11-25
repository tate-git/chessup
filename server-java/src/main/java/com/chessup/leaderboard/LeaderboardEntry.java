package com.chessup.leaderboard;

/** 랭킹 한 줄 · 표시 레이팅이 같으면 순위도 같음(1, 2, 2, 4 …) */
public record LeaderboardEntry(int rank, String username, int rating, int games) {
}
