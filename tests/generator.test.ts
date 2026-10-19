import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';
import { DIFFICULTIES, countSolutions, solveLogically } from '../src/engine/solver';
import { UNITS, bitOf, candidatesOf, popcount } from '../src/engine/board';

/** 测试侧独立的“只用单数”求解器，不复用引擎的候选数增量逻辑。 */
function solveWithSinglesOnly(values: Uint8Array): boolean {
  const grid = values.slice();
  for (let guard = 0; guard < 200; guard++) {
    const candidates = candidatesOf(grid);
    let progress = false;

    for (let cell = 0; cell < 81; cell++) {
      if (grid[cell] !== 0) continue;
      const mask = candidates[cell]!;
      if (popcount(mask) === 1) {
        grid[cell] = Math.log2(mask) + 1;
        progress = true;
        break;
      }
    }
    if (progress) continue;

    outer: for (let unit = 0; unit < UNITS.length; unit++) {
      for (let digit = 1; digit <= 9; digit++) {
        let placed = false;
        for (const cell of UNITS[unit]!) if (grid[cell] === digit) placed = true;
        if (placed) continue;
        const spots = UNITS[unit]!.filter((cell) => candidates[cell]! & bitOf(digit));
        if (spots.length === 1) {
          grid[spots[0]!] = digit;
          progress = true;
          break outer;
        }
      }
    }
    if (!progress) return grid.every((value) => value !== 0);
  }
  return false;
}

describe('puzzle generation', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`makes a unique ${difficulty} puzzle whose grade matches`, () => {
      const puzzle = generatePuzzle(difficulty, mulberry32(12345));

      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.clues).toBeGreaterThanOrEqual(20);
      expect(puzzle.clues).toBeLessThanOrEqual(42);
      expect(countSolutions(puzzle.givens, 2)).toBe(1);

      for (let cell = 0; cell < 81; cell++) {
        if (puzzle.givens[cell] !== 0) expect(puzzle.givens[cell]).toBe(puzzle.solution[cell]);
      }

      const logic = solveLogically(puzzle.givens);
      if (logic.solved) {
        expect(Array.from(logic.grid).join('')).toBe(Array.from(puzzle.solution).join(''));
      }
      if (difficulty === 'expert') {
        expect(logic.stalled).toBe(true);
        expect(logic.solved).toBe(false);
      } else {
        expect(logic.solved).toBe(true);
      }
      if (difficulty === 'easy') {
        expect(solveWithSinglesOnly(puzzle.givens)).toBe(true);
        expect(logic.maxRank).toBe(1);
      } else if (difficulty === 'medium') {
        expect(logic.maxRank).toBe(2);
      } else if (difficulty === 'hard') {
        expect(logic.maxRank).toBe(3);
      }
    }, 30_000);
  }

  it('produces different puzzles for different seeds', () => {
    const a = generatePuzzle('easy', mulberry32(1));
    const b = generatePuzzle('easy', mulberry32(2));
    expect(Array.from(a.givens).join('')).not.toBe(Array.from(b.givens).join(''));
  });

  it('always stores the unique solution of its givens', () => {
    const rng = mulberry32(7);
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generatePuzzle(difficulty, rng);
      expect(countSolutions(puzzle.givens, 2)).toBe(1);
      expect(Array.from(puzzle.solution).join('')).toHaveLength(81);
    }
  });
});
