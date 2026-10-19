import { describe, expect, it } from 'vitest';
import {
  countSolutions,
  findHint,
  gradePuzzle,
  solve,
  solveLogically,
} from '../src/engine/solver';
import { parseGrid } from '../src/engine/board';
import { generatePuzzle } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';

const CLASSIC =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const CLASSIC_SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
// 26 个已知数、唯一解，四类技巧推进到 64 格后卡住（专家）。
const EXPERT_GIVENS =
  '480000000530020107007000806000000008000049005702001004000006000900070500000038021';
const EXPERT_SOLUTION =
  '489617352536824197217395846154263978863749215792581634321456789948172563675938421';

describe('solution counting', () => {
  it('finds exactly one solution for a well-formed puzzle', () => {
    expect(countSolutions(parseGrid(CLASSIC)!, 2)).toBe(1);
  });

  it('returns the known solution of the classic puzzle', () => {
    expect(Array.from(solve(parseGrid(CLASSIC)!)!).join('')).toBe(CLASSIC_SOLUTION);
  });

  it('stops counting an empty grid at the limit', () => {
    expect(countSolutions(new Uint8Array(81), 2)).toBe(2);
  });

  it('counts zero for a grid that already repeats a digit', () => {
    const grid = new Uint8Array(81);
    grid[0] = 5;
    grid[8] = 5;
    expect(countSolutions(grid, 2)).toBe(0);
    expect(solve(grid)).toBeNull();
  });

  it('counts a completed grid as exactly one solution', () => {
    expect(countSolutions(parseGrid(CLASSIC_SOLUTION)!, 2)).toBe(1);
  });
});

describe('technique grading', () => {
  it('grades a nearly complete grid as easy', () => {
    const values = parseGrid(CLASSIC_SOLUTION)!;
    values[40] = 0;
    const result = gradePuzzle(values);
    expect(result.difficulty).toBe('easy');
    expect(result.solved).toBe(true);
    expect(result.maxRank).toBe(1);
    expect(result.solution[40]).toBe(5);
  });

  it('keeps the solution of a graded puzzle', () => {
    const result = gradePuzzle(parseGrid(CLASSIC)!);
    expect(Array.from(result.solution).join('')).toBe(CLASSIC_SOLUTION);
    expect(result.solved).toBe(true);
    expect(result.stalled).toBe(false);
  });

  it('refuses to grade a puzzle with several solutions', () => {
    expect(() => gradePuzzle(new Uint8Array(81))).toThrow(/多个解/);
  });

  it('does not report a solved board as stalled', () => {
    const logic = solveLogically(parseGrid(CLASSIC_SOLUTION)!);
    expect(logic.solved).toBe(true);
    expect(logic.stalled).toBe(false);
    expect(logic.maxRank).toBe(0);
  });
});

describe('hints', () => {
  it('points at an empty cell and the correct digit', () => {
    const puzzle = parseGrid(CLASSIC)!;
    const solution = parseGrid(CLASSIC_SOLUTION)!;
    const hint = findHint(puzzle, solution);
    expect(hint).not.toBeNull();
    expect(puzzle[hint!.cell]).toBe(0);
    expect(hint!.digit).toBe(solution[hint!.cell]);
    expect(hint!.related.length).toBeGreaterThan(0);
    expect(hint!.explanation).toMatch(/R\dC\d/);
  });

  it('always reveals the digit from the solution when only one cell is empty', () => {
    const values = parseGrid(CLASSIC_SOLUTION)!;
    values[80] = 0;
    const hint = findHint(values, parseGrid(CLASSIC_SOLUTION)!);
    expect(hint?.cell).toBe(80);
    expect(hint?.digit).toBe(9);
    expect(hint?.technique).toBe('naked-single');
  });

  it('returns no hint when the board is complete', () => {
    expect(findHint(parseGrid(CLASSIC_SOLUTION)!, parseGrid(CLASSIC_SOLUTION)!)).toBeNull();
  });
});

describe('technique detection', () => {
  // 从一个唯一解盘面挖出 4 个空格：没有唯一余数，只有隐性唯一。
  const HIDDEN_SINGLE =
    '534070900072100040190302507050001420420053701700920006060537000007400035305000079';

  it('recognises a hidden single when no naked single exists', () => {
    const values = parseGrid(HIDDEN_SINGLE)!;
    const hint = findHint(values, parseGrid(CLASSIC_SOLUTION)!);
    expect(hint?.technique).toBe('hidden-single');
    expect(hint?.cell).toBe(7);
    expect(hint?.digit).toBe(1);
    expect(hint?.explanation).toContain('隐性唯一');
  });

  it('never suggests a digit other than the solution', () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
      const puzzle = generatePuzzle(difficulty, mulberry32(31));
      const values = puzzle.givens.slice();
      for (let guard = 0; guard < 90; guard++) {
        const hint = findHint(values, puzzle.solution);
        if (!hint) break;
        expect(values[hint.cell]).toBe(0);
        expect(hint.digit).toBe(puzzle.solution[hint.cell]);
        values[hint.cell] = hint.digit;
      }
      expect(values.every((value) => value !== 0)).toBe(true);
    }
  }, 30_000);

  it('degrades to a trial hint when the four techniques stall', () => {
    const givens = parseGrid(EXPERT_GIVENS)!;
    const solution = parseGrid(EXPERT_SOLUTION)!;
    const stalled = solveLogically(givens);
    expect(stalled.stalled).toBe(true);

    const trial = findHint(stalled.grid, solution);
    expect(trial?.technique).toBe('trial');
    expect(trial?.digit).toBe(solution[trial!.cell]);
    expect(trial?.explanation).toContain('试错');
  });
});
