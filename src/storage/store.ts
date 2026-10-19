/** localStorage 的薄封装；隐私模式禁用存储时退回内存，游戏仍可继续。 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

export function browserStore(): KeyValueStore {
  const fallback = memoryStore();
  try {
    const storage = window.localStorage;
    const probe = 'sudoku:probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    let useFallback = false;
    return {
      getItem: (key) => {
        if (useFallback) return fallback.getItem(key);
        try {
          return storage.getItem(key);
        } catch {
          useFallback = true;
          return fallback.getItem(key);
        }
      },
      setItem: (key, value) => {
        if (useFallback) {
          fallback.setItem(key, value);
          return;
        }
        try {
          storage.setItem(key, value);
        } catch {
          // 配额已满或被禁用：从这里开始整局都走内存，避免读回 localStorage 的旧值。
          useFallback = true;
          fallback.setItem(key, value);
        }
      },
      removeItem: (key) => {
        if (useFallback) {
          fallback.removeItem(key);
          return;
        }
        try {
          storage.removeItem(key);
        } catch {
          useFallback = true;
          fallback.removeItem(key);
        }
      },
    };
  } catch {
    return fallback;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储已满或被禁用：对局仍在内存里继续 */
  }
}
