// 화면 글자 모음
import type { EndReason, VariantId } from '../../shared/protocol';
import { t } from '../i18n';

export const variantLabel = (variant: VariantId) => (variant === 'standard' ? t('정통 체스', 'Chess') : t('미니 체스 6×6', 'Mini chess 6×6'));

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
