// 로그인 · 회원가입(아이디 + 비밀번호만 — 이메일 등 개인정보 안 받음)
import { api, ApiError } from '../api';
import { t } from '../i18n';
import { session } from '../session';
import { query } from '../ui/dom';
import { navigate, type Screen } from './screen';

export const authScreen: Screen = root => {
  let mode: 'login' | 'signup' = 'login';
  const render = () => {
    const signup = mode === 'signup';
    root.innerHTML = `
      <section class="auth">
        <a href="#/" class="back">← ${t('홈', 'Home')}</a>
        <h1>${signup ? t('회원가입', 'Sign up') : t('로그인', 'Log in')}</h1>
        <form class="card" novalidate>
          <label>${t('아이디', 'Username')}<input name="username" autocomplete="username" required minlength="2" maxlength="16" pattern="[A-Za-z0-9_가-힣]+"></label>
          <label>${t('비밀번호', 'Password')}<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8" maxlength="72"></label>
          ${signup ? `<p class="muted small">${t('아이디 2~16자 · 비밀번호 8자 이상', 'Username 2–16 chars · password 8+ chars')}<br>${t('이메일을 받지 않아 비밀번호는 찾을 수 없어요', 'No email, so passwords can’t be recovered')}</p>` : ''}
          <p class="error" role="alert"></p>
          <button type="submit" class="primary">${signup ? t('가입하기', 'Sign up') : t('로그인', 'Log in')}</button>
        </form>
        <button type="button" class="ghost" data-action="toggle">${signup ? t('로그인', 'Log in') : t('회원가입', 'Sign up')}</button>
      </section>`;
    const form = query<HTMLFormElement>(root, 'form');
    form.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(form);
      const credentials = { username: String(data.get('username')).trim(), password: String(data.get('password')) };
      const submit = query<HTMLButtonElement>(form, 'button[type=submit]');
      submit.disabled = true;
      try {
        session.me = mode === 'signup' ? await api.signup(credentials) : await api.login(credentials);
        navigate('#/');
      } catch (error) {
        query(form, '.error').textContent = error instanceof ApiError ? error.message : t('잠시 뒤 다시 해 주세요', 'Please try again later');
        submit.disabled = false;
      }
    };
    query(root, '[data-action="toggle"]').onclick = () => {
      mode = signup ? 'login' : 'signup';
      render();
    };
  };
  render();
};
