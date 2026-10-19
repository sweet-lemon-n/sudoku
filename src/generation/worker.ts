/// <reference lib="webworker" />

import { formatGrid } from '../engine/board';
import { generatePuzzle } from '../engine/generator';
import { systemRng } from '../engine/rng';
import type { GenerateResponse, GenerateRequest } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.addEventListener('message', (event: MessageEvent<GenerateRequest>) => {
  const { id, difficulty } = event.data;
  try {
    const puzzle = generatePuzzle(difficulty, systemRng());
    const response: GenerateResponse = {
      id,
      ok: true,
      givens: formatGrid(puzzle.givens),
      solution: formatGrid(puzzle.solution),
      difficulty: puzzle.difficulty,
      clues: puzzle.clues,
    };
    scope.postMessage(response);
  } catch (error) {
    const response: GenerateResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : '生成失败',
    };
    scope.postMessage(response);
  }
});
