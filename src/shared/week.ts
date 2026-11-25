// 「이번 주」 = 한국 시간 월요일 0시부터(이번 주 랭킹 · 서버와 화면이 같이 씀)
const KOREA_OFFSET_MS = 9 * 3_600_000;

/** 그 시각이 든 주의 월요일(한국 날짜 YYYY-MM-DD) */
export function koreaWeekStart(at = new Date()): string {
  const korea = new Date(at.getTime() + KOREA_OFFSET_MS);
  const sinceMonday = (korea.getUTCDay() + 6) % 7;
  korea.setUTCDate(korea.getUTCDate() - sinceMonday);
  return korea.toISOString().slice(0, 10);
}
