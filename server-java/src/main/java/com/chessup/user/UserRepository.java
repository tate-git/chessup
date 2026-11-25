package com.chessup.user;

import static com.chessup.db.Tables.USERS;
import static org.jooq.Records.mapping;
import static org.jooq.impl.DSL.row;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.jooq.DSLContext;
import org.jooq.Record1;
import org.jooq.SelectField;
import org.springframework.stereotype.Repository;

/** 회원 표 · 아이디는 대소문자 무시(username_key = 소문자) */
@Repository
public class UserRepository {

    /** 세 칸을 User 로 바로 담는 칸(순서·타입이 User 생성자와 다르면 컴파일 오류) */
    private static final SelectField<User> USER = row(USERS.ID, USERS.USERNAME, USERS.CREATED_AT).mapping(User::new);

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
                .returningResult(USER)
                .fetchOptional(Record1::value1);
    }

    public Optional<User> findByUsername(String username) {
        return dsl.select(USER)
                .from(USERS)
                .where(USERS.USERNAME_KEY.eq(keyOf(username)))
                .fetchOptional(Record1::value1);
    }

    public Optional<Login> findLogin(String username) {
        return dsl.select(USER, USERS.PASSWORD_HASH)
                .from(USERS)
                .where(USERS.USERNAME_KEY.eq(keyOf(username)))
                .fetchOptional(mapping(Login::new));
    }

    private static String keyOf(String username) {
        return username.toLowerCase(Locale.ROOT);
    }
}
