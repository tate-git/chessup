// 글자(한/영) · 언어는 주소 ?lang= → 저장값 → 브라우저 순
import { storage } from './storage';

export type Lang = 'ko' | 'en';

const fromQuery = new URLSearchParams(location.search).get('lang');
const isLang = (value: unknown): value is Lang => value === 'ko' || value === 'en';

export let lang: Lang = [fromQuery, storage.get('lang')].find(isLang) ?? (navigator.language.startsWith('ko') ? 'ko' : 'en');

export const t = (ko: string, en: string): string => (lang === 'en' ? en : ko);

export function switchLang(): void {
  lang = lang === 'ko' ? 'en' : 'ko';
  storage.set('lang', lang);
  document.documentElement.lang = lang;
}
