import { DIFFICULTY_LABEL, DIFFICULTIES, type Difficulty } from '../engine/solver';
import type { GameState } from '../game/types';
import { aggregate, type Result } from '../storage/results';
import { formatTime } from './format';
import { icons } from './icons';

export interface HomeOptions {
  save: GameState | null;
  results: Result[];
  version: string;
  onContinue: () => void;
  onNewGame: (difficulty: Difficulty) => void;
  onStats: () => void;
  onSettings: () => void;
}

const BLURB: Record<Difficulty, string> = {
  easy: '唯一余数 · 隐性唯一',
  medium: '会用到区块排除',
  hard: '需要数对',
  expert: '四类技巧不够，需要试错',
};

export function renderHome(options: HomeOptions): HTMLElement {
  const stats = aggregate(options.results);
  const root = document.createElement('div');
  root.className = 'page home-page';

  const save = options.save;
  const filled = save ? countFilled(save) : 0;
  const continueMarkup = save
    ? `<button type="button" class="continue-card" data-continue>
        <span class="continue-main">
          <span class="continue-kicker">继续对局</span>
          <strong>${DIFFICULTY_LABEL[save.difficulty]} · 已填 ${filled}/81</strong>
          <span class="continue-meta">用时 ${formatTime(save.elapsed)}${save.mistakes > 0 ? ` · 错误 ${save.mistakes}` : ''}</span>
        </span>
        <span class="continue-arrow">${icons.arrow}</span>
      </button>`
    : '';

  const cards = DIFFICULTIES.map((difficulty) => {
    const best = stats[difficulty].bestTime;
    return `<button type="button" class="difficulty-card diff-${difficulty}" data-difficulty="${difficulty}">
      <span class="difficulty-name">${DIFFICULTY_LABEL[difficulty]}</span>
      <span class="difficulty-blurb">${BLURB[difficulty]}</span>
      <span class="difficulty-best">${best === null ? '尚未完成' : `最佳 ${formatTime(best)}`}</span>
    </button>`;
  }).join('');

  root.innerHTML = `
    <header class="brand">
      <div class="brand-mark" aria-hidden="true">${Array.from({ length: 9 }, (_, index) => `<i class="${index === 4 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="brand-text">
        <h1>数独</h1>
        <p>纯单机 · 离线可玩</p>
      </div>
    </header>

    ${continueMarkup}

    <section class="home-section">
      <div class="section-head">
        <h2>新对局</h2>
        <span>按解题技巧分级</span>
      </div>
      <div class="difficulty-grid">${cards}</div>
    </section>

    <section class="home-guide" aria-label="手势提示">
      <div class="home-guide-row">
        <span class="home-guide-icon">${icons.tap}</span>
        <span><strong>轻点数字</strong>记下或删掉候选</span>
      </div>
      <div class="home-guide-row">
        <span class="home-guide-icon">${icons.longpress}</span>
        <span><strong>长按数字</strong>把答案填进选中的格子</span>
      </div>
      <div class="home-guide-row">
        <span class="home-guide-icon">${icons.erase}</span>
        <span><strong>长按擦除</strong>清空整盘笔记</span>
      </div>
    </section>

    <nav class="home-nav" aria-label="更多">
      <button type="button" class="nav-btn" data-nav="stats">${icons.chart}<span>统计</span></button>
      <button type="button" class="nav-btn" data-nav="settings">${icons.settings}<span>设置</span></button>
    </nav>

    <footer class="home-foot">
      <span>v${options.version}</span>
      <span>没有账号，没有网络请求</span>
    </footer>
  `;

  root.querySelector('[data-continue]')?.addEventListener('click', options.onContinue);
  for (const button of root.querySelectorAll<HTMLElement>('[data-difficulty]')) {
    button.addEventListener('click', () => {
      options.onNewGame(button.dataset.difficulty as Difficulty);
    });
  }
  root.querySelector('[data-nav="stats"]')?.addEventListener('click', options.onStats);
  root.querySelector('[data-nav="settings"]')?.addEventListener('click', options.onSettings);
  return root;
}

function countFilled(state: GameState): number {
  let filled = 0;
  for (let cell = 0; cell < 81; cell++) if (state.values[cell] !== 0) filled++;
  return filled;
}
