import { describe, expect, it, vi } from 'vitest';
import { Feedback, type AudioAdapter, type HapticsAdapter } from '../src/ui/feedback';
import type { Settings } from '../src/storage/settings';

function setup(settings: Partial<Settings> = {}) {
  let current: Settings = {
    theme: 'night',
    haptics: true,
    sound: true,
    onboarded: true,
    ...settings,
  };
  const vibrate = vi.fn();
  const unlock = vi.fn();
  const play = vi.fn();
  const haptics: HapticsAdapter = { vibrate };
  const audio: AudioAdapter = { unlock, play };
  const feedback = new Feedback(() => current, haptics, audio);
  return {
    feedback,
    vibrate,
    unlock,
    play,
    setSettings(next: Partial<Settings>) {
      current = { ...current, ...next };
    },
  };
}

describe('feedback adapters', () => {
  it('honours the haptics and sound switches independently', () => {
    const { feedback, vibrate, play } = setup({ haptics: false, sound: false });
    feedback.correct();
    expect(vibrate).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('calls the adapters when the switches are on', () => {
    const { feedback, vibrate, unlock, play } = setup();
    feedback.unlock();
    feedback.win();
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });

  it('does not unlock audio when sound is off', () => {
    const { feedback, unlock } = setup({ sound: false });
    feedback.unlock();
    expect(unlock).not.toHaveBeenCalled();
  });
});
