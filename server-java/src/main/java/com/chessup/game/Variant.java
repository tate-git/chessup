package com.chessup.game;

import java.util.Locale;

/** 종목: 정통 · 미니(가드너 5×5) */
public enum Variant {
    STANDARD, MINI;

    /** DB·API 에 쓰는 값('standard' · 'mini') */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
