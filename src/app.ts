import { DIFFICULTY_LABEL, type Difficulty } from './engine/solver';
import { createGame } from './game/game';
import type { GameState } from './game/types';
import { GeneratorService } from './generation/service';
import { clearSave, loadSave, storeSave } from './storage/save';
import {
  clearResults,
  loadResults,
  recordResult,
  type Result,
} from './storage/results';
import { loadSettings, saveSettings, type Settings } from './storage/settings';
import { browserStore, type KeyValueStore } from './storage/store';
import { Feedback } from './ui/feedback';
import { GameView } from './ui/game-view';
import { renderHome } from './ui/home';
import { icons } from './ui/icons';
import { showOnboarding } from './ui/onboarding';
import { renderSettings } from './ui/settings';
import { renderStats } from './ui/stats';
import { applyTheme, watchSystemTheme } from './ui/theme';
import { setupPwa } from './pwa';

export const APP_VERSION = __APP_VERSION__;

type Route = 'home' | 'game' | 'stats' | 'settings';

export class App {
  private readonly store: KeyValueStore;
  private readonly root: HTMLElement;
  private readonly generator = new GeneratorService();
  private readonly feedback: Feedback;
  private settings: Settings;
  private results: Result[];
  private gameState: GameState | null = null;
  private gameView: GameView | null = null;
  private recordedGame = '';
  private generating = false;
  private generationToken = 0;
  private destroyed = false;
  private stopWatchingTheme: () => void = () => {};
  private toastTimer: number | null = null;
  private banner: HTMLElement | null = null;
  private loading: HTMLElement | null = null;

  constructor(store: KeyValueStore, root: HTMLElement) {
    this.store = store;
    this.root = root;
    this.settings = loadSettings(store);
    this.results = loadResults(store);
    this.feedback = new Feedback(() => this.settings);
  }

  init(): void {
    applyTheme(this.settings.theme);
    this.stopWatchingTheme = watchSystemTheme(() => {
      if (this.settings.theme === 'system') applyTheme('system');
    });

    setupPwa({
      onUpdateReady: (apply) => this.showUpdateBanner(apply),
      onOfflineReady: () => this.toast('已可离线游玩'),
    });

    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (!location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    }
    this.render();

    if (!this.settings.onboarded) {
      window.setTimeout(() => {
        if (this.destroyed) return;
        showOnboarding({ onDone: this.markOnboarded });
      }, 120);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.generationToken++;
    this.persistNow();
    this.gameView?.destroy();
    this.gameView = null;
    this.generator.destroy();
    this.stopWatchingTheme();
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.hideLoading();
    this.hideUpdateBanner();
  }

  private onHashChange = (): void => {
    this.render();
  };

  private onPageHide = (): void => {
    this.persistNow();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.persistNow();
  };

  private route(): Route {
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
    if (hash === 'play' || hash === 'game') return 'game';
    if (hash === 'stats') return 'stats';
    if (hash === 'settings') return 'settings';
    return 'home';
  }

  private navigate(route: Route): void {
    const target = route === 'home' ? '#/' : route === 'game' ? '#/play' : `#/${route}`;
    if (location.hash === target) {
      this.render();
      return;
    }
    location.hash = target;
  }

  private render(): void {
    if (this.destroyed) return;
    this.persistNow();
    this.gameView?.destroy();
    this.gameView = null;

    const route = this.route();
    if (route !== 'game' && this.generating) {
      this.generationToken++;
      this.generating = false;
      this.hideLoading();
    }
    this.root.replaceChildren();
    window.scrollTo(0, 0);

    if (route === 'game') {
      const state = this.gameState ?? loadSave(this.store);
      if (!state) {
        this.gameState = null;
        this.replaceWithHome();
        return;
      }
      this.gameState = state;
      this.gameView = new GameView(this.root, state, {
        feedback: this.feedback,
        onChange: (next) => this.handleGameChange(next),
        onTick: (next) => this.handleGameTick(next),
        onExit: () => this.leaveGame(),
        onNewGame: (difficulty) => this.startGame(difficulty),
        onWin: (won) => this.recordWin(won),
        notify: (message) => this.toast(message),
      });
      return;
    }

    this.gameState = null;
    if (route === 'stats') {
      this.root.append(
        renderStats({
          results: this.results,
          onBack: () => this.navigate('home'),
        }),
      );
      return;
    }
    if (route === 'settings') {
      this.root.append(
        renderSettings({
          settings: this.settings,
          version: APP_VERSION,
          onBack: () => this.navigate('home'),
          onChange: (next) => this.updateSettings(next),
          onShowGuide: () => showOnboarding({ onDone: () => {}, replay: true }),
          onClearData: () => this.confirmClearData(),
        }),
      );
      return;
    }

    const save = loadSave(this.store);
    this.root.append(
      renderHome({
        save,
        results: this.results,
        version: APP_VERSION,
        onContinue: () => this.continueGame(save),
        onNewGame: (difficulty) => this.startGame(difficulty),
        onStats: () => this.navigate('stats'),
        onSettings: () => this.navigate('settings'),
      }),
    );
  }

  /** 直接打开 #/play 但没有存档时，用 replace 回到首页，避免后退在两者之间打转。 */
  private replaceWithHome(): void {
    history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    this.render();
  }

  private continueGame(save: GameState | null): void {
    const state = save ?? loadSave(this.store);
    if (!state) {
      this.toast('没有可继续的对局');
      return;
    }
    this.gameState = state;
    this.navigate('game');
  }

  private startGame(difficulty: Difficulty): void {
    if (this.generating) return;
    const existing = loadSave(this.store);
    if (existing) {
      this.showConfirm({
        title: '开始新对局？',
        body: '当前进行中的对局会被放弃，它的存档会被新对局覆盖。',
        confirmLabel: '开始新对局',
        onConfirm: () => this.beginGeneration(difficulty),
      });
      return;
    }
    this.beginGeneration(difficulty);
  }

  private beginGeneration(difficulty: Difficulty): void {
    if (this.generating) return;
    this.generating = true;
    const token = ++this.generationToken;
    this.showLoading(`正在准备${DIFFICULTY_LABEL[difficulty]}题面`);
    this.generator
      .request(difficulty)
      .then((puzzle) => {
        if (this.destroyed || token !== this.generationToken) return;
        const game = createGame(puzzle);
        this.recordedGame = '';
        this.gameState = game;
        storeSave(this.store, game);
        this.hideLoading();
        this.generating = false;
        this.navigate('game');
      })
      .catch((error: unknown) => {
        if (token !== this.generationToken) return;
        this.generating = false;
        this.hideLoading();
        if (this.destroyed) return;
        this.toast(error instanceof Error && error.message ? `出题失败：${error.message}` : '出题失败，请再试一次');
      });
  }

  private leaveGame(): void {
    this.persistNow();
    this.gameState = null;
    this.navigate('home');
  }

  private handleGameChange(state: GameState): void {
    this.gameState = state;
    storeSave(this.store, state);
    if (state.won) this.recordWin(state);
  }

  private handleGameTick(state: GameState): void {
    this.gameState = state;
    if (state.elapsed > 0 && state.elapsed % 10 === 0) storeSave(this.store, state);
  }

  private recordWin(state: GameState): void {
    if (state.won && this.recordedGame !== state.id) {
      this.recordedGame = state.id;
      recordResult(this.store, {
        difficulty: state.difficulty,
        timeSec: state.elapsed,
        mistakes: state.mistakes,
        hints: state.hints,
        reveals: state.reveals,
      });
      this.results = loadResults(this.store);
      clearSave(this.store);
    }
  }

  private persistNow(): void {
    if (this.gameState) storeSave(this.store, this.gameState);
  }

  private updateSettings(next: Settings): void {
    this.settings = next;
    saveSettings(this.store, next);
    applyTheme(next.theme);
  }

  private markOnboarded = (): void => {
    if (this.settings.onboarded) return;
    this.settings = { ...this.settings, onboarded: true };
    saveSettings(this.store, this.settings);
  };

  private confirmClearData(): void {
    this.showConfirm({
      title: '清除对局与统计？',
      body: '当前存档和全部完成记录会被删除，且无法恢复。主题、震动与音效设置会保留。',
      confirmLabel: '清除',
      onConfirm: () => {
        clearSave(this.store);
        clearResults(this.store);
        this.results = [];
        this.gameState = null;
        this.toast('已清除对局与统计');
        this.render();
      },
    });
  }

  private showLoading(text: string): void {
    this.hideLoading();
    const overlay = document.createElement('div');
    overlay.className = 'overlay loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `<div class="loading-box"><span class="spinner" aria-hidden="true"></span><p>${text}</p><span>通常只需要一两秒</span></div>`;
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    this.loading = overlay;
  }

  private hideLoading(): void {
    this.loading?.remove();
    this.loading = null;
    document.body.classList.remove('modal-open');
  }

  private showConfirm(options: {
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  }): void {
    let closed = false;
    const overlay = document.createElement('div');
    overlay.className = 'overlay confirm-overlay';
    overlay.innerHTML = `
      <div class="sheet confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 class="sheet-title" id="confirm-title">${options.title}</h2>
        <p class="confirm-body">${options.body}</p>
        <button type="button" class="danger-btn" data-confirm>${options.confirmLabel}</button>
        <button type="button" class="ghost-btn" data-cancel>取消</button>
      </div>
    `;
    const close = (): void => {
      if (closed) return;
      closed = true;
      overlay.remove();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeyDown);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    overlay.querySelector('[data-confirm]')?.addEventListener('click', () => {
      close();
      options.onConfirm();
    });
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    overlay.querySelector<HTMLElement>('[data-confirm]')?.focus();
  }

  private toast(message: string): void {
    const existing = document.querySelector('.toast');
    existing?.remove();
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.append(toast);
    this.toastTimer = window.setTimeout(() => {
      toast.remove();
      this.toastTimer = null;
    }, 2600);
  }

  private showUpdateBanner(apply: () => void): void {
    this.hideUpdateBanner();
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<span>${icons.download}<span>新版本已就绪</span></span><button type="button">刷新</button>`;
    banner.querySelector('button')?.addEventListener('click', () => {
      apply();
      this.hideUpdateBanner();
    });
    document.body.append(banner);
    this.banner = banner;
  }

  private hideUpdateBanner(): void {
    this.banner?.remove();
    this.banner = null;
  }
}
