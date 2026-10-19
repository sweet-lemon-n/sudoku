/* 一次性原型：同一套组件，夜色 / 日间两套主题。
 * 交互：轻点数字 = 记/删候选笔记；长按数字 = 填入答案。
 * 无存档、无生成器，单个硬编码题面。
 */

const PUZZLE = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

const SOLUTION = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

const THEMES = {
  night: { name: '夜色' },
  day: { name: '日间' },
};

const state = {
  theme: 'night',
  followSystem: true,
  values: PUZZLE.slice(),
  notes: Array.from({ length: 81 }, () => new Set()),
  errors: new Set(),
  selected: null,
  mistakes: 0,
  hints: 0,
  elapsed: 0,
  running: false,
  paused: false,
  won: false,
  hintTarget: null,
  hintText: '',
  undo: [],
  lastPlaced: null,
};

const $app = document.getElementById('app');

const ICONS = {
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h10.5a5 5 0 0 1 0 10H8"/><path d="M8 5 4 9l4 4"/></svg>',
  erase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16"/><path d="M6.5 13.5l6-6 5 5-6 6H8.5z"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2a5.6 5.6 0 0 0-3.1 10.3V17h6.2v-3.5A5.6 5.6 0 0 0 12 3.2z"/><path d="M10 20h4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M8.5 5.5v13"/><path d="M15.5 5.5v13"/></svg>',
};

function rowOf(i) { return Math.floor(i / 9); }
function colOf(i) { return i % 9; }
function shortName(i) { return `R${rowOf(i) + 1}C${colOf(i) + 1}`; }
function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isPeer(a, b) {
  if (a === b) return false;
  const ra = rowOf(a), ca = colOf(a), rb = rowOf(b), cb = colOf(b);
  return (
    ra === rb ||
    ca === cb ||
    (Math.floor(ra / 3) === Math.floor(rb / 3) && Math.floor(ca / 3) === Math.floor(cb / 3))
  );
}

function digitInPeers(i, d) {
  for (let j = 0; j < 81; j++) {
    if (j !== i && state.values[j] === d && isPeer(i, j)) return true;
  }
  return false;
}

function candidates(i) {
  if (state.values[i]) return [];
  const used = new Set();
  for (let k = 0; k < 9; k++) {
    used.add(state.values[rowOf(i) * 9 + k]);
    used.add(state.values[k * 9 + colOf(i)]);
  }
  const br = Math.floor(rowOf(i) / 3) * 3;
  const bc = Math.floor(colOf(i) / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) used.add(state.values[(br + r) * 9 + bc + c]);
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d));
}

function remaining(d) {
  let placed = 0;
  for (let i = 0; i < 81; i++) {
    if (state.values[i] === d) placed++;
  }
  return Math.max(0, 9 - placed);
}

function snapshot() {
  state.undo.push({
    values: state.values.slice(),
    notes: state.notes.map((s) => new Set(s)),
    errors: new Set(state.errors),
  });
  if (state.undo.length > 80) state.undo.shift();
}

function restore(snap) {
  state.values = snap.values.slice();
  state.notes = snap.notes.map((s) => new Set(s));
  state.errors = new Set(snap.errors);
}

function clearPeerNotes(i, d) {
  for (let j = 0; j < 81; j++) {
    if (j !== i && isPeer(i, j)) state.notes[j].delete(d);
  }
  state.notes[i].clear();
}

function startClock() {
  if (!state.running) state.running = true;
}

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* 部分浏览器不支持震动，静默降级 */
  }
}

function checkWin() {
  if (!state.values.every((v, i) => v === SOLUTION[i])) return;
  state.won = true;
  state.running = false;
  state.paused = false;
  state.hintTarget = null;
  state.hintText = '';
  buzz([15, 50, 15, 50, 30]);
}

function showMessage(text) {
  state.hintText = text;
  state.hintTarget = null;
  render();
}

/* 长按填入：可覆盖错值，但已知数不动。 */
function place(i, d) {
  if (state.won || state.paused) return;
  if (PUZZLE[i] !== 0) {
    showMessage('已知数不能修改');
    return;
  }
  if (state.values[i] === d) return;

  snapshot();
  state.values[i] = d;
  state.errors.delete(i);
  state.lastPlaced = i;

  // 规则：落子即清掉同行、同列、同宫里这个数字的候选笔记（对错都清，撤销可恢复）。
  clearPeerNotes(i, d);

  if (d !== SOLUTION[i]) {
    state.errors.add(i);
    state.mistakes++;
    state.hintText = `${shortName(i)} 的 ${d} 不对，已标红`;
    buzz([12, 40, 12]);
  } else {
    state.hintText = '';
    const complete = state.values.every((v, idx) => v === SOLUTION[idx]);
    if (!complete) buzz(8);
  }
  state.hintTarget = null;
  startClock();
  checkWin();
  render();
}

/* 轻点记笔记：已被同行/列/宫占用的数字不允许记为候选。 */
function toggleNote(i, d) {
  if (state.won || state.paused) return;
  if (PUZZLE[i] !== 0) {
    showMessage('已知数不能记候选');
    return;
  }
  if (state.values[i] !== 0) {
    showMessage('先擦除这个格子的数字，再记候选');
    return;
  }
  if (!state.notes[i].has(d) && digitInPeers(i, d)) {
    showMessage(`${d} 已在同行、同列或同宫中，不能记为候选`);
    return;
  }

  snapshot();
  if (state.notes[i].has(d)) state.notes[i].delete(d);
  else state.notes[i].add(d);
  state.hintTarget = null;
  state.hintText = '';
  startClock();
  render();
}

function tapDigit(d) {
  if (state.won || state.paused) return;
  if (state.selected == null) {
    showMessage('先选一个格子，再记笔记');
    return;
  }
  toggleNote(state.selected, d);
}

function fillDigit(d) {
  if (state.won || state.paused) return;
  if (state.selected == null) {
    showMessage('先选一个格子，再填答案');
    return;
  }
  place(state.selected, d);
}

function onCell(i) {
  if (state.won || state.paused) return;
  state.selected = state.selected === i ? null : i;
  state.hintTarget = null;
  state.hintText = '';
  render();
}

function erase() {
  if (state.won || state.paused) return;
  const i = state.selected;
  if (i == null) return;
  if (PUZZLE[i] !== 0) {
    showMessage('已知数不能擦除');
    return;
  }
  if (!state.values[i] && state.notes[i].size === 0 && !state.errors.has(i)) return;
  snapshot();
  state.values[i] = 0;
  state.notes[i].clear();
  state.errors.delete(i);
  state.hintText = '';
  buzz(6);
  render();
}

/* 长按擦除：清空整盘候选，值/错误不动；可撤销。 */
function clearAllNotes() {
  if (state.won || state.paused) return;
  let count = 0;
  for (let i = 0; i < 81; i++) count += state.notes[i].size;
  if (count === 0) {
    showMessage('没有笔记可清除');
    return;
  }
  snapshot();
  for (let i = 0; i < 81; i++) state.notes[i].clear();
  state.hintTarget = null;
  state.hintText = `已清除全部笔记（${count} 个候选） · 可撤销`;
  buzz(10);
  render();
}

function undo() {
  const snap = state.undo.pop();
  if (!snap) return;
  restore(snap);
  state.hintTarget = null;
  state.hintText = '';
  state.won = false;
  state.paused = false;
  render();
}

function hint() {
  if (state.won || state.paused) return;

  if (state.hintTarget != null) {
    const i = state.hintTarget;
    const d = SOLUTION[i];
    snapshot();
    state.values[i] = d;
    state.errors.delete(i);
    clearPeerNotes(i, d);
    state.hintTarget = null;
    state.hintText = `已揭示：${shortName(i)} = ${d}`;
    state.lastPlaced = i;
    startClock();
    checkWin();
    render();
    return;
  }

  if (state.errors.size > 0) {
    state.hintText = '先修正标红的格子，再要提示';
    state.hintTarget = null;
    render();
    return;
  }

  let target = null;
  for (let i = 0; i < 81; i++) {
    if (state.values[i] === 0) {
      const c = candidates(i);
      if (c.length === 1) {
        target = { i, d: c[0], fallback: false };
        break;
      }
    }
  }

  if (!target) {
    const i = state.values.findIndex((v) => v === 0);
    if (i === -1) return;
    target = { i, d: SOLUTION[i], fallback: true };
  }

  state.hints++;
  state.hintTarget = target.i;
  state.selected = target.i;
  state.hintText = target.fallback
    ? '这一步已经需要试错 · 再点一次揭示'
    : `${shortName(target.i)} 只剩 ${target.d} 可填（唯一余数）· 长按 ${target.d} 填入，或再点提示揭示`;
  render();
}

function togglePause() {
  if (state.won) return;
  state.paused = !state.paused;
  state.hintText = '';
  state.hintTarget = null;
  render();
}

function resetGame() {
  state.values = PUZZLE.slice();
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.errors = new Set();
  state.selected = null;
  state.mistakes = 0;
  state.hints = 0;
  state.elapsed = 0;
  state.running = false;
  state.paused = false;
  state.won = false;
  state.hintTarget = null;
  state.hintText = '';
  state.undo = [];
  state.lastPlaced = null;
}

function cellLabel(i) {
  const bits = [shortName(i)];
  const value = state.values[i];
  if (PUZZLE[i] !== 0) bits.push('已知');
  if (value) bits.push(String(value));
  else if (state.notes[i].size) bits.push(`候选 ${[...state.notes[i]].sort().join(' ')}`);
  else bits.push('空');
  if (state.errors.has(i)) bits.push('错误');
  return bits.join('，');
}

function renderBoard() {
  const selVal =
    state.selected != null && !state.errors.has(state.selected)
      ? state.values[state.selected]
      : 0;
  let html = '';
  for (let i = 0; i < 81; i++) {
    const value = state.values[i];
    const given = PUZZLE[i] !== 0;
    const notes = state.notes[i];
    const classes = ['cell'];

    if (given) classes.push('given');
    if (!given && value) classes.push('user');
    if (state.errors.has(i)) classes.push('error');
    if (i === state.selected) classes.push('selected');
    else if (state.selected != null) {
      if (isPeer(i, state.selected)) classes.push('peer');
      if (selVal && value === selVal) classes.push('same');
    }
    if (state.hintTarget === i) classes.push('hint-target');

    let inner = '';
    if (value) {
      inner = String(value);
    } else if (notes.size > 0) {
      inner = `<span class="notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((d) => `<i class="${notes.has(d) ? 'on' : ''}">${notes.has(d) ? d : ''}</i>`)
        .join('')}</span>`;
    }

    html += `<button type="button" class="${classes.join(' ')}" data-cell="${i}" aria-label="${cellLabel(i)}">${inner}</button>`;
  }
  return html;
}

function renderKeys() {
  const notesCell =
    state.selected != null &&
    PUZZLE[state.selected] === 0 &&
    state.values[state.selected] === 0
      ? state.selected
      : null;

  return Array.from({ length: 9 }, (_, k) => {
    const d = k + 1;
    const left = remaining(d);
    const classes = ['key'];
    if (left === 0) classes.push('done');
    const blocked =
      notesCell != null &&
      !state.notes[notesCell].has(d) &&
      digitInPeers(notesCell, d);
    if (blocked) classes.push('blocked');
    return `<button type="button" class="${classes.join(' ')}" data-digit="${d}" aria-label="数字 ${d}，剩余 ${left}，轻点记笔记，长按填答案${blocked ? '，当前格不能重复记为候选' : ''}">
      <span class="key-num">${d}</span><span class="key-left">${left}</span><i class="pressbar" aria-hidden="true"></i>
    </button>`;
  }).join('');
}

function renderHint() {
  if (!state.hintText) return '';
  return `<div class="hintbar" role="status" aria-live="polite">${state.hintText}</div>`;
}

function renderOverlay() {
  if (state.won) {
    return `<div class="overlay">
      <div class="sheet">
        <div class="sheet-kicker">完成</div>
        <div class="win-title">这一局结束了</div>
        <div class="win-stats">
          <span>用时<b>${fmt(state.elapsed)}</b></span>
          <span>错误<b>${state.mistakes}</b></span>
          <span>提示<b>${state.hints}</b></span>
        </div>
        <button type="button" class="sheet-btn" data-action="restart">再来一局</button>
      </div>
    </div>`;
  }
  if (state.paused) {
    return `<div class="overlay">
      <div class="sheet">
        <div class="sheet-kicker">已暂停</div>
        <div class="pause-time js-timer">${fmt(state.elapsed)}</div>
        <button type="button" class="sheet-btn" data-action="resume">继续</button>
      </div>
    </div>`;
  }
  return '';
}

function toolButton(action, label, icon, disabled, desc = label) {
  return `<button type="button" class="tool" data-action="${action}" ${disabled ? 'disabled' : ''} aria-label="${desc}" title="${desc}">${icon}<span>${label}</span></button>`;
}

function renderGame() {
  return `<div class="page">
    <div class="top">
      <span class="chip">中等</span>
      <span class="chip chip-timer js-timer">${fmt(state.elapsed)}</span>
      <span class="chip">错误 ${state.mistakes}</span>
      <span class="chip chip-hints">提示 ${state.hints}</span>
    </div>
    <div class="stage">
      <div class="board-card">
        <div class="board" role="group" aria-label="数独盘面">${renderBoard()}</div>
      </div>
      ${renderHint()}
    </div>
    <div class="controls">
      <div class="bottom">
        <div class="pad">${renderKeys()}</div>
        <div class="tools">
          ${toolButton('undo', '撤销', ICONS.undo, state.undo.length === 0)}
          ${toolButton('erase', '擦除', ICONS.erase, false, '擦除；长按清除全部笔记')}
          ${toolButton('hint', '提示', ICONS.hint, false)}
          ${toolButton('pause', '暂停', ICONS.pause, false)}
        </div>
      </div>
    </div>
    ${renderOverlay()}
  </div>`;
}

function updateChrome() {
  document.querySelectorAll('[data-theme]').forEach((btn) => {
    const active = btn.dataset.theme === state.theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function render() {
  document.body.className = `theme-${state.theme}`;
  $app.innerHTML = renderGame();
  updateChrome();
}

const THEME_KEY = 'sudoku-theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  } catch {
    return 'night';
  }
}

function setTheme(theme) {
  if (!THEMES[theme]) return;
  state.theme = theme;
  state.followSystem = false;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 隐私模式可能禁用 localStorage */
  }
  try {
    const url = new URL(location.href);
    url.searchParams.set('theme', theme);
    history.replaceState(null, '', url);
  } catch {
    /* file:// 或某些浏览器不允许改 URL */
  }
  render();
}

function cycleTheme(dir) {
  const keys = Object.keys(THEMES);
  const idx = keys.indexOf(state.theme);
  setTheme(keys[(idx + dir + keys.length) % keys.length]);
}

function doAction(name) {
  switch (name) {
    case 'undo': undo(); break;
    case 'erase': erase(); break;
    case 'hint': hint(); break;
    case 'pause': togglePause(); break;
    case 'resume': togglePause(); break;
    case 'restart': resetGame(); render(); break;
    default: break;
  }
}

function tick() {
  if (!state.running || state.paused || state.won) return;
  state.elapsed++;
  document.querySelectorAll('.js-timer').forEach((el) => {
    el.textContent = fmt(state.elapsed);
  });
}

/* ---------- 长按：450ms 后填入，松开时的 click 不再记笔记 ---------- */

let pressTimer = null;
let pressingEl = null;
let pressKind = null;
let pressDigit = null;
let suppressNextClick = false;

function cancelPress() {
  if (pressTimer != null) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  if (pressingEl) {
    pressingEl.classList.remove('pressing');
    pressingEl = null;
  }
  pressKind = null;
  pressDigit = null;
}

$app.addEventListener('pointerdown', (event) => {
  // 新手势开始：上一次长按松手时可能没有派发 click，这里复位。
  suppressNextClick = false;
  const key = event.target.closest('[data-digit]');
  const eraseTool = event.target.closest('[data-action="erase"]');
  const el = key || eraseTool;
  if (!el) return;
  cancelPress();
  pressingEl = el;
  el.classList.add('pressing');
  pressKind = key ? 'fill' : 'clearNotes';
  pressDigit = key ? Number(key.dataset.digit) : null;
  pressTimer = setTimeout(() => {
    pressTimer = null;
    const target = pressingEl;
    const kind = pressKind;
    const digit = pressDigit;
    pressingEl = null;
    pressKind = null;
    pressDigit = null;
    if (target) target.classList.remove('pressing');
    suppressNextClick = true;
    if (kind === 'fill') fillDigit(digit);
    else clearAllNotes();
  }, 450);
});

$app.addEventListener('pointerup', cancelPress);
$app.addEventListener('pointercancel', cancelPress);
$app.addEventListener('pointerleave', (event) => {
  if (pressingEl && (event.target === pressingEl || pressingEl.contains(event.target))) cancelPress();
}, true);

$app.addEventListener('contextmenu', (event) => {
  if (event.target.closest('[data-digit], [data-action="erase"]')) event.preventDefault();
});

$app.addEventListener('click', (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const cell = event.target.closest('[data-cell]');
  if (cell) {
    onCell(Number(cell.dataset.cell));
    return;
  }
  const digit = event.target.closest('[data-digit]');
  if (digit) {
    tapDigit(Number(digit.dataset.digit));
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) doAction(action.dataset.action);
});

document.querySelectorAll('[data-theme]').forEach((btn) => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme));
});

window.addEventListener('keydown', (event) => {
  const t = event.target;
  if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    cycleTheme(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    cycleTheme(1);
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    if (event.shiftKey) clearAllNotes();
    else erase();
  } else if (event.key === ' ') {
    event.preventDefault();
    togglePause();
  } else if (event.key === 'Escape') {
    state.selected = null;
    state.hintTarget = null;
    state.hintText = '';
    render();
  } else {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (m) {
      event.preventDefault();
      const d = Number(m[1]);
      if (event.shiftKey) fillDigit(d);
      else tapDigit(d);
    } else if (event.key.toLowerCase() === 'z') {
      undo();
    } else if (event.key.toLowerCase() === 'h') {
      hint();
    } else if (event.key.toLowerCase() === 't') {
      cycleTheme(1);
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelPress();
    if (state.running && !state.won && !state.paused) {
      state.paused = true;
      render();
    }
  }
});

const params = new URLSearchParams(location.search);
const oldVariant = params.get('variant');
const urlTheme = params.get('theme') || (oldVariant === 'C' ? 'day' : oldVariant === 'B' ? 'night' : null);
const storedRaw = readStoredTheme();
const storedTheme = THEMES[storedRaw] ? storedRaw : null;
const requested = THEMES[urlTheme] ? urlTheme : storedTheme || systemTheme();
state.theme = THEMES[requested] ? requested : systemTheme();
state.followSystem = !THEMES[urlTheme] && !storedTheme;
render();
setInterval(tick, 1000);

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (mq) {
  const onSystemTheme = (event) => {
    if (!state.followSystem) return;
    const next = event.matches ? 'night' : 'day';
    if (next !== state.theme) {
      state.theme = next;
      render();
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onSystemTheme);
  else if (mq.addListener) mq.addListener(onSystemTheme);
}

// 原型调试钩子：方便快速截取完成/暂停等状态，不参与正式实现。
window.__proto = { state, render, checkWin, resetGame, SOLUTION };
