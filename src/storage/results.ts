import { DIFFICULTIES, type Difficulty } from '../engine/solver';
import { makeId } from '../util/id';
import { RESULTS_KEY } from './keys';
import { readJson, writeJson, type KeyValueStore } from './store';

export interface Result {
  id: string;
  difficulty: Difficulty;
  timeSec: number;
  mistakes: number;
  hints: number;
  reveals: number;
  finishedAt: number;
}

export interface DifficultyStats {
  played: number;
  bestTime: number | null;
  averageTime: number | null;
  averageMistakes: number | null;
  averageHints: number | null;
  averageReveals: number | null;
}

export type Stats = Record<Difficulty, DifficultyStats>;

export type NewResult = Omit<Result, 'id' | 'finishedAt'> &
  Partial<Pick<Result, 'id' | 'finishedAt'>>;

const LIMIT = 200;

export function loadResults(store: KeyValueStore): Result[] {
  return readAll(store).sort((a, b) => b.finishedAt - a.finishedAt);
}

export function recordResult(store: KeyValueStore, input: NewResult): Result {
  const result: Result = {
    id: input.id ?? makeId(),
    difficulty: input.difficulty,
    timeSec: Math.max(0, Math.round(input.timeSec)),
    mistakes: Math.max(0, Math.round(input.mistakes)),
    hints: Math.max(0, Math.round(input.hints)),
    reveals: Math.max(0, Math.round(input.reveals)),
    finishedAt: input.finishedAt ?? Date.now(),
  };
  addResult(store, result);
  return result;
}

export function addResult(store: KeyValueStore, result: Result): void {
  if (!isValid(result)) return;
  const next = [...readAll(store), result]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, LIMIT);
  writeJson(store, RESULTS_KEY, next);
}

export function clearResults(store: KeyValueStore): void {
  store.removeItem(RESULTS_KEY);
}

export function aggregate(results: Result[]): Stats {
  const stats = emptyStats();
  for (const result of results) {
    const slot = stats[result.difficulty];
    slot.played += 1;
    if (slot.bestTime === null || result.timeSec < slot.bestTime) slot.bestTime = result.timeSec;
    slot.averageTime = (slot.averageTime ?? 0) + result.timeSec;
    slot.averageMistakes = (slot.averageMistakes ?? 0) + result.mistakes;
    slot.averageHints = (slot.averageHints ?? 0) + result.hints;
    slot.averageReveals = (slot.averageReveals ?? 0) + result.reveals;
  }
  for (const difficulty of DIFFICULTIES) {
    const slot = stats[difficulty];
    if (slot.played === 0) continue;
    slot.averageTime = Math.round((slot.averageTime ?? 0) / slot.played);
    slot.averageMistakes = round1((slot.averageMistakes ?? 0) / slot.played);
    slot.averageHints = round1((slot.averageHints ?? 0) / slot.played);
    slot.averageReveals = round1((slot.averageReveals ?? 0) / slot.played);
  }
  return stats;
}

function readAll(store: KeyValueStore): Result[] {
  const raw = readJson(store, RESULTS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValid);
}

function emptyStats(): Stats {
  return {
    easy: emptySlot(),
    medium: emptySlot(),
    hard: emptySlot(),
    expert: emptySlot(),
  };
}

function emptySlot(): DifficultyStats {
  return {
    played: 0,
    bestTime: null,
    averageTime: null,
    averageMistakes: null,
    averageHints: null,
    averageReveals: null,
  };
}

function isValid(value: unknown): value is Result {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.difficulty === 'string' &&
    (DIFFICULTIES as readonly string[]).includes(record.difficulty) &&
    isCount(record.timeSec) &&
    isCount(record.mistakes) &&
    isCount(record.hints) &&
    isCount(record.reveals) &&
    typeof record.finishedAt === 'number' &&
    Number.isFinite(record.finishedAt)
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
