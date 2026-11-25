package com.chessup.practice;

import java.util.Map;
import java.util.OptionalInt;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chessup.game.Variant;

/** 봇 연습: 격파 기록 · 힌트(누구나 한 판 3번, 무르기는 화면에서만 셈) */
@Service
public class PracticeService {

    public static final int HINTS_PER_GAME = 3;

    private final PracticeRepository practice;

    public PracticeService(PracticeRepository practice) {
        this.practice = practice;
    }

    /** 두 종목 모두(기록 없으면 0) */
    public Map<Variant, ClearLevels> progress(UUID userId) {
        var clears = practice.clears(userId);
        return Map.of(
                Variant.STANDARD, clears.getOrDefault(Variant.STANDARD, ClearLevels.NONE),
                Variant.MINI, clears.getOrDefault(Variant.MINI, ClearLevels.NONE));
    }

    @Transactional
    public Map<Variant, ClearLevels> recordClear(UUID userId, Variant variant, int level, boolean assisted) {
        practice.saveClear(userId, variant, level, assisted);
        return progress(userId);
    }

    /** 썼으면 이 판에 남은 수, 다 썼으면 빈 값 · 잠금으로 동시에 눌러도 3번을 넘지 않음 */
    @Transactional
    public OptionalInt useHint(UUID userId, String practiceGameId) {
        practice.lockUser(userId);
        int used = practice.countHints(userId, practiceGameId);
        if (used >= HINTS_PER_GAME) {
            return OptionalInt.empty();
        }
        practice.recordHint(userId, practiceGameId);
        return OptionalInt.of(HINTS_PER_GAME - used - 1);
    }
}
