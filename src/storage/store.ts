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
    return {
      getItem: (key) => {
        try {
          return storage.getItem(key);
        } catch {
          return fallback.getItem(key);
        }
      },
      setItem: (key, value) => {
        try {
          storage.setItem(key, value);
        } catch {
          fallback.setItem(key, value);
        }
      },
      removeItem: (key) => {
        try {
          storage.removeItem(key);
        } catch {
          fallback.removeItem(key);
        }
      },
    };
  } catch {
    return fallback;
  }
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
