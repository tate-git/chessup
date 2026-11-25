package com.chessup.user;

/** 로그인 확인에 필요한 회원과 비밀번호 해시(한 번에 조회) */
public record Login(User user, String passwordHash) {
}
