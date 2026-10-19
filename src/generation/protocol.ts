import type { Difficulty } from '../engine/solver';

export interface GenerateRequest {
  id: number;
  difficulty: Difficulty;
}

export type GenerateResponse =
  | {
      id: number;
      ok: true;
      givens: string;
      solution: string;
      difficulty: Difficulty;
      clues: number;
    }
  | { id: number; ok: false; error: string };
