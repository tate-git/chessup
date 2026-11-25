package com.chessup.user;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 회원(비밀번호 해시는 밖으로 내보내지 않음) */
public record User(UUID id, String username, OffsetDateTime createdAt) {
}
