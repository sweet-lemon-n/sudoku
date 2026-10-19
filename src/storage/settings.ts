import { SETTINGS_KEY } from './keys';
import { isRecord, readJson, writeJson, type KeyValueStore } from './store';

export type ThemePreference = 'system' | 'night' | 'day';

export interface Settings {
  theme: ThemePreference;
  haptics: boolean;
  sound: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  haptics: true,
  sound: false,
  onboarded: false,
};

export function loadSettings(store: KeyValueStore): Settings {
  const raw = readJson(store, SETTINGS_KEY);
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  return {
    theme:
      raw.theme === 'night' || raw.theme === 'day' || raw.theme === 'system'
        ? raw.theme
        : DEFAULT_SETTINGS.theme,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    onboarded: typeof raw.onboarded === 'boolean' ? raw.onboarded : DEFAULT_SETTINGS.onboarded,
  };
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  writeJson(store, SETTINGS_KEY, settings);
}
