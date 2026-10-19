/** 生成唯一解、按技巧分级的题面。 */

import { CELL_COUNT } from './board';
import type { Rng } from './rng';
import {
  countSolutions,
  generateSolved,
  gradePuzzle,
  type Difficulty,
} from './solver';

export interface GeneratedPuzzle {
  givens: Uint8Array;
  solution: Uint8Array;
  difficulty: Difficulty;
  clues: number;
}

const TIME_BUDGET_MS = 8000;
const MAX_ATTEMPTS = 40;
const EASY_BASE_ATTEMPTS = 12;

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };

/**
 * 已知数只用于控制视觉密度：难度与成题与否只由技巧等级决定。
 * 这里只有上限，以及“简单”需要的最低密度，避免它长得像空盘。
 */
const MAX_CLUES: Record<Difficulty, number> = {
  easy: 42,
  medium: 38,
  hard: 34,
  expert: 32,
};
const EASY_MIN_CLUES = 32;

export function generatePuzzle(difficulty: Difficulty, rng: Rng): GeneratedPuzzle {
  const deadline = Date.now() + TIME_BUDGET_MS;

  if (difficulty === 'easy') {
    return buildEasy(rng, deadline, MAX_ATTEMPTS);
  }

  if (difficulty === 'medium') {
    // 中等：从简单题出发移除已知数，直到恰好需要区块排除。
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline) break;
      const base = buildEasy(rng, deadline, EASY_BASE_ATTEMPTS);
      const escalated = escalate(base, difficulty, rng);
      if (escalated) return escalated;
    }
  } else {
    // 困难/专家：最小盘通常已经很难；困难再从专家盘补回已知数。
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline) break;
      const minimal = buildMinimal(rng);
      const graded = gradePuzzle(minimal.givens);
      const maxClues = MAX_CLUES[difficulty];
      let clues = minimal.clues;

      if (graded.difficulty === difficulty) {
        if (clues <= maxClues) {
          return { ...minimal, difficulty, clues };
        }
        continue;
      }
      if (difficulty !== 'hard' || graded.difficulty !== 'expert') continue;

      const removed = rng.shuffle(
        Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
          (cell) => minimal.givens[cell] === 0,
        ),
      );
      let current: Difficulty = graded.difficulty;
      for (const cell of removed) {
        if (clues >= maxClues) break;
        minimal.givens[cell] = minimal.solution[cell]!;
        clues++;
        const next = gradePuzzle(minimal.givens);
        current = next.difficulty;
        if (current === 'hard') break;
        if (RANK[current] < RANK.hard) break;
      }
      if (current === 'hard') {
        return { ...minimal, difficulty, clues };
      }
    }
  }

  throw new Error(`生成${difficulty}题面超时`);
}

/** 生成一档“只靠唯一余数/隐性唯一就能解”的题面。 */
function buildEasy(rng: Rng, deadline: number, maxAttempts: number): GeneratedPuzzle {
  const minClues = EASY_MIN_CLUES;
  const maxClues = MAX_CLUES.easy;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (Date.now() > deadline) break;
    const solution = generateSolved(rng);
    const puzzle = solution.slice();
    const order = rng.shuffle(Array.from({ length: CELL_COUNT }, (_, cell) => cell));
    const removed: number[] = [];

    for (const cell of order) {
      puzzle[cell] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[cell] = solution[cell]!;
      } else {
        removed.push(cell);
      }
    }

    let graded = gradePuzzle(puzzle);
    let clues = countClues(puzzle);
    if (graded.difficulty !== 'easy') {
      // 最小盘偏难时补回已知数，直到变回简单。补过头就重新来。
      for (const cell of removed) {
        if (clues >= maxClues) break;
        puzzle[cell] = solution[cell]!;
        clues++;
        graded = gradePuzzle(puzzle);
        if (graded.difficulty === 'easy') break;
      }
    }
    if (graded.difficulty !== 'easy') continue;

    // 补到最低密度，让“简单”看起来不至于太空。
    for (const cell of removed) {
      if (clues >= minClues) break;
      if (puzzle[cell] !== 0) continue;
      puzzle[cell] = solution[cell]!;
      clues++;
    }
    if (clues < minClues || clues > maxClues) continue;
    graded = gradePuzzle(puzzle);
    if (graded.difficulty !== 'easy') continue;

    return { givens: puzzle, solution, difficulty: 'easy', clues };
  }

  throw new Error('生成简单题面超时');
}

function buildMinimal(rng: Rng): GeneratedPuzzle {
  const solution = generateSolved(rng);
  const puzzle = solution.slice();
  const order = rng.shuffle(Array.from({ length: CELL_COUNT }, (_, cell) => cell));
  for (const cell of order) {
    puzzle[cell] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[cell] = solution[cell]!;
    }
  }
  return { givens: puzzle, solution, difficulty: 'expert', clues: countClues(puzzle) };
}

function escalate(
  base: GeneratedPuzzle,
  target: Difficulty,
  rng: Rng,
): GeneratedPuzzle | null {
  const puzzle = base.givens.slice();
  const solution = base.solution;
  const maxClues = MAX_CLUES[target];
  const cells = rng.shuffle(
    Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter((cell) => puzzle[cell] !== 0),
  );

  let clues = base.clues;
  let current: Difficulty = base.difficulty;

  for (const cell of cells) {
    if (current === target) break;
    const backup = puzzle[cell]!;
    puzzle[cell] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[cell] = backup;
      continue;
    }
    const graded = gradePuzzle(puzzle);
    if (RANK[graded.difficulty] > RANK[target]) {
      // 越过目标档（例如从简单直接跳到困难），撤回这一格。
      puzzle[cell] = backup;
      continue;
    }
    clues--;
    current = graded.difficulty;
  }

  if (current !== target) return null;
  if (clues > maxClues) return null;
  return { givens: puzzle, solution, difficulty: target, clues };
}

function countClues(puzzle: Uint8Array): number {
  let clues = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) if (puzzle[cell] !== 0) clues++;
  return clues;
}
