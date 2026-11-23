// 시작: 로그인 상태 확인 → 주소(#/…)에 맞는 화면
import { lang } from './i18n';
import { authScreen } from './screens/auth';
import { homeScreen } from './screens/home';
import { leaderboardScreen } from './screens/leaderboard';
import { liveScreen } from './screens/live-screen';
import { practiceScreen } from './screens/practice-screen';
import type { Cleanup, Screen } from './screens/screen';
import { session } from './session';

const app = document.querySelector<HTMLElement>('#app')!;
let cleanup: Cleanup | void;

function route(hash: string): Screen {
  const [, page, param] = hash.replace(/^#/, '').split('/');
  switch (page) {
    case 'login': return authScreen;
    case 'leaderboard': return leaderboardScreen;
    case 'practice': return practiceScreen(Math.min(10, Math.max(1, Number(param) || 1)));
    case 'live': return param ? liveScreen(param) : homeScreen;
    default: return homeScreen;
  }
}

async function show(): Promise<void> {
  cleanup?.();
  app.onclick = null;
  cleanup = await route(location.hash)(app);
}

document.documentElement.lang = lang;
window.addEventListener('hashchange', () => void show());
await session.refresh().catch(() => null);
await show();
