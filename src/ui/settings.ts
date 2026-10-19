import type { Settings, ThemePreference } from '../storage/settings';
import { icons } from './icons';

export interface SettingsOptions {
  settings: Settings;
  version: string;
  onChange: (next: Settings) => void;
  onBack: () => void;
  onShowGuide: () => void;
  onClearData: () => void;
}

const THEME_CHOICES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'night', label: '夜色' },
  { value: 'day', label: '日间' },
];

export function renderSettings(options: SettingsOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page sub-page settings-page';
  const settings = { ...options.settings };
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  root.innerHTML = `
    <header class="sub-top">
      <button type="button" class="icon-btn" data-back aria-label="返回" title="返回">${icons.back}</button>
      <h1>设置</h1>
      <span class="sub-top-note">v${options.version}</span>
    </header>

    <section class="settings-group">
      <h2>外观</h2>
      <div class="setting-card">
        <div class="setting-row setting-row-column">
          <div class="setting-label">
            <strong>主题</strong>
            <span>跟随系统，或固定夜色 / 日间</span>
          </div>
          <div class="segmented" role="group" aria-label="主题">
            ${THEME_CHOICES.map(
              (choice) =>
                `<button type="button" data-theme-choice="${choice.value}" aria-pressed="${settings.theme === choice.value}" class="${settings.theme === choice.value ? 'active' : ''}">${choice.label}</button>`,
            ).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <h2>反馈</h2>
      <div class="setting-card">
        <div class="setting-row">
          <div class="setting-label">
            <strong>震动</strong>
            <span>${canVibrate ? '填对、填错与完成时给出不同震动' : '此设备或浏览器不支持震动'}</span>
          </div>
          <button type="button" class="switch ${settings.haptics ? 'on' : ''}" role="switch" aria-checked="${settings.haptics}" aria-label="震动" data-toggle="haptics" ${canVibrate ? '' : 'disabled'}>
            <span></span>
          </button>
        </div>
        <div class="setting-row">
          <div class="setting-label">
            <strong>音效</strong>
            <span>默认关闭；开启后使用轻提示音</span>
          </div>
          <button type="button" class="switch ${settings.sound ? 'on' : ''}" role="switch" aria-checked="${settings.sound}" aria-label="音效" data-toggle="sound">
            <span></span>
          </button>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <h2>帮助</h2>
      <div class="setting-card">
        <button type="button" class="setting-row setting-link" data-guide>
          <div class="setting-label">
            <strong>手势说明</strong>
            <span>轻点记笔记，长按填答案</span>
          </div>
          <span class="setting-arrow">${icons.arrow}</span>
        </button>
      </div>
    </section>

    <section class="settings-group">
      <h2>数据</h2>
      <div class="setting-card">
        <button type="button" class="setting-row setting-link danger" data-clear>
          <div class="setting-label">
            <strong>清除对局与统计</strong>
            <span>删掉当前存档和全部完成记录，设置保留</span>
          </div>
          <span class="setting-arrow">${icons.trash}</span>
        </button>
      </div>
    </section>

    <footer class="settings-footer">
      <p>数独 v${options.version}</p>
      <p>所有对局与统计只保存在这台设备上。</p>
      <p>安装：浏览器菜单 → 添加到主屏幕。首次安装需要 HTTPS。</p>
    </footer>
  `;

  for (const button of root.querySelectorAll<HTMLElement>('[data-theme-choice]')) {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice as ThemePreference;
      if (theme === settings.theme) return;
      settings.theme = theme;
      for (const other of root.querySelectorAll<HTMLElement>('[data-theme-choice]')) {
        const active = other.dataset.themeChoice === theme;
        other.classList.toggle('active', active);
        other.setAttribute('aria-pressed', String(active));
      }
      options.onChange({ ...settings });
    });
  }

  for (const button of root.querySelectorAll<HTMLElement>('[data-toggle]')) {
    button.addEventListener('click', () => {
      const key = button.dataset.toggle as 'haptics' | 'sound';
      settings[key] = !settings[key];
      button.classList.toggle('on', settings[key]);
      button.setAttribute('aria-checked', String(settings[key]));
      options.onChange({ ...settings });
    });
  }

  root.querySelector('[data-back]')?.addEventListener('click', options.onBack);
  root.querySelector('[data-guide]')?.addEventListener('click', options.onShowGuide);
  root.querySelector('[data-clear]')?.addEventListener('click', options.onClearData);
  return root;
}
