import { icons } from './icons';

export interface OnboardingOptions {
  onDone: () => void;
  /** 从设置里再次打开时，标题改为“手势说明”。 */
  replay?: boolean;
}

/** 首次打开（或从设置重看）时的手势说明。返回关闭函数。 */
export function showOnboarding(options: OnboardingOptions): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay onboarding';
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  overlay.innerHTML = `
    <div class="sheet onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <button type="button" class="icon-btn onboarding-close" data-close aria-label="关闭" title="关闭">${icons.close}</button>
      <div class="sheet-kicker">${options.replay ? '手势说明' : '第一次打开'}</div>
      <h2 class="sheet-title" id="onboarding-title">数独怎么玩</h2>
      <p class="onboarding-rule">每行、每列、每宫里填入 1–9，不能重复。</p>
      <ul class="guide-list">
        <li>
          <span class="guide-icon">${icons.tap}</span>
          <span class="guide-copy"><strong>轻点数字</strong><span>记下或删掉这个候选数</span></span>
        </li>
        <li>
          <span class="guide-icon">${icons.longpress}</span>
          <span class="guide-copy"><strong>长按数字 450 毫秒</strong><span>把数字填进选中的格子</span></span>
        </li>
        <li>
          <span class="guide-icon">${icons.erase}</span>
          <span class="guide-copy"><strong>擦除</strong><span>轻点清一格；长按清空全部笔记</span></span>
        </li>
      </ul>
      <button type="button" class="primary-btn" data-start>${options.replay ? '知道了' : '开始'}</button>
      <p class="onboarding-foot">提示会分三步：先高亮相关格，再解释技巧，最后才揭示答案。电脑上也可用 1–9 记笔记、Shift+1–9 填答案。</p>
    </div>
  `;

  document.body.append(overlay);
  document.body.classList.add('modal-open');
  const sheet = overlay.querySelector<HTMLElement>('.onboarding-sheet')!;

  const startButton = overlay.querySelector<HTMLElement>('[data-start]')!;
  startButton.focus({ preventScroll: true });

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeyDown);
    overlay.removeEventListener('click', onClick);
    previousFocus?.focus({ preventScroll: true });
    options.onDone();
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-start], [data-close]')) close();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      sheet.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  overlay.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  return close;
}
