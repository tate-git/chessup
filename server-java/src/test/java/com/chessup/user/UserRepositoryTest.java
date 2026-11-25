package com.chessup.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.chessup.TestDatabase;

@SpringBootTest
@Import(TestDatabase.class)
class UserRepositoryTest {

    @Autowired
    private UserRepository users;

    @Test
    void 가입하면_아이디로_찾을_수_있고_대소문자는_무시한다() {
        var created = users.create("Magnus", "hash").orElseThrow();

        assertThat(users.findByUsername("magnus")).contains(created);
        assertThat(users.findPasswordHash("MAGNUS")).contains("hash");
    }

    @Test
    void 같은_아이디는_대소문자가_달라도_다시_만들지_않는다() {
        users.create("Hikaru", "hash");

        assertThat(users.create("hikaru", "other")).isEmpty();
    }

    @Test
    void 없는_아이디는_빈_값() {
        assertThat(users.findByUsername("nobody")).isEmpty();
    }
}
