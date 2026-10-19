import { formatGrid, gridsEqual, parseGrid } from '../engine/board';
import { countSolutions, solve, type Difficulty } from '../engine/solver';
import { DIFFICULTIES } from '../engine/solver';
import type { GameState, UndoSnapshot } from '../game/types';
import { SAVE_KEY } from './keys';
import { isRecord, type KeyValueStore } from './store';

const VERSION = 1;

interface SerializedUndo {
  values: string;
  notes: number[];
}

interface SerializedGame {
  v: number;
  id: string;
  difficulty: Difficulty;
  givens: string;
  solution: string;
  values: string;
  notes: number[];
  mistakes: number;
  hints: number;
  reveals: number;
  elapsed: number;
  running: boolean;
  paused: boolean;
  undo: SerializedUndo[];
  createdAt: number;
  updatedAt: number;
}

export function serializeGame(state: GameState): string {
  const data: SerializedGame = {
    v: VERSION,
    id: state.id,
    difficulty: state.difficulty,
    givens: formatGrid(state.givens),
    solution: formatGrid(state.solution),
    values: formatGrid(state.values),
    notes: Array.from(state.notes),
    mistakes: state.mistakes,
    hints: state.hints,
    reveals: state.reveals,
    elapsed: state.elapsed,
    running: state.running,
    paused: state.paused,
    undo: state.undo.map((snapshot) => ({
      values: formatGrid(snapshot.values),
      notes: Array.from(snapshot.notes),
    })),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
  return JSON.stringify(data);
}

export function deserializeGame(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== VERSION) return null;

  const { id, difficulty } = parsed;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isDifficulty(difficulty)) return null;

  const givens = asGrid(parsed.givens);
  const solution = asGrid(parsed.solution);
  const values = asGrid(parsed.values);
  if (!givens || !solution || !values) return null;

  if (!isCompleteSolution(solution)) return null;
  if (countSolutions(givens, 2) !== 1) return null;
  const canonical = solve(givens);
  if (!canonical || !gridsEqual(canonical, solution)) return null;

  for (let cell = 0; cell < 81; cell++) {
    if (givens[cell] !== 0 && values[cell] !== givens[cell]) return null;
  }

  const notes = asNotes(parsed.notes);
  if (!notes) return null;
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell] !== 0 && notes[cell] !== 0) notes[cell] = 0;
  }

  const mistakes = asCount(parsed.mistakes);
  const hints = asCount(parsed.hints);
  const reveals = asCount(parsed.reveals);
  const elapsed = asCount(parsed.elapsed);
  const createdAt = asTimestamp(parsed.createdAt);
  const updatedAt = asTimestamp(parsed.updatedAt);
  if (
    mistakes === null ||
    hints === null ||
    reveals === null ||
    elapsed === null ||
    createdAt === null ||
    updatedAt === null ||
    typeof parsed.running !== 'boolean' ||
    typeof parsed.paused !== 'boolean'
  ) {
    return null;
  }

  const undo = asUndo(parsed.undo, givens, solution);
  if (!undo) return null;

  let complete = true;
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell] === 0) {
      complete = false;
      break;
    }
  }
  if (complete && gridsEqual(values, solution)) return null;

  const errors = new Uint8Array(81);
  for (let cell = 0; cell < 81; cell++) {
    if (values[cell] !== 0 && values[cell] !== solution[cell]) errors[cell] = 1;
  }

  return {
    id,
    difficulty,
    givens,
    solution,
    values,
    notes,
    errors,
    selected: null,
    hint: null,
    message: null,
    mistakes,
    hints,
    reveals,
    elapsed,
    running: parsed.running,
    paused: parsed.paused,
    won: false,
    undo,
    createdAt,
    updatedAt,
  };
}

export function storeSave(store: KeyValueStore, state: GameState): void {
  if (state.won) {
    store.removeItem(SAVE_KEY);
    return;
  }
  try {
    store.setItem(SAVE_KEY, serializeGame(state));
  } catch {
    /* 存储失败不影响当前对局 */
  }
}

export function loadSave(store: KeyValueStore): GameState | null {
  const raw = store.getItem(SAVE_KEY);
  if (raw === null) return null;
  const game = deserializeGame(raw);
  if (!game) {
    store.removeItem(SAVE_KEY);
    return null;
  }
  return game;
}

export function clearSave(store: KeyValueStore): void {
  store.removeItem(SAVE_KEY);
}

function asGrid(value: unknown): Uint8Array | null {
  return typeof value === 'string' ? parseGrid(value) : null;
}

function asNotes(value: unknown): Uint16Array | null {
  if (!Array.isArray(value) || value.length !== 81) return null;
  const notes = new Uint16Array(81);
  for (let cell = 0; cell < 81; cell++) {
    const mask = value[cell];
    if (typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0 || mask > 0b1_1111_1111) {
      return null;
    }
    notes[cell] = mask;
  }
  return notes;
}

function asUndo(
  value: unknown,
  givens: Uint8Array,
  solution: Uint8Array,
): UndoSnapshot[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  const undo: UndoSnapshot[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const values = asGrid(entry.values);
    const notes = asNotes(entry.notes);
    if (!values || !notes) return null;
    for (let cell = 0; cell < 81; cell++) {
      if (givens[cell] !== 0 && values[cell] !== givens[cell]) return null;
    }
    const errors = new Uint8Array(81);
    for (let cell = 0; cell < 81; cell++) {
      if (values[cell] !== 0 && values[cell] !== solution[cell]) errors[cell] = 1;
    }
    undo.push({ values, notes, errors });
  }
  return undo;
}

function isCompleteSolution(solution: Uint8Array): boolean {
  for (let cell = 0; cell < 81; cell++) {
    if (solution[cell] === 0) return false;
  }
  return countSolutions(solution, 2) === 1;
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000_000
    ? value
    : null;
}

function asTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
