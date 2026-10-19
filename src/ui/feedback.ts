import type { Settings } from '../storage/settings';

/** 震动/音效走适配器，套 Capacitor 壳时只替换这两个实现。 */
export interface HapticsAdapter {
  vibrate(pattern: number | number[]): void;
}

export interface Tone {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  delay?: number;
}

export interface AudioAdapter {
  unlock(): void;
  play(notes: Tone[]): void;
}

export function supportsHaptics(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export const browserHaptics: HapticsAdapter = {
  vibrate(pattern) {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch {
      /* 桌面或 iOS 不支持震动时静默降级 */
    }
  },
};

/** 音效默认关闭；第一次手势后才创建 AudioContext。 */
const browserAudio: AudioAdapter = (() => {
  let context: AudioContext | null = null;

  const ensure = (): AudioContext | null => {
    if (context) return context;
    try {
      const Ctor = window.AudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      return context;
    } catch {
      return null;
    }
  };

  return {
    unlock() {
      const audio = ensure();
      if (audio && audio.state === 'suspended') void audio.resume();
    },
    play(notes) {
      const audio = ensure();
      if (!audio) return;
      if (audio.state === 'suspended') void audio.resume();
      const start = audio.currentTime + 0.01;
      for (const note of notes) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const at = start + (note.delay ?? 0);
        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(note.volume, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + note.duration + 0.02);
      }
    },
  };
})();

export class Feedback {
  constructor(
    private readonly readSettings: () => Settings,
    private readonly haptics: HapticsAdapter = browserHaptics,
    private readonly audio: AudioAdapter = browserAudio,
  ) {}

  unlock(): void {
    if (this.readSettings().sound) this.audio.unlock();
  }

  correct(): void {
    this.vibrate(8);
    this.tone([{ frequency: 660, duration: 0.05, type: 'sine', volume: 0.05 }]);
  }

  wrong(): void {
    this.vibrate([12, 40, 12]);
    this.tone([
      { frequency: 220, duration: 0.09, type: 'triangle', volume: 0.06 },
      { frequency: 180, duration: 0.09, type: 'triangle', volume: 0.05, delay: 0.1 },
    ]);
  }

  note(): void {
    this.vibrate(5);
    this.tone([{ frequency: 480, duration: 0.025, type: 'sine', volume: 0.035 }]);
  }

  erase(): void {
    this.vibrate(6);
    this.tone([{ frequency: 360, duration: 0.03, type: 'sine', volume: 0.03 }]);
  }

  win(): void {
    this.vibrate([15, 50, 15, 50, 30]);
    this.tone([
      { frequency: 523.25, duration: 0.1, type: 'sine', volume: 0.055 },
      { frequency: 659.25, duration: 0.1, type: 'sine', volume: 0.055, delay: 0.11 },
      { frequency: 783.99, duration: 0.1, type: 'sine', volume: 0.055, delay: 0.22 },
      { frequency: 1046.5, duration: 0.18, type: 'sine', volume: 0.06, delay: 0.33 },
    ]);
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.readSettings().haptics) return;
    this.haptics.vibrate(pattern);
  }

  private tone(notes: Tone[]): void {
    if (!this.readSettings().sound) return;
    this.audio.play(notes);
  }
}
