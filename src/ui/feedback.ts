import type { Settings } from '../storage/settings';

/** 震动与音效都尊重设置；音效默认关闭，首次手势后才创建 AudioContext。 */
export class Feedback {
  private audio: AudioContext | null = null;

  constructor(private readonly readSettings: () => Settings) {}

  unlock(): void {
    if (!this.readSettings().sound) return;
    const audio = this.context();
    if (audio && audio.state === 'suspended') void audio.resume();
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
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch {
      /* 桌面或 iOS 不支持震动时静默降级 */
    }
  }

  private tone(
    notes: Array<{
      frequency: number;
      duration: number;
      type: OscillatorType;
      volume: number;
      delay?: number;
    }>,
  ): void {
    if (!this.readSettings().sound) return;
    const audio = this.context();
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
  }

  private context(): AudioContext | null {
    if (this.audio) return this.audio;
    try {
      const Ctor = window.AudioContext;
      if (!Ctor) return null;
      this.audio = new Ctor();
      return this.audio;
    } catch {
      return null;
    }
  }
}
