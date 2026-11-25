package com.chessup.game;

import java.util.Arrays;
import java.util.Locale;

/** 종목: 정통 · 미니(가드너 5×5) · DB 칸은 jOOQ 컨버터로 이 타입이 됨(pom.xml forcedTypes) */
public enum Variant {
    STANDARD, MINI;

    /** DB·API 에 쓰는 값('standard' · 'mini') */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static Variant fromCode(String code) {
        return Arrays.stream(values())
                .filter(variant -> variant.code().equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("모르는 종목: " + code));
    }
}
