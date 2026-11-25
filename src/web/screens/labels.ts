// 화면 글자 모음
import { parseTimeControl, type EndReason, type TimeControl, type VariantId } from '../../shared/protocol';
import { t } from '../i18n';

export const variantLabel = (variant: VariantId) => (variant === 'standard' ? t('정통 체스', 'Chess') : t('미니 체스 6×6', 'Mini chess 6×6'));

/** 「3+2」 → 「3분 +2초」(처음 시간 + 한 수마다 더하는 시간) · 더하는 시간이 없으면 「10분」 */
export function timeControlLabel(timeControl: TimeControl): string {
  const { initialMs, incrementMs } = parseTimeControl(timeControl);
  const minutes = initialMs / 60_000;
  const seconds = incrementMs / 1_000;
  return seconds === 0 ? t(`${minutes}분`, `${minutes} min`) : t(`${minutes}분 +${seconds}초`, `${minutes} min +${seconds}s`);
}

/** 시간 버튼에 마우스를 올리면 나오는 설명 */
export function timeControlHint(timeControl: TimeControl): string {
  const { initialMs, incrementMs } = parseTimeControl(timeControl);
  const minutes = initialMs / 60_000;
  const seconds = incrementMs / 1_000;
  return seconds === 0
    ? t(`각자 ${minutes}분 · 더해지는 시간 없음`, `${minutes} minutes each · no increment`)
    : t(`각자 ${minutes}분으로 시작 · 한 수 둘 때마다 ${seconds}초씩 더해져요`, `${minutes} minutes each · +${seconds}s per move`);
}

export function endReasonLabel(reason: EndReason): string {
  const labels: Record<EndReason, () => string> = {
    checkmate: () => t('체크메이트', 'Checkmate'),
    stalemate: () => t('스테일메이트(무승부)', 'Stalemate'),
    repetition: () => t('3회 반복(무승부)', 'Threefold repetition'),
    fiftyMove: () => t('50수 규칙(무승부)', 'Fifty-move rule'),
    insufficient: () => t('기물 부족(무승부)', 'Insufficient material'),
    resign: () => t('기권', 'Resignation'),
    timeout: () => t('시간 초과', 'Time out'),
    agreement: () => t('합의 무승부', 'Draw by agreement'),
    abandon: () => t('첫 수를 두지 않아 취소', 'Aborted (no first move)'),
  };
  return labels[reason]();
}

export const ratingText = (rating: number, provisional: boolean) => `${rating}${provisional ? '?' : ''}`;
