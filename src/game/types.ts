import type { Difficulty, Technique } from '../engine/solver';

export interface Puzzle {
  id: string;
  difficulty: Difficulty;
  /** 81 格，0 表示空格。 */
  givens: Uint8Array;
  solution: Uint8Array;
}

export interface HintState {
  /** 1 = 高亮相关格；2 = 解释技巧；3 不落库，揭示时直接结束。 */
  level: 1 | 2;
  cell: number;
  digit: number;
  technique: Technique | 'trial';
  related: number[];
  explanation: string;
}

export interface UndoSnapshot {
  values: Uint8Array;
  notes: Uint16Array;
  errors: Uint8Array;
}

export interface GameState {
  id: string;
  difficulty: Difficulty;
  givens: Uint8Array;
  solution: Uint8Array;
  values: Uint8Array;
  notes: Uint16Array;
  errors: Uint8Array;
  selected: number | null;
  hint: HintState | null;
  message: string | null;
  mistakes: number;
  hints: number;
  reveals: number;
  elapsed: number;
  running: boolean;
  paused: boolean;
  won: boolean;
  undo: UndoSnapshot[];
  createdAt: number;
  updatedAt: number;
}
