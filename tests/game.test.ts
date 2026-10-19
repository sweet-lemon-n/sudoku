import { describe, expect, it } from 'vitest';
import {
  clearNotes,
  createGame,
  eraseCell,
  note,
  pause,
  place,
  requestHint,
  resume,
  selectCell,
  tick,
  undo,
  type GameState,
} from '../src/game/game';
import { parseGrid } from '../src/engine/board';
import type { Puzzle } from '../src/game/types';

const CLASSIC =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

function makePuzzle(): Puzzle {
  return {
    id: 'test',
    difficulty: 'easy',
    givens: parseGrid(CLASSIC)!,
    solution: parseGrid(SOLUTION)!,
  };
}

function fresh(): GameState {
  return createGame(makePuzzle(), 1000);
}

function fill(state: GameState, cells: number[]): GameState {
  let next = state;
  for (const cell of cells) {
    next = place(next, cell, makePuzzle().solution[cell]!);
  }
  return next;
}

describe('creating a game', () => {
  it('starts from the givens with a stopped clock', () => {
    const game = fresh();
    expect(Array.from(game.values).join('')).toBe(CLASSIC);
    expect(game.errors.some((error) => error === 1)).toBe(false);
    expect(game.notes.every((mask) => mask === 0)).toBe(true);
    expect(game.elapsed).toBe(0);
    expect(game.running).toBe(false);
    expect(game.won).toBe(false);
    expect(game.mistakes).toBe(0);
    expect(game.undo).toHaveLength(0);
  });
});

describe('placing digits', () => {
  it('records a correct digit and starts the clock', () => {
    const game = place(fresh(), 2, 4); // R1C3
    expect(game.values[2]).toBe(4);
    expect(game.errors[2]).toBe(0);
    expect(game.mistakes).toBe(0);
    expect(game.running).toBe(true);
    expect(game.lastPlaced).toBe(2);
  });

  it('marks a wrong digit, counts the mistake and keeps it in the cell', () => {
    const game = place(fresh(), 2, 9);
    expect(game.values[2]).toBe(9);
    expect(game.errors[2]).toBe(1);
    expect(game.mistakes).toBe(1);
  });

  it('never changes a given and explains why', () => {
    const game = place(fresh(), 0, 9);
    expect(game.values[0]).toBe(5);
    expect(game.message).toMatch(/已知数/);
    expect(game.mistakes).toBe(0);
  });

  it('clears peer notes and its own notes when a digit lands', () => {
    let game = note(fresh(), 2, 1); // R1C3
    game = note(game, 2, 4);
    game = note(game, 25, 1); // R3C8, same column as R1C8
    game = place(game, 3, 6); // correct 6 at R1C4: does not touch the 1s
    expect(game.notes[2]).toBe(0b1001);
    game = place(game, 7, 1); // R1C8 = 1; clears 1 from peers
    expect(game.notes[2]! & 0b1).toBe(0);
    expect(game.notes[25]! & 0b1).toBe(0);
  });

  it('ignores a placement outside 1..9 or into the same value', () => {
    const game = fresh();
    expect(place(game, 2, 0)).toBe(game);
    expect(place(game, 2, 10)).toBe(game);
    expect(place(place(game, 2, 4), 2, 4).undo).toHaveLength(1);
  });
});

describe('notes', () => {
  it('adds, removes and blocks candidates already used by peers', () => {
    let game = note(fresh(), 2, 1);
    expect(game.notes[2]).toBe(0b1);
    game = note(game, 2, 1);
    expect(game.notes[2]).toBe(0);

    game = note(game, 2, 5); // 5 is already in R1C1
    expect(game.notes[2]).toBe(0);
    expect(game.message).toMatch(/同行、同列或同宫/);
  });

  it('refuses to note a given or a filled cell', () => {
    expect(note(fresh(), 0, 1).notes[0]).toBe(0);
    const filled = place(fresh(), 2, 4);
    expect(note(filled, 2, 1).notes[2]).toBe(0);
  });

  it('starts the clock on the first note', () => {
    expect(note(fresh(), 2, 1).running).toBe(true);
  });
});

describe('erasing', () => {
  it('clears one cell and its notes but not givens', () => {
    let game = place(fresh(), 2, 9);
    game = note(game, 2, 1);
    game = eraseCell(game, 2);
    expect(game.values[2]).toBe(0);
    expect(game.notes[2]).toBe(0);
    expect(game.errors[2]).toBe(0);
    expect(game.mistakes).toBe(1);

    const given = eraseCell(fresh(), 0);
    expect(given.values[0]).toBe(5);
    expect(given.message).toMatch(/已知数/);
  });

  it('clears every note while keeping values and mistakes', () => {
    let game = place(fresh(), 2, 9);
    game = note(game, 3, 2);
    game = note(game, 10, 2);
    game = clearNotes(game);
    expect(game.notes.every((mask) => mask === 0)).toBe(true);
    expect(game.values[2]).toBe(9);
    expect(game.errors[2]).toBe(1);
    expect(game.message).toMatch(/2 个候选/);
  });

  it('says there is nothing to clear', () => {
    const game = clearNotes(fresh());
    expect(game.message).toMatch(/没有笔记/);
  });
});

describe('undo', () => {
  it('restores values, notes and errors but keeps the clock and statistics', () => {
    let game = note(fresh(), 3, 2);
    game = place(game, 3, 9); // wrong
    game = tick(game, 5);
    expect(game.mistakes).toBe(1);

    game = undo(game);
    expect(game.values[3]).toBe(0);
    expect(game.notes[3]).toBe(0b10);
    expect(game.errors[3]).toBe(0);
    expect(game.mistakes).toBe(1);
    expect(game.elapsed).toBe(5);
  });

  it('does nothing when history is empty', () => {
    const game = fresh();
    expect(undo(game)).toBe(game);
  });
});

describe('hints', () => {
  it('walks through highlight, explanation and reveal', () => {
    let game = requestHint(fresh());
    expect(game.hint?.level).toBe(1);
    expect(game.hints).toBe(1);
    expect(game.selected).toBe(game.hint?.cell);
    expect(game.hint?.related.length).toBeGreaterThan(0);

    game = requestHint(game);
    expect(game.hint?.level).toBe(2);
    expect(game.hints).toBe(1);
    expect(game.hint?.explanation.length).toBeGreaterThan(0);

    const target = game.hint!.cell;
    const digit = game.hint!.digit;
    game = requestHint(game);
    expect(game.hint).toBeNull();
    expect(game.values[target]).toBe(digit);
    expect(game.hints).toBe(1);
    expect(game.reveals).toBe(1);
    expect(game.message).toMatch(/已揭示/);
  });

  it('refuses to hint while a cell is wrong', () => {
    const game = requestHint(place(fresh(), 2, 9));
    expect(game.hint).toBeNull();
    expect(game.message).toMatch(/标红/);
    expect(game.hints).toBe(0);
  });

  it('counts the hint once even when the player asks twice and then reveals', () => {
    let game = requestHint(fresh());
    game = requestHint(game);
    game = requestHint(game);
    expect(game.hints).toBe(1);
    expect(game.reveals).toBe(1);
  });
});

describe('clock and pause', () => {
  it('counts seconds only while running and unpaused', () => {
    let game = tick(fresh(), 3);
    expect(game.elapsed).toBe(0);

    game = place(game, 2, 4);
    game = tick(game, 3);
    expect(game.elapsed).toBe(3);

    game = pause(game);
    game = tick(game, 10);
    expect(game.elapsed).toBe(3);
    expect(game.paused).toBe(true);

    game = resume(game);
    game = tick(game, 2);
    expect(game.elapsed).toBe(5);
  });
});

describe('winning', () => {
  it('marks the game won when the board matches the solution', () => {
    const solution = parseGrid(SOLUTION)!;
    const cells = Array.from({ length: 81 }, (_, cell) => cell).filter((cell) => solution[cell]! !== 0);
    let game = fresh();
    for (const cell of cells) {
      if (game.values[cell] === 0) game = place(game, cell, solution[cell]!);
    }
    expect(game.won).toBe(true);
    expect(game.running).toBe(false);
    expect(game.paused).toBe(false);
    expect(tick(game, 5).elapsed).toBe(game.elapsed);
  });
});

describe('selection', () => {
  it('toggles the selected cell', () => {
    const game = selectCell(fresh(), 40);
    expect(game.selected).toBe(40);
    expect(selectCell(game, 40).selected).toBeNull();
    expect(selectCell(game, null).selected).toBeNull();
  });
});
