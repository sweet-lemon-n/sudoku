/** 盘面几何：格、单元、宫，以及候选数的位掩码工具。 */

export const CELL_COUNT = 81;
export const ALL_DIGITS = 0b1_1111_1111;

export const rowOf = (cell: number): number => (cell / 9) | 0;
export const colOf = (cell: number): number => cell % 9;
export const boxOf = (cell: number): number =>
  (((cell / 9) | 0) / 3 | 0) * 3 + (((cell % 9) / 3) | 0);

export const cellName = (cell: number): string => `R${rowOf(cell) + 1}C${colOf(cell) + 1}`;

export const bitOf = (digit: number): number => 1 << (digit - 1);

export function popcount(mask: number): number {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

export function digitsOf(mask: number): number[] {
  const digits: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if (mask & bitOf(digit)) digits.push(digit);
  }
  return digits;
}

export const UNITS: readonly (readonly number[])[] = buildUnits();

/** 每格所属的三个单元（行、列、宫）在 UNITS 中的下标。 */
export const UNITS_OF: readonly (readonly number[])[] = buildUnitsOf();

/** 每格的 20 个关联格：同行、同列、同宫，不含自身。 */
export const PEERS: readonly (readonly number[])[] = buildPeers();

function buildUnits(): number[][] {
  const units: number[][] = [];
  for (let row = 0; row < 9; row++) {
    units.push(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  }
  for (let col = 0; col < 9; col++) {
    units.push(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  }
  for (let box = 0; box < 9; box++) {
    const top = Math.floor(box / 3) * 27;
    const left = (box % 3) * 3;
    units.push(
      Array.from({ length: 9 }, (_, index) => top + Math.floor(index / 3) * 9 + left + (index % 3)),
    );
  }
  return units;
}

function buildUnitsOf(): number[][] {
  return Array.from({ length: CELL_COUNT }, (_, cell) =>
    [rowOf(cell), 9 + colOf(cell), 18 + boxOf(cell)].sort((a, b) => a - b),
  );
}

function buildPeers(): number[][] {
  return Array.from({ length: CELL_COUNT }, (_, cell) => {
    const peers = new Set<number>();
    for (const unit of UNITS_OF[cell]!) {
      for (const peer of UNITS[unit]!) {
        if (peer !== cell) peers.add(peer);
      }
    }
    return [...peers].sort((a, b) => a - b);
  });
}

/** 把 81 位文本（0 表示空格）解析成盘面；不合法时返回 null。 */
export function parseGrid(text: string): Uint8Array | null {
  if (text.length !== CELL_COUNT || /[^0-9]/.test(text)) return null;
  const grid = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    grid[cell] = text.charCodeAt(cell) - 48;
  }
  return grid;
}

export function gridsEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  for (let cell = 0; cell < CELL_COUNT; cell++) if (a[cell] !== b[cell]) return false;
  return true;
}

/** 把盘面写回 81 位文本，用于存档。 */
export function formatGrid(grid: ArrayLike<number>): string {
  let text = '';
  for (let cell = 0; cell < CELL_COUNT; cell++) text += String(grid[cell] ?? 0);
  return text;
}

/**
 * 按当前已填数字计算每格候选数（位掩码）。
 * 已填格返回 0；盘面本身冲突时抛错，避免在错误盘面上继续推理。
 */
export function candidatesOf(values: ArrayLike<number>): Uint16Array {
  const candidates = new Uint16Array(CELL_COUNT);
  for (const unit of UNITS) {
    let seen = 0;
    for (const cell of unit) {
      const value = values[cell] ?? 0;
      if (value < 0 || value > 9) throw new Error(`盘面数值越界：${cell} = ${value}`);
      if (value === 0) continue;
      const bit = bitOf(value);
      if (seen & bit) throw new Error('盘面冲突：同一单元出现重复数字');
      seen |= bit;
    }
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = values[cell] ?? 0;
    if (value === 0) {
      let used = 0;
      for (const peer of PEERS[cell]!) {
        const peerValue = values[peer] ?? 0;
        if (peerValue !== 0) used |= bitOf(peerValue);
      }
      candidates[cell] = ALL_DIGITS & ~used;
    }
  }
  return candidates;
}
