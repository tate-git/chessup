// 기권 확인(랭킹 대결 · 봇 연습 공통)
import { t } from '../i18n';
import { confirmDialog } from './app-dialog';

export const askResign = () =>
  confirmDialog('🏳️', t('기권할까요?', 'Resign this game?'), t('기권하기', 'Resign'), t('계속 두기', 'Keep playing'), t('기권하면 이 판은 지게 돼요', 'You will lose this game'));
