/** 求解、技巧推理、难度分级与提示选择。纯逻辑，不依赖浏览器。 */

import {
  ALL_DIGITS,
  CELL_COUNT,
  PEERS,
  UNITS,
  bitOf,
  candidatesOf,
  cellName,
  digitsOf,
  popcount,
  rowOf,
  colOf,
  boxOf,
} from './board';
import type { Rng } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  expert: '专家',
};

export type Technique =
  | 'naked-single'
  | 'hidden-single'
  | 'locked-candidates'
  | 'naked-pair'
  | 'hidden-pair';

export const TECHNIQUE_LABEL: Record<Technique, string> = {
  'naked-single': '唯一余数',
  'hidden-single': '隐性唯一',
  'locked-candidates': '区块排除',
  'naked-pair': '数对',
  'hidden-pair': '隐性数对',
};

const TECHNIQUE_RANK: Record<Technique, 1 | 2 | 3> = {
  'naked-single': 1,
  'hidden-single': 1,
  'locked-candidates': 2,
  'naked-pair': 3,
  'hidden-pair': 3,
};

export interface Elimination {
  cell: number;
  digits: number[];
}

export interface LogicStep {
  technique: Technique;
  rank: 1 | 2 | 3;
  /** 单数技巧是要填的格；排除技巧是首个参与格。 */
  cell: number;
  /** 单数技巧要填的数字；排除技巧为 null。 */
  digit: number | null;
  unit: number | null;
  cells: number[];
  related: number[];
  eliminations: Elimination[];
  explanation: string;
}

export interface Hint {
  technique: Technique | 'trial';
  cell: number;
  digit: number;
  related: number[];
  explanation: string;
}

export interface LogicResult {
  grid: Uint8Array;
  solved: boolean;
  stalled: boolean;
  maxRank: 0 | 1 | 2 | 3;
  steps: number;
}

export interface GradeResult extends LogicResult {
  difficulty: Difficulty;
  solution: Uint8Array;
}

/** 解的数量，最多数到 limit 个。空盘、多解盘会很快返回。 */
export function countSolutions(values: ArrayLike<number>, limit = 2): number {
  if (limit < 1) return 0;
  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);
  const grid = new Uint8Array(CELL_COUNT);

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = values[cell] ?? 0;
    if (value < 0 || value > 9) return 0;
    grid[cell] = value;
    if (value === 0) continue;
    const bit = bitOf(value);
    const row = rowOf(cell);
    const col = colOf(cell);
    const box = boxOf(cell);
    if ((rowMask[row]! | colMask[col]! | boxMask[box]!) & bit) return 0;
    rowMask[row]! |= bit;
    colMask[col]! |= bit;
    boxMask[box]! |= bit;
  }

  let found = 0;

  const search = (): void => {
    let bestCell = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (grid[cell] !== 0) continue;
      const mask =
        ALL_DIGITS &
        ~(rowMask[rowOf(cell)]! | colMask[colOf(cell)]! | boxMask[boxOf(cell)]!);
      const count = popcount(mask);
      if (count === 0) return;
      if (count < bestCount) {
        bestCount = count;
        bestCell = cell;
        bestMask = mask;
        if (count === 1) break;
      }
    }

    if (bestCell === -1) {
      found++;
      return;
    }

    const row = rowOf(bestCell);
    const col = colOf(bestCell);
    const box = boxOf(bestCell);
    let mask = bestMask;
    while (mask && found < limit) {
      const bit = mask & -mask;
      mask ^= bit;
      grid[bestCell] = bitToDigit(bit);
      rowMask[row]! |= bit;
      colMask[col]! |= bit;
      boxMask[box]! |= bit;

      search();

      grid[bestCell] = 0;
      rowMask[row]! &= ~bit;
      colMask[col]! &= ~bit;
      boxMask[box]! &= ~bit;
    }
  };

  search();
  return found;
}

/** 找出一个解；无解返回 null。用于校验与生成答案。 */
export function solve(values: ArrayLike<number>): Uint8Array | null {
  let result: Uint8Array | null = null;
  const grid = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) grid[cell] = values[cell] ?? 0;

  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = grid[cell]!;
    if (value === 0) continue;
    const bit = bitOf(value);
    if ((rowMask[rowOf(cell)]! | colMask[colOf(cell)]! | boxMask[boxOf(cell)]!) & bit) {
      return null;
    }
    rowMask[rowOf(cell)]! |= bit;
    colMask[colOf(cell)]! |= bit;
    boxMask[boxOf(cell)]! |= bit;
  }

  const search = (): boolean => {
    let bestCell = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (grid[cell] !== 0) continue;
      const mask =
        ALL_DIGITS &
        ~(rowMask[rowOf(cell)]! | colMask[colOf(cell)]! | boxMask[boxOf(cell)]!);
      const count = popcount(mask);
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        bestCell = cell;
        bestMask = mask;
        if (count === 1) break;
      }
    }
    if (bestCell === -1) {
      result = grid.slice();
      return true;
    }
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      grid[bestCell] = bitToDigit(bit);
      rowMask[rowOf(bestCell)]! |= bit;
      colMask[colOf(bestCell)]! |= bit;
      boxMask[boxOf(bestCell)]! |= bit;
      if (search()) return true;
      grid[bestCell] = 0;
      rowMask[rowOf(bestCell)]! &= ~bit;
      colMask[colOf(bestCell)]! &= ~bit;
      boxMask[boxOf(bestCell)]! &= ~bit;
    }
    return false;
  };

  return search() ? result : null;
}

/** 用随机顺序回溯生成一个完整终局。 */
export function generateSolved(rng: Rng): Uint8Array {
  const solution = solveRandomized(rng);
  if (!solution) throw new Error('无法生成终局');
  return solution;
}

function solveRandomized(rng: Rng): Uint8Array | null {
  const grid = new Uint8Array(CELL_COUNT);
  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);

  const search = (): boolean => {
    let bestCell = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (grid[cell] !== 0) continue;
      const mask =
        ALL_DIGITS &
        ~(rowMask[rowOf(cell)]! | colMask[colOf(cell)]! | boxMask[boxOf(cell)]!);
      const count = popcount(mask);
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        bestCell = cell;
        bestMask = mask;
      }
    }
    if (bestCell === -1) return true;
    const digits = digitsOf(bestMask);
    rng.shuffle(digits);
    for (const digit of digits) {
      const bit = bitOf(digit);
      grid[bestCell] = digit;
      rowMask[rowOf(bestCell)]! |= bit;
      colMask[colOf(bestCell)]! |= bit;
      boxMask[boxOf(bestCell)]! |= bit;
      if (search()) return true;
      grid[bestCell] = 0;
      rowMask[rowOf(bestCell)]! &= ~bit;
      colMask[colOf(bestCell)]! &= ~bit;
      boxMask[boxOf(bestCell)]! &= ~bit;
    }
    return false;
  };

  return search() ? grid : null;
}

/**
 * 只用四类技巧推进盘面，记录最高技巧等级。
 * 无法推进时 stalled=true（唯一解时即为“专家”）。
 */
export function solveLogically(values: ArrayLike<number>): LogicResult {
  const grid = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) grid[cell] = values[cell] ?? 0;
  const candidates = candidatesOf(grid);
  let maxRank: 0 | 1 | 2 | 3 = 0;
  let steps = 0;

  for (;;) {
    if (isComplete(grid)) {
      return { grid, solved: true, stalled: false, maxRank, steps };
    }
    const step = findStep(grid, candidates);
    if (!step) {
      return { grid, solved: false, stalled: true, maxRank, steps };
    }
    applyStep(step, grid, candidates);
    maxRank = Math.max(maxRank, step.rank) as 0 | 1 | 2 | 3;
    steps++;
  }
}

/** 校验唯一解并给出难度。非唯一解会抛错。 */
export function gradePuzzle(values: ArrayLike<number>): GradeResult {
  const solutions = countSolutions(values, 2);
  if (solutions !== 1) {
    throw new Error(solutions === 0 ? '题面无解' : '题面有多个解');
  }
  const solution = solve(values);
  if (!solution) throw new Error('题面无解');
  const logic = solveLogically(values);
  if (logic.solved && !sameGrid(logic.grid, solution)) {
    throw new Error('技巧求解结果与唯一解不一致');
  }
  return { ...logic, difficulty: difficultyOf(logic), solution };
}

export function difficultyOf(result: LogicResult): Difficulty {
  if (result.stalled) return 'expert';
  if (result.maxRank >= 3) return 'hard';
  if (result.maxRank === 2) return 'medium';
  return 'easy';
}

/** 在当前盘面上找一个提示；没有可用技巧时返回试错提示。 */
export function findHint(values: ArrayLike<number>, solution: ArrayLike<number>): Hint | null {
  const candidates = candidatesOf(values);
  const step = findStep(values, candidates);
  if (step) {
    if (step.digit !== null) {
      return {
        technique: step.technique,
        cell: step.cell,
        digit: step.digit,
        related: step.related,
        explanation: step.explanation,
      };
    }
    const cell = step.cells.find((c) => (values[c] ?? 0) === 0) ?? step.cell;
    const digit = solution[cell] ?? 0;
    if (digit === 0) return null;
    return {
      technique: step.technique,
      cell,
      digit,
      related: step.related,
      explanation: step.explanation,
    };
  }

  const empty = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
    (cell) => (values[cell] ?? 0) === 0,
  );
  if (empty.length === 0) return null;
  const cell = empty[0]!;
  const digit = solution[cell] ?? 0;
  if (digit === 0) return null;
  return {
    technique: 'trial',
    cell,
    digit,
    related: [cell, ...PEERS[cell]!],
    explanation: `${cellName(cell)} 这一步没有唯一余数、隐性唯一、区块排除或数对可用，需要试错才能继续。`,
  };
}

/* ------------------------------------------------------------------ */
/* 技巧检测与施加                                                       */
/* ------------------------------------------------------------------ */

function findStep(values: ArrayLike<number>, candidates: Uint16Array): LogicStep | null {
  return (
    findNakedSingle(candidates) ??
    findHiddenSingle(values, candidates) ??
    findLockedCandidates(values, candidates) ??
    findNakedPair(values, candidates) ??
    findHiddenPair(values, candidates)
  );
}

function findNakedSingle(candidates: Uint16Array): LogicStep | null {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const mask = candidates[cell]!;
    if (popcount(mask) === 1) {
      const digit = digitsOf(mask)[0]!;
      return {
        technique: 'naked-single',
        rank: 1,
        cell,
        digit,
        unit: null,
        cells: [cell],
        related: [cell, ...PEERS[cell]!],
        eliminations: [],
        explanation: `${cellName(cell)} 只剩 ${digit} 可填（唯一余数）。`,
      };
    }
  }
  return null;
}

function findHiddenSingle(values: ArrayLike<number>, candidates: Uint16Array): LogicStep | null {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const cells = UNITS[unit]!;
    let seen = 0;
    for (const cell of cells) {
      const value = values[cell] ?? 0;
      if (value !== 0) seen |= bitOf(value);
    }
    for (let digit = 1; digit <= 9; digit++) {
      const bit = bitOf(digit);
      if (seen & bit) continue;
      let target = -1;
      let count = 0;
      for (const cell of cells) {
        if (candidates[cell]! & bit) {
          target = cell;
          count++;
          if (count > 1) break;
        }
      }
      if (count === 1) {
        return {
          technique: 'hidden-single',
          rank: 1,
          cell: target,
          digit,
          unit,
          cells: [...cells],
          related: [...cells],
          eliminations: [],
          explanation: `${unitName(unit)}只有 ${cellName(target)} 能填 ${digit}（隐性唯一）。`,
        };
      }
    }
  }
  return null;
}

function findLockedCandidates(
  values: ArrayLike<number>,
  candidates: Uint16Array,
): LogicStep | null {
  // 指向：某宫的某数字只能落在同一行/列，排除该行/列宫外的候选。
  for (let box = 0; box < 9; box++) {
    const unit = 18 + box;
    const cells = UNITS[unit]!;
    for (let digit = 1; digit <= 9; digit++) {
      const bit = bitOf(digit);
      if (unitHasValue(values, cells, digit)) continue;
      const spots = cells.filter((cell) => candidates[cell]! & bit);
      if (spots.length < 2) continue;

      const rows = new Set(spots.map(rowOf));
      const cols = new Set(spots.map(colOf));
      if (rows.size === 1) {
        const row = [...rows][0]!;
        const eliminations = collectEliminations(
          candidates,
          UNITS[row]!,
          cells,
          bit,
        );
        if (eliminations.length > 0) {
          return {
            technique: 'locked-candidates',
            rank: 2,
            cell: spots[0]!,
            digit: null,
            unit,
            cells: [...spots],
            related: uniqueCells([...cells, ...UNITS[row]!]),
            eliminations,
            explanation: `${unitName(unit)}的 ${digit} 只能落在第 ${row + 1} 行，因此第 ${row + 1} 行宫外的格子可以排除 ${digit}。`,
          };
        }
      }
      if (cols.size === 1) {
        const col = [...cols][0]!;
        const eliminations = collectEliminations(
          candidates,
          UNITS[9 + col]!,
          cells,
          bit,
        );
        if (eliminations.length > 0) {
          return {
            technique: 'locked-candidates',
            rank: 2,
            cell: spots[0]!,
            digit: null,
            unit,
            cells: [...spots],
            related: uniqueCells([...cells, ...UNITS[9 + col]!]),
            eliminations,
            explanation: `${unitName(unit)}的 ${digit} 只能落在第 ${col + 1} 列，因此第 ${col + 1} 列宫外的格子可以排除 ${digit}。`,
          };
        }
      }
    }
  }

  // 占位：某行/列的某数字只能落在同一宫，排除该宫其余格。
  for (let line = 0; line < 18; line++) {
    const cells = UNITS[line]!;
    for (let digit = 1; digit <= 9; digit++) {
      const bit = bitOf(digit);
      if (unitHasValue(values, cells, digit)) continue;
      const spots = cells.filter((cell) => candidates[cell]! & bit);
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxOf));
      if (boxes.size !== 1) continue;
      const box = [...boxes][0]!;
      const boxUnit = 18 + box;
      const eliminations = collectEliminations(candidates, UNITS[boxUnit]!, cells, bit);
      if (eliminations.length > 0) {
        return {
          technique: 'locked-candidates',
          rank: 2,
          cell: spots[0]!,
          digit: null,
          unit: line,
          cells: [...spots],
          related: uniqueCells([...cells, ...UNITS[boxUnit]!]),
          eliminations,
          explanation: `${unitName(line)}的 ${digit} 只能落在${unitName(boxUnit)}内，因此${unitName(boxUnit)}其余格可以排除 ${digit}。`,
        };
      }
    }
  }

  return null;
}

function findNakedPair(values: ArrayLike<number>, candidates: Uint16Array): LogicStep | null {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const cells = UNITS[unit]!;
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i]!;
      if ((values[a] ?? 0) !== 0) continue;
      if (popcount(candidates[a]!) !== 2) continue;
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j]!;
        if ((values[b] ?? 0) !== 0) continue;
        if (candidates[b] !== candidates[a]) continue;
        const digits = digitsOf(candidates[a]!);
        const eliminations: Elimination[] = [];
        for (const other of cells) {
          if (other === a || other === b) continue;
          const hits = digits.filter((digit) => candidates[other]! & bitOf(digit));
          if (hits.length > 0) eliminations.push({ cell: other, digits: hits });
        }
        if (eliminations.length > 0) {
          return {
            technique: 'naked-pair',
            rank: 3,
            cell: a,
            digit: null,
            unit,
            cells: [a, b],
            related: [...cells],
            eliminations,
            explanation: `${cellName(a)} 与 ${cellName(b)} 的候选都只有 ${digits.join('、')}，因此${unitName(unit)}其余格可以排除这两个数字（数对）。`,
          };
        }
      }
    }
  }
  return null;
}

function findHiddenPair(values: ArrayLike<number>, candidates: Uint16Array): LogicStep | null {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const cells = UNITS[unit]!;
    const open = cells.filter((cell) => (values[cell] ?? 0) === 0);
    for (let i = 0; i < 9; i++) {
      const digitA = i + 1;
      const bitA = bitOf(digitA);
      const spotsA = open.filter((cell) => candidates[cell]! & bitA);
      if (spotsA.length !== 2) continue;
      for (let j = i + 1; j < 9; j++) {
        const digitB = j + 1;
        const bitB = bitOf(digitB);
        const spotsB = open.filter((cell) => candidates[cell]! & bitB);
        if (spotsB.length !== 2) continue;
        if (spotsA[0] !== spotsB[0] || spotsA[1] !== spotsB[1]) continue;
        const pairMask = bitA | bitB;
        const eliminations: Elimination[] = [];
        for (const cell of spotsA) {
          const extra = candidates[cell]! & ~pairMask;
          if (extra !== 0) eliminations.push({ cell, digits: digitsOf(extra) });
        }
        if (eliminations.length > 0) {
          const [a, b] = spotsA;
          return {
            technique: 'hidden-pair',
            rank: 3,
            cell: a!,
            digit: null,
            unit,
            cells: [a!, b!],
            related: [...cells],
            eliminations,
            explanation: `${unitName(unit)}只有 ${cellName(a!)} 与 ${cellName(b!)} 能填 ${digitA}、${digitB}，因此这两格只能是这两个数字（隐性数对）。`,
          };
        }
      }
    }
  }
  return null;
}

function applyStep(step: LogicStep, grid: Uint8Array, candidates: Uint16Array): void {
  if (step.digit !== null) {
    place(step.cell, step.digit, grid, candidates);
    return;
  }
  for (const { cell, digits } of step.eliminations) {
    for (const digit of digits) candidates[cell]! &= ~bitOf(digit);
  }
}

function place(cell: number, digit: number, grid: Uint8Array, candidates: Uint16Array): void {
  grid[cell] = digit;
  candidates[cell] = 0;
  const bit = bitOf(digit);
  for (const peer of PEERS[cell]!) candidates[peer]! &= ~bit;
}

function isComplete(grid: Uint8Array): boolean {
  for (let cell = 0; cell < CELL_COUNT; cell++) if (grid[cell] === 0) return false;
  return true;
}

function bitToDigit(bit: number): number {
  return 32 - Math.clz32(bit);
}

function unitName(unit: number): string {
  if (unit < 9) return `第 ${unit + 1} 行`;
  if (unit < 18) return `第 ${unit - 8} 列`;
  return `第 ${unit - 17} 宫`;
}

function unitHasValue(values: ArrayLike<number>, cells: readonly number[], digit: number): boolean {
  for (const cell of cells) if ((values[cell] ?? 0) === digit) return true;
  return false;
}

function collectEliminations(
  candidates: Uint16Array,
  scope: readonly number[],
  exclude: readonly number[],
  bit: number,
): Elimination[] {
  const excluded = new Set(exclude);
  const eliminations: Elimination[] = [];
  for (const cell of scope) {
    if (excluded.has(cell)) continue;
    if (candidates[cell]! & bit) {
      eliminations.push({ cell, digits: [bitToDigit(bit)] });
    }
  }
  return eliminations;
}

function uniqueCells(cells: number[]): number[] {
  return [...new Set(cells)].sort((a, b) => a - b);
}

function sameGrid(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  for (let cell = 0; cell < CELL_COUNT; cell++) if (a[cell] !== b[cell]) return false;
  return true;
}
