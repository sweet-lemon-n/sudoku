/** 对局状态机：纯函数，不碰 DOM，也不依赖存储。 */

import { ALL_DIGITS, PEERS, bitOf, cellName, gridsEqual, popcount } from '../engine/board';
import { findHint } from '../engine/solver';
import type { GameState, HintState, Puzzle, UndoSnapshot } from './types';

export type { GameState, HintState, Puzzle, UndoSnapshot } from './types';

const UNDO_LIMIT = 100;

export function createGame(puzzle: Puzzle, now = Date.now()): GameState {
  return {
    id: puzzle.id,
    difficulty: puzzle.difficulty,
    givens: puzzle.givens.slice(),
    solution: puzzle.solution.slice(),
    values: puzzle.givens.slice(),
    notes: new Uint16Array(81),
    errors: new Uint8Array(81),
    selected: null,
    hint: null,
    message: null,
    mistakes: 0,
    hints: 0,
    reveals: 0,
    elapsed: 0,
    running: false,
    paused: false,
    won: false,
    undo: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function selectCell(state: GameState, cell: number | null): GameState {
  if (state.won || state.paused) return state;
  if (cell !== null && (cell < 0 || cell > 80)) return state;
  const selected = cellsEqual(state.selected, cell) ? null : cell;
  return { ...state, selected, hint: null, message: null, updatedAt: Date.now() };
}

export function place(state: GameState, cell: number, digit: number): GameState {
  if (state.won || state.paused) return state;
  if (!isCell(cell) || digit < 1 || digit > 9) return state;
  if (state.givens[cell] !== 0) {
    return withMessage(state, '已知数不能修改');
  }
  if (state.values[cell] === digit) return state;

  const next = withUndo(state);
  next.values[cell] = digit;
  next.notes[cell] = 0;
  next.errors[cell] = 0;
  next.running = true;
  next.hint = null;
  next.selected = cell;
  next.message = null;

  clearPeerNotes(next, cell, digit);

  if (digit !== state.solution[cell]) {
    next.errors[cell] = 1;
    next.mistakes += 1;
    next.message = `${cellName(cell)} 的 ${digit} 不对，已标红`;
  }

  if (gridsEqual(next.values, next.solution)) {
    next.won = true;
    next.running = false;
    next.paused = false;
    next.hint = null;
    next.message = null;
  }

  next.updatedAt = Date.now();
  return next;
}

export function note(state: GameState, cell: number, digit: number): GameState {
  if (state.won || state.paused) return state;
  if (!isCell(cell) || digit < 1 || digit > 9) return state;
  if (state.givens[cell] !== 0) return withMessage(state, '已知数不能记候选');
  if (state.values[cell] !== 0) {
    return withMessage(state, '先擦除这个格子的数字，再记候选');
  }

  const bit = bitOf(digit);
  const already = (state.notes[cell]! & bit) !== 0;
  if (!already && digitInPeers(state.values, cell, digit)) {
    return withMessage(state, `${digit} 已在同行、同列或同宫中，不能记为候选`);
  }

  const next = withUndo(state);
  next.notes[cell] = already ? next.notes[cell]! & ~bit : next.notes[cell]! | bit;
  next.running = true;
  next.hint = null;
  next.selected = cell;
  next.message = null;
  next.updatedAt = Date.now();
  return next;
}

export function eraseCell(state: GameState, cell: number): GameState {
  if (state.won || state.paused) return state;
  if (!isCell(cell)) return state;
  if (state.givens[cell] !== 0) return withMessage(state, '已知数不能擦除');
  if (state.values[cell] === 0 && state.notes[cell] === 0 && state.errors[cell] === 0) {
    return state;
  }

  const next = withUndo(state);
  next.values[cell] = 0;
  next.notes[cell] = 0;
  next.errors[cell] = 0;
  next.hint = null;
  next.message = null;
  next.updatedAt = Date.now();
  return next;
}

export function clearNotes(state: GameState): GameState {
  if (state.won || state.paused) return state;
  let count = 0;
  for (let cell = 0; cell < 81; cell++) count += popcount(state.notes[cell]!);
  if (count === 0) return withMessage(state, '没有笔记可清除');

  const next = withUndo(state);
  next.notes.fill(0);
  next.hint = null;
  next.message = `已清除全部笔记（${count} 个候选） · 可撤销`;
  next.updatedAt = Date.now();
  return next;
}

export function undo(state: GameState): GameState {
  const last = state.undo[state.undo.length - 1];
  if (!last) return state;

  return {
    ...state,
    values: last.values.slice(),
    notes: last.notes.slice(),
    errors: last.errors.slice(),
    undo: state.undo.slice(0, -1),
    hint: null,
    message: null,
    won: false,
    paused: false,
    updatedAt: Date.now(),
  };
}

export function requestHint(state: GameState): GameState {
  if (state.won || state.paused) return state;
  // 错值会让候选数推理建立在错误前提上；先修正再提示，沿用原型交互。
  if (hasErrors(state)) return withMessage(state, '先修正标红的格子，再要提示');

  if (state.hint) {
    if (state.hint.level === 1) {
      return { ...state, hint: { ...state.hint, level: 2 }, updatedAt: Date.now() };
    }
    return reveal(state, state.hint);
  }

  const found = findHint(state.values, state.solution);
  if (!found) return withMessage(state, '盘面已经填满，没有可提示的格子');

  const hint: HintState = {
    level: 1,
    cell: found.cell,
    digit: found.digit,
    technique: found.technique,
    related: found.related,
    explanation: found.explanation,
  };

  return {
    ...state,
    hint,
    hints: state.hints + 1,
    selected: found.cell,
    message: null,
    updatedAt: Date.now(),
  };
}

export function togglePause(state: GameState): GameState {
  if (state.won) return state;
  return {
    ...state,
    paused: !state.paused,
    hint: null,
    message: null,
    updatedAt: Date.now(),
  };
}

export function pause(state: GameState): GameState {
  if (state.won || state.paused) return state;
  return { ...state, paused: true, hint: null, message: null, updatedAt: Date.now() };
}

export function resume(state: GameState): GameState {
  if (state.won || !state.paused) return state;
  return { ...state, paused: false, updatedAt: Date.now() };
}

export function tick(state: GameState, seconds = 1): GameState {
  if (!state.running || state.paused || state.won) return state;
  return { ...state, elapsed: state.elapsed + seconds };
}

/** 当前空格的候选数（位掩码），供键盘划掉与界面使用。 */
export function candidatesFor(state: GameState, cell: number): number {
  if (state.values[cell] !== 0) return 0;
  let used = 0;
  for (const peer of PEERS[cell]!) {
    const value = state.values[peer] ?? 0;
    if (value !== 0) used |= bitOf(value);
  }
  return ALL_DIGITS & ~used;
}

export function digitInPeers(values: ArrayLike<number>, cell: number, digit: number): boolean {
  for (const peer of PEERS[cell]!) {
    if (values[peer] === digit) return true;
  }
  return false;
}

/** 键盘角标：盘面上这个数字还剩几个没放。 */
export function remainingOf(state: GameState, digit: number): number {
  let placed = 0;
  for (let cell = 0; cell < 81; cell++) {
    if (state.values[cell] === digit) placed++;
  }
  return Math.max(0, 9 - placed);
}

function reveal(state: GameState, hint: HintState): GameState {
  const next = withUndo(state);
  next.values[hint.cell] = hint.digit;
  next.notes[hint.cell] = 0;
  next.errors[hint.cell] = 0;
  next.selected = hint.cell;
  next.reveals += 1;
  next.hint = null;
  next.running = true;
  next.message = `已揭示：${cellName(hint.cell)} = ${hint.digit}`;
  clearPeerNotes(next, hint.cell, hint.digit);

  if (gridsEqual(next.values, next.solution)) {
    next.won = true;
    next.running = false;
    next.paused = false;
    next.message = null;
  }
  next.updatedAt = Date.now();
  return next;
}

function withUndo(state: GameState): GameState {
  const snapshot: UndoSnapshot = {
    values: state.values.slice(),
    notes: state.notes.slice(),
    errors: state.errors.slice(),
  };
  const undo = [...state.undo, snapshot];
  if (undo.length > UNDO_LIMIT) undo.shift();
  return {
    ...state,
    values: state.values.slice(),
    notes: state.notes.slice(),
    errors: state.errors.slice(),
    undo,
  };
}

function clearPeerNotes(state: GameState, cell: number, digit: number): void {
  const bit = bitOf(digit);
  for (const peer of PEERS[cell]!) {
    state.notes[peer] = state.notes[peer]! & ~bit;
  }
}

function hasErrors(state: GameState): boolean {
  for (let cell = 0; cell < 81; cell++) if (state.errors[cell] !== 0) return true;
  return false;
}

function withMessage(state: GameState, message: string): GameState {
  return { ...state, message, updatedAt: Date.now() };
}

function isCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell <= 80;
}

function cellsEqual(a: number | null, b: number | null): boolean {
  return a === b;
}
