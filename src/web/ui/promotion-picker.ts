// 승진할 말 고르기(퀸·룩·비숍·나이트)
import { BISHOP, KNIGHT, QUEEN, ROOK, type Side } from '../../engine';
import { pieceImage } from './board-view';

const CHOICES = [QUEEN, ROOK, BISHOP, KNIGHT] as const;

export function pickPromotion(side: Side): Promise<number> {
  const dialog = document.createElement('dialog');
  dialog.className = 'promotion';
  dialog.innerHTML = CHOICES.map(type => `<button type="button" value="${type}"><img src="${pieceImage(side * type)}" alt=""></button>`).join('');
  document.body.append(dialog);
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest('button');
      const type = button ? Number(button.value) : QUEEN;   // 바깥을 누르면 퀸
      dialog.close();
      dialog.remove();
      resolve(type);
    });
  });
}
