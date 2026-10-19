import { PEERS, bitOf, cellName, digitsOf } from '../engine/board';
import { DIFFICULTY_LABEL, type Difficulty } from '../engine/solver';
import {
  candidatesFor,
  clearNotes,
  eraseCell,
  note,
  pause,
  place,
  remainingOf,
  requestHint,
  resume,
  selectCell,
  tick,
  togglePause,
  undo,
} from '../game/game';
import type { GameState } from '../game/types';
import type { Feedback } from './feedback';
import { escapeHtml, formatTime } from './format';
import { icons } from './icons';

export interface GameViewDeps {
  feedback: Feedback;
  onChange: (state: GameState) => void;
  onTick: (state: GameState) => void;
  onExit: () => void;
  onNewGame: (difficulty: Difficulty) => void;
  onWin: (state: GameState) => void;
  notify: (message: string) => void;
}

const LONG_PRESS_MS = 450;

export class GameView {
  readonly element: HTMLDivElement;
  private state: GameState;
  private readonly deps: GameViewDeps;
  private timer: number | null = null;
  private pressTimer: number | null = null;
  private pressElement: HTMLElement | null = null;
  private pressKind: 'fill' | 'clear' = 'fill';
  private pressDigit = 0;
  private suppressClick = false;
  private keyboardFocus = false;
  private destroyed = false;

  constructor(container: HTMLElement, state: GameState, deps: GameViewDeps) {
    this.state = state;
    this.deps = deps;
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    container.replaceChildren(this.element);

    this.element.addEventListener('click', this.onClick);
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.element.addEventListener('contextmenu', this.onContextMenu);

    this.render();
    this.timer = window.setInterval(this.onInterval, 1000);
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelPress();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.element.removeEventListener('click', this.onClick);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    this.element.remove();
  }

  private commit(next: GameState, keyboard = false): void {
    if (this.destroyed) return;
    if (next === this.state) {
      this.keyboardFocus = keyboard;
      this.render();
      return;
    }
    const previous = this.state;
    this.state = next;
    this.keyboardFocus = keyboard;
    this.render();
    this.deps.onChange(next);
    if (next.won && !previous.won) this.deps.onWin(next);
  }

  private onInterval = (): void => {
    if (this.destroyed || !this.state.running || this.state.paused || this.state.won) return;
    this.state = tick(this.state);
    const timer = this.element.querySelector<HTMLElement>('.js-timer');
    if (timer) timer.textContent = formatTime(this.state.elapsed);
    this.deps.onTick(this.state);
  };

  private onVisibilityChange = (): void => {
    if (!document.hidden || this.destroyed) return;
    this.cancelPress();
    if (this.state.running && !this.state.won && !this.state.paused) {
      this.commit(pause(this.state));
    }
  };

  private onClick = (event: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-cell]');
    if (cell) {
      this.commit(selectCell(this.state, Number(cell.dataset.cell)));
      return;
    }
    const digit = target.closest<HTMLElement>('[data-digit]');
    if (digit) {
      this.tapDigit(Number(digit.dataset.digit));
      return;
    }
    const action = target.closest<HTMLElement>('[data-action]');
    if (action) this.runAction(action.dataset.action ?? '');
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.suppressClick = false;
    this.keyboardFocus = false;
    this.deps.feedback.unlock();
    const target = event.target as HTMLElement;
    const digit = target.closest<HTMLElement>('[data-digit]');
    const erase = target.closest<HTMLElement>('[data-action="erase"]');
    const element = digit ?? erase;
    if (!element) return;
    this.cancelPress();
    this.pressElement = element;
    this.pressKind = digit ? 'fill' : 'clear';
    this.pressDigit = digit ? Number(digit.dataset.digit) : 0;
    element.classList.add('pressing');
    this.pressTimer = window.setTimeout(() => {
      this.pressTimer = null;
      const kind = this.pressKind;
      const pressed = this.pressElement;
      const pressedDigit = this.pressDigit;
      this.pressElement = null;
      pressed?.classList.remove('pressing');
      this.suppressClick = true;
      if (kind === 'fill') this.fillDigit(pressedDigit);
      else this.clearAllNotes();
    }, LONG_PRESS_MS);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pressElement) return;
    const target = event.target as Node | null;
    if (!target || !this.pressElement.contains(target)) this.cancelPress();
  };

  private onPointerUp = (): void => {
    this.cancelPress();
  };

  private onContextMenu = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-digit], [data-action="erase"]')) event.preventDefault();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed) return;
    this.deps.feedback.unlock();
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (digitMatch) {
      event.preventDefault();
      this.keyboardFocus = true;
      const digit = Number(digitMatch[1]);
      if (event.shiftKey) this.fillDigit(digit);
      else this.tapDigit(digit);
      return;
    }

    switch (event.key) {
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        this.keyboardFocus = true;
        if (event.shiftKey) this.clearAllNotes();
        else this.erase();
        return;
      case 'Escape':
        event.preventDefault();
        this.commit(selectCell(this.state, null), true);
        return;
      case ' ':
        event.preventDefault();
        this.commit(togglePause(this.state), true);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        this.moveSelection(event.key);
        return;
      default:
        break;
    }

    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.keyboardFocus = true;
      this.runAction('undo', true);
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      this.keyboardFocus = true;
      this.runAction('hint', true);
    }
  };

  private moveSelection(key: string): void {
    const current = this.state.selected ?? 40;
    const row = Math.floor(current / 9);
    const col = current % 9;
    let nextRow = row;
    let nextCol = col;
    if (key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    if (key === 'ArrowDown') nextRow = Math.min(8, row + 1);
    if (key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
    if (key === 'ArrowRight') nextCol = Math.min(8, col + 1);
    this.commit(selectCell(this.state, nextRow * 9 + nextCol), true);
  }

  private runAction(action: string, keyboard = this.keyboardFocus): void {
    switch (action) {
      case 'exit':
      case 'home':
        this.deps.onExit();
        return;
      case 'undo':
        if (this.state.won || this.state.paused || this.state.undo.length === 0) return;
        this.commit(undo(this.state), keyboard);
        this.deps.feedback.erase();
        return;
      case 'erase':
        this.erase();
        return;
      case 'hint': {
        const before = this.state;
        const next = requestHint(before);
        if (next === before) return;
        const acted =
          next.hints > before.hints ||
          next.reveals > before.reveals ||
          next.hint?.level !== before.hint?.level;
        this.commit(next, keyboard);
        if (acted) {
          if (next.won) this.deps.feedback.win();
          else this.deps.feedback.note();
        }
        return;
      }
      case 'pause':
        this.commit(togglePause(this.state), keyboard);
        return;
      case 'resume':
        this.commit(resume(this.state), keyboard);
        return;
      case 'again':
        this.deps.onNewGame(this.state.difficulty);
        return;
      default:
        return;
    }
  }

  private tapDigit(digit: number): void {
    const cell = this.state.selected;
    if (cell === null) {
      this.deps.notify('先选一个格子，再记笔记');
      return;
    }
    const before = this.state;
    const next = note(before, cell, digit);
    this.commit(next, this.keyboardFocus);
    if (next !== before && next.notes[cell] !== before.notes[cell]) this.deps.feedback.note();
  }

  private fillDigit(digit: number): void {
    const cell = this.state.selected;
    if (cell === null) {
      this.deps.notify('先选一个格子，再填数字');
      return;
    }
    const before = this.state;
    const next = place(before, cell, digit);
    this.commit(next, this.keyboardFocus);
    if (next === before) return;
    if (next.won) this.deps.feedback.win();
    else if (next.errors[cell] !== 0 && before.errors[cell] === 0) this.deps.feedback.wrong();
    else if (next.values[cell] !== before.values[cell]) this.deps.feedback.correct();
  }

  private erase(): void {
    const cell = this.state.selected;
    if (cell === null) {
      this.deps.notify('先选一个格子，再擦除');
      return;
    }
    const before = this.state;
    const next = eraseCell(before, cell);
    this.commit(next, this.keyboardFocus);
    if (next !== before) this.deps.feedback.erase();
  }

  private clearAllNotes(): void {
    const before = this.state;
    const next = clearNotes(before);
    if (next === before) {
      this.render();
      return;
    }
    const noNotes = next.message?.startsWith('没有笔记') ?? false;
    this.commit(next, this.keyboardFocus);
    if (!noNotes) this.deps.feedback.erase();
  }

  private cancelPress(): void {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    if (this.pressElement) {
      this.pressElement.classList.remove('pressing');
      this.pressElement = null;
    }
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.state;
    this.element.innerHTML = `
      <div class="page game-page">
        <header class="game-top">
          <button type="button" class="icon-btn" data-action="exit" aria-label="回到首页" title="回到首页">
            ${icons.back}
          </button>
          <div class="chips">
            <span class="chip chip-difficulty">${DIFFICULTY_LABEL[state.difficulty]}</span>
            <span class="chip chip-timer js-timer">${formatTime(state.elapsed)}</span>
            <span class="chip" aria-label="错误 ${state.mistakes} 次">错误 ${state.mistakes}</span>
            <span class="chip chip-hints" aria-label="提示 ${state.hints} 次">提示 ${state.hints}</span>
          </div>
        </header>
        <div class="stage">
          <div class="board-card">
            <div class="board" role="group" aria-label="数独盘面">${this.renderBoard()}</div>
          </div>
          ${this.renderHintBar()}
          <p class="gesture-hint">轻点记笔记 · 长按填答案</p>
        </div>
        <div class="controls">
          <div class="bottom">
            <div class="pad">${this.renderKeys()}</div>
            <div class="tools">
              ${this.renderTool('undo', '撤销', icons.undo, state.undo.length === 0)}
              ${this.renderTool('erase', '擦除', icons.erase, false, '擦除，长按清除全部笔记')}
              ${this.renderTool('hint', '提示', icons.hint, false)}
              ${this.renderTool('pause', '暂停', icons.pause, false)}
            </div>
          </div>
        </div>
        ${this.renderOverlay()}
      </div>
    `;

    if (this.keyboardFocus && state.selected !== null) {
      const cell = this.element.querySelector<HTMLElement>(`[data-cell="${state.selected}"]`);
      cell?.focus({ preventScroll: true });
    }
    this.keyboardFocus = false;
  }

  private renderBoard(): string {
    const state = this.state;
    const selected = state.selected;
    const selectedValue =
      selected !== null && state.errors[selected] === 0 ? state.values[selected] : 0;
    const related = new Set(state.hint?.level === 2 || state.hint?.level === 1 ? state.hint.related : []);
    let html = '';

    for (let cell = 0; cell < 81; cell++) {
      const value = state.values[cell];
      const given = state.givens[cell] !== 0;
      const classes = ['cell'];
      if (given) classes.push('given');
      if (!given && value !== 0) classes.push('user');
      if (state.errors[cell] !== 0) classes.push('error');
      if (cell === selected) classes.push('selected');
      else if (selected !== null) {
        if (PEERS[cell]!.includes(selected)) classes.push('peer');
        if (selectedValue !== 0 && value === selectedValue) classes.push('same');
      }
      if (state.hint?.cell === cell) classes.push('hint-target');
      else if (related.has(cell)) classes.push('hint-related');

      const notes = state.notes[cell]!;
      const label = cellLabel(state, cell);
      let inner = '';
      if (value !== 0) {
        inner = String(value);
      } else if (notes !== 0) {
        inner = `<span class="notes">${Array.from({ length: 9 }, (_, index) => {
          const digit = index + 1;
          const on = (notes & bitOf(digit)) !== 0;
          return `<i class="${on ? 'on' : ''}">${on ? digit : ''}</i>`;
        }).join('')}</span>`;
      }

      html += `<button type="button" class="${classes.join(' ')}" data-cell="${cell}" aria-label="${escapeHtml(label)}" aria-pressed="${cell === selected}">${inner}</button>`;
    }
    return html;
  }

  private renderKeys(): string {
    const state = this.state;
    const notesCell =
      state.selected !== null &&
      state.givens[state.selected] === 0 &&
      state.values[state.selected] === 0
        ? state.selected
        : null;
    const allowed = notesCell !== null ? candidatesFor(state, notesCell) : 0;
    const selectedNotes = notesCell !== null ? state.notes[notesCell]! : 0;

    return Array.from({ length: 9 }, (_, index) => {
      const digit = index + 1;
      const remaining = remainingOf(state, digit);
      const classes = ['key'];
      if (remaining === 0) classes.push('done');
      const blocked =
        notesCell !== null &&
        (selectedNotes & bitOf(digit)) === 0 &&
        (allowed & bitOf(digit)) === 0;
      if (blocked) classes.push('blocked');
      return `<button type="button" class="${classes.join(' ')}" data-digit="${digit}" aria-label="数字 ${digit}，剩余 ${remaining}，轻点记笔记，长按填答案${blocked ? '，当前格不能重复记为候选' : ''}">
        <span class="key-num">${digit}</span><span class="key-left">${remaining}</span><i class="pressbar" aria-hidden="true"></i>
      </button>`;
    }).join('');
  }

  private renderTool(
    action: string,
    label: string,
    icon: string,
    disabled: boolean,
    description = label,
  ): string {
    return `<button type="button" class="tool" data-action="${action}" ${disabled ? 'disabled' : ''} aria-label="${description}" title="${description}">${icon}<span>${label}</span></button>`;
  }

  private renderHintBar(): string {
    const text = this.hintText();
    if (!text) return '<div class="hintbar js-hint" role="status" aria-live="polite" hidden></div>';
    return `<div class="hintbar js-hint" role="status" aria-live="polite">${escapeHtml(text)}</div>`;
  }

  private hintText(): string | null {
    const hint = this.state.hint;
    if (hint) {
      if (hint.level === 1) {
        return `${cellName(hint.cell)}：先看高亮的格子 · 再点提示看原因`;
      }
      return `${hint.explanation.replace(/。$/, '')} · 再点提示揭示`;
    }
    return this.state.message;
  }

  private renderOverlay(): string {
    const state = this.state;
    if (state.won) {
      return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <div class="sheet">
          <div class="sheet-icon">${icons.check}</div>
          <div class="sheet-kicker">完成</div>
          <h2 class="sheet-title" id="win-title">对局完成</h2>
          <div class="result-stats">
            <span>用时<b>${formatTime(state.elapsed)}</b></span>
            <span>错误<b>${state.mistakes}</b></span>
            <span>提示<b>${state.hints}</b></span>
            <span>揭示<b>${state.reveals}</b></span>
          </div>
          <button type="button" class="primary-btn" data-action="again">新对局</button>
          <button type="button" class="ghost-btn" data-action="home">回到首页</button>
        </div>
      </div>`;
    }
    if (state.paused) {
      return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="sheet">
          <div class="sheet-kicker">已暂停</div>
          <h2 class="sheet-title pause-title" id="pause-title">${formatTime(state.elapsed)}</h2>
          <button type="button" class="primary-btn" data-action="resume">继续</button>
          <button type="button" class="ghost-btn" data-action="home">回到首页</button>
        </div>
      </div>`;
    }
    return '';
  }
}

function cellLabel(state: GameState, cell: number): string {
  const parts = [cellName(cell)];
  if (state.givens[cell] !== 0) parts.push('已知数');
  const value = state.values[cell];
  if (value !== 0) parts.push(String(value));
  else if (state.notes[cell] !== 0) {
    parts.push(`候选 ${digitsOf(state.notes[cell]!).join(' ')}`);
  } else {
    parts.push('空');
  }
  if (state.errors[cell] !== 0) parts.push('错误');
  if (state.selected === cell) parts.push('已选中');
  return parts.join('，');
}

