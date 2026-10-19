import { describe, expect, it } from 'vitest';
import {
  PEERS,
  UNITS,
  UNITS_OF,
  boxOf,
  candidatesOf,
  cellName,
  colOf,
  formatGrid,
  parseGrid,
  rowOf,
} from '../src/engine/board';

describe('board vocabulary', () => {
  it('maps cells to row, column and box', () => {
    expect([rowOf(0), colOf(0), boxOf(0)]).toEqual([0, 0, 0]);
    expect([rowOf(8), colOf(8), boxOf(8)]).toEqual([0, 8, 2]);
    expect([rowOf(80), colOf(80), boxOf(80)]).toEqual([8, 8, 8]);
    expect([rowOf(40), colOf(40), boxOf(40)]).toEqual([4, 4, 4]);
    expect(cellName(40)).toBe('R5C5');
  });

  it('has 27 units of nine cells each, every cell in three units', () => {
    expect(UNITS).toHaveLength(27);
    for (const unit of UNITS) {
      expect(new Set(unit).size).toBe(9);
    }
    for (let cell = 0; cell < 81; cell++) {
      expect(UNITS_OF[cell]!).toHaveLength(3);
      expect(new Set(UNITS_OF[cell]!).size).toBe(3);
      expect(UNITS_OF[cell]!.every((unit) => UNITS[unit]!.includes(cell))).toBe(true);
    }
  });

  it('gives every cell 20 distinct peers, never itself', () => {
    for (let cell = 0; cell < 81; cell++) {
      const peers = PEERS[cell]!;
      expect(new Set(peers).size).toBe(20);
      expect(peers).not.toContain(cell);
      for (const peer of peers) {
        expect(PEERS[peer]!).toContain(cell);
      }
    }
  });
});

describe('grid text', () => {
  it('round-trips a puzzle written as 81 digits', () => {
    const text =
      '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const grid = parseGrid(text);
    expect(grid).not.toBeNull();
    expect(formatGrid(grid!)).toBe(text);
  });

  it('rejects text that is not 81 sudoku digits', () => {
    expect(parseGrid('123')).toBeNull();
    expect(parseGrid('x'.repeat(81))).toBeNull();
    expect(parseGrid('0'.repeat(80) + 'a')).toBeNull();
  });

  it('rejects a grid that breaks the rules', () => {
    const grid = parseGrid('5' + '0'.repeat(7) + '5' + '0'.repeat(72));
    expect(grid).not.toBeNull();
    expect(() => candidatesOf(grid!)).toThrow(/冲突/);
  });
});

describe('candidate computation', () => {
  it('collects candidates from the row, column and box', () => {
    const values = new Uint8Array(81);
    for (let col = 0; col < 8; col++) values[col] = col + 1; // R1C1..R1C8 = 1..8
    expect(candidatesOf(values)[8]).toBe(0b1_0000_0000); // only 9 fits R1C9

    values.fill(0);
    for (let row = 0; row < 8; row++) values[row * 9] = row + 1; // column 1 has 1..8
    expect(candidatesOf(values)[72]).toBe(0b1_0000_0000);
  });

  it('returns an empty mask for a filled cell', () => {
    const values = new Uint8Array(81);
    values[0] = 4;
    expect(candidatesOf(values)[0]).toBe(0);
  });
});
