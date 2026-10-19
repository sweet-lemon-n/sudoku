import { DIFFICULTY_LABEL, DIFFICULTIES } from '../engine/solver';
import { aggregate, type Result } from '../storage/results';
import { formatDate, formatTime } from './format';
import { icons } from './icons';

export interface StatsOptions {
  results: Result[];
  onBack: () => void;
}

export function renderStats(options: StatsOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page sub-page stats-page';
  const stats = aggregate(options.results);
  const total = options.results.length;

  const cards = DIFFICULTIES.map((difficulty) => {
    const slot = stats[difficulty];
    return `<article class="stat-card">
      <header>
        <span class="stat-name">${DIFFICULTY_LABEL[difficulty]}</span>
        <span class="stat-played">${slot.played} 局</span>
      </header>
      <dl class="stat-grid">
        <div><dt>最佳</dt><dd>${slot.bestTime === null ? '—' : formatTime(slot.bestTime)}</dd></div>
        <div><dt>平均</dt><dd>${slot.averageTime === null ? '—' : formatTime(slot.averageTime)}</dd></div>
        <div><dt>平均错误</dt><dd>${slot.averageMistakes === null ? '—' : slot.averageMistakes}</dd></div>
        <div><dt>平均提示</dt><dd>${slot.averageHints === null ? '—' : slot.averageHints}</dd></div>
      </dl>
    </article>`;
  }).join('');

  const recent = options.results.slice(0, 12);
  const recentMarkup = recent.length
    ? `<ol class="result-list">${recent
        .map(
          (result) => `<li class="result-row">
            <span class="result-main">
              <strong>${DIFFICULTY_LABEL[result.difficulty]}</strong>
              <span>${formatDate(result.finishedAt)}</span>
            </span>
            <span class="result-numbers">
              <b>${formatTime(result.timeSec)}</b>
              <span>错误 ${result.mistakes} · 提示 ${result.hints}</span>
            </span>
          </li>`,
        )
        .join('')}</ol>`
    : `<div class="empty-state">
        <div class="empty-icon">${icons.chart}</div>
        <p>还没有完成记录</p>
        <span>完成一局后，用时会留在这里。</span>
      </div>`;

  root.innerHTML = `
    <header class="sub-top">
      <button type="button" class="icon-btn" data-back aria-label="返回" title="返回">${icons.back}</button>
      <h1>统计</h1>
      <span class="sub-top-note">${total} 局</span>
    </header>
    <section class="stats-cards">${cards}</section>
    <section class="stats-recent">
      <div class="section-head"><h2>最近完成</h2><span>只保存在本机</span></div>
      ${recentMarkup}
    </section>
  `;

  root.querySelector('[data-back]')?.addEventListener('click', options.onBack);
  return root;
}
