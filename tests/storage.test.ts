import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../src/storage/settings';
import {
  clearSave,
  deserializeGame,
  loadSave,
  serializeGame,
  storeSave,
} from '../src/storage/save';
import {
  addResult,
  aggregate,
  loadResults,
  recordResult,
  type Result,
} from '../src/storage/results';
import { memoryStore } from '../src/storage/store';
import { createGame, place } from '../src/game/game';
import { parseGrid } from '../src/engine/board';
import { generatePuzzle } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';
import type { Puzzle } from '../src/game/types';

const CLASSIC =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

function puzzle(): Puzzle {
  return {
    id: 'p1',
    difficulty: 'medium',
    givens: parseGrid(CLASSIC)!,
    solution: parseGrid(SOLUTION)!,
  };
}

describe('settings', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips every setting', () => {
    const store = memoryStore();
    const settings: Settings = { theme: 'day', haptics: false, sound: true, onboarded: true };
    saveSettings(store, settings);
    expect(loadSettings(store)).toEqual(settings);
  });

  it('repairs corrupt or partial settings', () => {
    const store = memoryStore();
    store.setItem('sudoku:settings:v1', '{"theme":"purple","haptics":0,"sound":"yes"}');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);

    store.setItem('sudoku:settings:v1', '{"theme":"day"}');
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, theme: 'day' });
  });

  it('survives invalid JSON', () => {
    const store = memoryStore();
    store.setItem('sudoku:settings:v1', '{');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('save', () => {
  it('round-trips an in-progress game including notes and undo', () => {
    let game = createGame(puzzle(), 111);
    game = place(game, 2, 4);
    game = place(game, 3, 9);
    const raw = serializeGame(game);
    const restored = deserializeGame(raw);
    expect(restored).not.toBeNull();
    expect(Array.from(restored!.values).join('')).toBe(Array.from(game.values).join(''));
    expect(Array.from(restored!.errors)).toEqual(Array.from(game.errors));
    expect(restored!.mistakes).toBe(1);
    expect(restored!.undo).toHaveLength(2);
    expect(restored!.createdAt).toBe(111);
    expect(restored!.difficulty).toBe('medium');
  });

  it('does not persist transient selection or hint state', () => {
    const game = createGame(puzzle(), 111);
    const restored = deserializeGame(serializeGame({ ...game, selected: 40, message: 'hi' }));
    expect(restored!.selected).toBeNull();
    expect(restored!.hint).toBeNull();
    expect(restored!.message).toBeNull();
  });

  it('rejects corrupt saves and clears them from storage', () => {
    const store = memoryStore();
    store.setItem('sudoku:save:v1', '{"v":1,"givens":"123"}');
    expect(loadSave(store)).toBeNull();
    expect(store.getItem('sudoku:save:v1')).toBeNull();
  });

  it('rejects a save whose solution does not match its givens', () => {
    const game = createGame(puzzle(), 111);
    const data = JSON.parse(serializeGame(game));
    data.solution = '1'.repeat(81);
    expect(deserializeGame(JSON.stringify(data))).toBeNull();
  });

  it('drops a finished game instead of saving it', () => {
    const store = memoryStore();
    const game = { ...createGame(puzzle(), 111), won: true };
    storeSave(store, game);
    expect(loadSave(store)).toBeNull();
  });

  it('clears the save on demand', () => {
    const store = memoryStore();
    const game = createGame(puzzle(), 111);
    storeSave(store, game);
    expect(loadSave(store)).not.toBeNull();
    clearSave(store);
    expect(loadSave(store)).toBeNull();
  });

  it('keeps a save generated from a real puzzle', () => {
    const store = memoryStore();
    const generated = generatePuzzle('expert', mulberry32(4));
    const game = createGame(
      {
        id: 'real',
        difficulty: 'expert',
        givens: generated.givens,
        solution: generated.solution,
      },
      42,
    );
    storeSave(store, place(game, 0, 0));
    const restored = loadSave(store);
    expect(restored).not.toBeNull();
    expect(restored!.difficulty).toBe('expert');
  });
});

describe('results', () => {
  const sample = (overrides: Partial<Result> = {}): Result => ({
    id: 'r1',
    difficulty: 'easy',
    timeSec: 120,
    mistakes: 1,
    hints: 2,
    reveals: 0,
    finishedAt: 1000,
    ...overrides,
  });

  it('records and reads back results, newest first', () => {
    const store = memoryStore();
    recordResult(store, sample({ id: 'a', finishedAt: 1 }));
    recordResult(store, sample({ id: 'b', finishedAt: 2 }));
    const results = loadResults(store);
    expect(results.map((result) => result.id)).toEqual(['b', 'a']);
  });

  it('aggregates per difficulty', () => {
    const store = memoryStore();
    recordResult(store, sample({ id: 'a', timeSec: 100, mistakes: 0, finishedAt: 1 }));
    recordResult(store, sample({ id: 'b', timeSec: 200, mistakes: 2, finishedAt: 2 }));
    recordResult(store, sample({ id: 'c', difficulty: 'hard', timeSec: 400, finishedAt: 3 }));
    const stats = aggregate(loadResults(store));
    expect(stats.easy.played).toBe(2);
    expect(stats.easy.bestTime).toBe(100);
    expect(stats.easy.averageTime).toBe(150);
    expect(stats.easy.averageMistakes).toBe(1);
    expect(stats.hard.played).toBe(1);
    expect(stats.medium.played).toBe(0);
  });

  it('drops corrupt entries but keeps good ones', () => {
    const store = memoryStore();
    store.setItem(
      'sudoku:results:v1',
      JSON.stringify([sample(), { nope: true }, { ...sample({ id: 'x' }), difficulty: 'insane' }]),
    );
    expect(loadResults(store).map((result) => result.id)).toEqual(['r1']);
  });

  it('caps the history instead of growing forever', () => {
    const store = memoryStore();
    for (let i = 0; i < 250; i++) {
      addResult(store, sample({ id: `r${i}`, finishedAt: i }));
    }
    const results = loadResults(store);
    expect(results).toHaveLength(200);
    expect(results[0]!.id).toBe('r249');
  });
});
