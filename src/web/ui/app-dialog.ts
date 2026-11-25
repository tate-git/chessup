// 앱 안 확인 창(브라우저 기본 confirm·alert 대신): 결과 창과 같은 모양 · Esc·바깥 누르면 취소
import { escapeHtml } from './dom';

export interface DialogAction<T> {
  readonly label: string;
  readonly value: T;
  readonly primary?: boolean;
  readonly danger?: boolean;
}

export interface DialogOptions<T> {
  readonly icon: string;
  readonly title: string;
  readonly message?: string;
  readonly actions: readonly DialogAction<T>[];
  /** Esc · 바깥을 눌렀을 때 값 */
  readonly dismissValue: T;
}

/** 창을 띄우고 고른 값을 돌려줌(닫히면 창은 지움) */
export function showDialog<T>(options: DialogOptions<T>): Promise<T> {
  const dialog = document.createElement('dialog');
  dialog.className = 'result app-dialog';
  dialog.innerHTML = `
    <p class="result-icon">${options.icon}</p>
    <h2>${escapeHtml(options.title)}</h2>
    ${options.message ? `<p class="muted">${escapeHtml(options.message)}</p>` : ''}
    <div class="row">${options.actions
      .map((action, index) => `<button type="button" class="${action.primary ? 'primary' : ''} ${action.danger ? 'danger' : ''}" data-index="${index}">${escapeHtml(action.label)}</button>`)
      .join('')}</div>`;
  document.body.append(dialog);

  return new Promise(resolve => {
    const finish = (value: T) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      finish(options.dismissValue);
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) return finish(options.dismissValue);   // 바깥(배경) 누름
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (button) finish(options.actions[Number(button.dataset.index)].value);
    });
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('button:not(.danger)')?.focus();
  });
}

/** 예/아니오 */
export const confirmDialog = (icon: string, title: string, confirmLabel: string, cancelLabel: string, message?: string) =>
  showDialog<boolean>({
    icon,
    title,
    message,
    dismissValue: false,
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, danger: true },
    ],
  });

/** 알림(확인 하나) */
export const noticeDialog = (icon: string, title: string, okLabel: string) =>
  showDialog<void>({ icon, title, dismissValue: undefined, actions: [{ label: okLabel, value: undefined, primary: true }] });
