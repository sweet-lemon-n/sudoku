/** 界面用 SVG 图标（统一 24×24 线性风格，不依赖 emoji）。 */

const wrap = (body: string, extra = ''): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  back: wrap('<path d="M14.5 5.5 8 12l6.5 6.5"/><path d="M8.5 12H20"/>'),
  undo: wrap('<path d="M4 9h10.5a5 5 0 0 1 0 10H8"/><path d="M8 5 4 9l4 4"/>'),
  erase: wrap('<path d="M4 19h16"/><path d="M6.5 14.5l6-6 4.5 4.5-6 6H9z"/>'),
  hint: wrap(
    '<path d="M12 3.2a5.6 5.6 0 0 0-3.1 10.3V17h6.2v-3.5A5.6 5.6 0 0 0 12 3.2z"/><path d="M10 20h4"/>',
  ),
  pause: wrap('<path d="M8.5 5.5v13"/><path d="M15.5 5.5v13"/>'),
  play: wrap('<path d="M8 5.5 18 12 8 18.5z"/>'),
  check: wrap('<path d="m5 12.5 4.5 4.5L19 6.5"/>'),
  close: wrap('<path d="m6 6 12 12"/><path d="m18 6-12 12"/>'),
  arrow: wrap('<path d="M4 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/>'),
  chart: wrap(
    '<path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/><path d="M3 20h18"/>',
  ),
  settings: wrap(
    '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
  ),
  tap: wrap(
    '<path d="M9 11V6.5a2 2 0 0 1 4 0V12"/><path d="M13 10.5V9a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6H9a5 5 0 0 1-4.5-2.8L3 14s1.5-1 2.5 0L9 17"/>',
  ),
  longpress: wrap(
    '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/><path d="M12 2.5v1.8M21.5 12h-1.8M12 21.5v-1.8M2.5 12h1.8"/>',
  ),
  download: wrap('<path d="M12 4v11"/><path d="m7.5 11 4.5 4 4.5-4"/><path d="M5 20h14"/>'),
  trash: wrap(
    '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="m6.5 7 .8 12.5h9.4L17.5 7"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  ),
  info: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>'),
} as const;

export type IconName = keyof typeof icons;
