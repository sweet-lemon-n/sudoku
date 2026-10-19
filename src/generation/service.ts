import { parseGrid } from '../engine/board';
import { generatePuzzle } from '../engine/generator';
import { systemRng } from '../engine/rng';
import type { Difficulty } from '../engine/solver';
import type { Puzzle } from '../game/types';
import type { GenerateRequest, GenerateResponse } from './protocol';

interface Pending {
  resolve: (puzzle: Puzzle) => void;
  reject: (error: Error) => void;
  timer: number;
}

const TIMEOUT_MS = 20_000;

/** 在 Worker 里出题，避免生成专家题时卡住界面；Worker 不可用时退回主线程。 */
export class GeneratorService {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private destroyed = false;

  request(difficulty: Difficulty): Promise<Puzzle> {
    const id = ++this.sequence;
    const worker = this.ensureWorker();
    if (!worker) return this.fallback(difficulty);

    return new Promise<Puzzle>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('出题超时'));
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      const request: GenerateRequest = { id, difficulty };
      worker.postMessage(request);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error('已取消'));
    }
    this.pending.clear();
  }

  private ensureWorker(): Worker | null {
    if (this.destroyed) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return null;
    }
    this.worker.addEventListener('message', (event: MessageEvent<GenerateResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      window.clearTimeout(pending.timer);
      if (!response.ok) {
        pending.reject(new Error(response.error));
        return;
      }
      const givens = parseGrid(response.givens);
      const solution = parseGrid(response.solution);
      if (!givens || !solution) {
        pending.reject(new Error('出题结果损坏'));
        return;
      }
      pending.resolve({
        id: makeId(),
        difficulty: response.difficulty,
        givens,
        solution,
      });
    });
    this.worker.addEventListener('error', () => {
      for (const pending of this.pending.values()) {
        window.clearTimeout(pending.timer);
        pending.reject(new Error('出题器异常'));
      }
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    });
    return this.worker;
  }

  private fallback(difficulty: Difficulty): Promise<Puzzle> {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          const generated = generatePuzzle(difficulty, systemRng());
          resolve({
            id: makeId(),
            difficulty: generated.difficulty,
            givens: generated.givens,
            solution: generated.solution,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('出题失败'));
        }
      }, 20);
    });
  }
}

export function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
