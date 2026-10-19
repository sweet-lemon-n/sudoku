import type { ThemePreference } from '../storage/settings';

export type ResolvedTheme = 'night' | 'day';

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'night' || preference === 'day') return preference;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  } catch {
    return 'night';
  }
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const theme = resolveTheme(preference);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'day' ? '#f4f6f9' : '#06080f';
  return theme;
}

export function watchSystemTheme(onChange: () => void): () => void {
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (): void => onChange();
    if (media.addEventListener) media.addEventListener('change', listener);
    else media.addListener(listener);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', listener);
      else media.removeListener(listener);
    };
  } catch {
    return () => {};
  }
}
