import { registerSW } from 'virtual:pwa-register';

export interface PwaCallbacks {
  onUpdateReady: (apply: () => void) => void;
  onOfflineReady?: () => void;
}

/** 注册 Service Worker；只有新版本就绪时才打扰玩家。 */
export function setupPwa(callbacks: PwaCallbacks): void {
  try {
    let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        callbacks.onUpdateReady(() => {
          void applyUpdate?.(true);
        });
      },
      onOfflineReady() {
        callbacks.onOfflineReady?.();
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        // 回到前台时主动问一次有没有新版本，避免长期挂着的旧页面错过更新。
        const check = (): void => {
          if (document.visibilityState === 'visible') void registration.update();
        };
        document.addEventListener('visibilitychange', check);
      },
    });
    applyUpdate = update;
  } catch {
    /* 开发模式或浏览器禁用 Service Worker：游戏本身照常运行 */
  }
}
