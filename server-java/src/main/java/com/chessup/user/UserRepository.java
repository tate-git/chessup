package com.chessup.user;

import static com.chessup.db.Tables.USERS;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** 회원 표 · 아이디는 대소문자 무시(username_key = 소문자) */
@Repository
public class UserRepository {

    private final DSLContext dsl;

    public UserRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** 만들었으면 회원, 같은 아이디가 있으면 빈 값 */
    public Optional<User> create(String username, String passwordHash) {
        return dsl.insertInto(USERS)
                .set(USERS.ID, UUID.randomUUID())
                .set(USERS.USERNAME, username)
                .set(USERS.USERNAME_KEY, keyOf(username))
                .set(USERS.PASSWORD_HASH, passwordHash)
                .set(USERS.CREATED_AT, OffsetDateTime.now())
                .onConflict(USERS.USERNAME_KEY).doNothing()
                .returning(USERS.ID, USERS.USERNAME, USERS.CREATED_AT)
                .fetchOptional(record -> new User(record.get(USERS.ID), record.get(USERS.USERNAME), record.get(USERS.CREATED_AT)));
    }

    public Optional<User> findByUsername(String username) {
        return dsl.select(USERS.ID, USERS.USERNAME, USERS.CREATED_AT)
                .from(USERS)
                .where(USERS.USERNAME_KEY.eq(keyOf(username)))
                .fetchOptional(record -> record.into(User.class));
    }

    /** 로그인 확인용 비밀번호 해시 */
    public Optional<String> findPasswordHash(String username) {
        return dsl.select(USERS.PASSWORD_HASH)
                .from(USERS)
                .where(USERS.USERNAME_KEY.eq(keyOf(username)))
                .fetchOptional(USERS.PASSWORD_HASH);
    }

    private static String keyOf(String username) {
        return username.toLowerCase(Locale.ROOT);
    }
}
