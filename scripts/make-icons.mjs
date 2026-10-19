/**
 * 一次性生成 PWA 图标（192/512/180 与 maskable），产物提交进仓库。
 * 运行：pnpm icons（需要本机 Chrome 与 @playwright/test）
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = new URL('../public/icons/', import.meta.url);
const PUBLIC = new URL('../public/', import.meta.url);

const svg = (maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2644"/>
      <stop offset="1" stop-color="#06080f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.08" r="0.9">
      <stop offset="0" stop-color="#f2c14e" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#f2c14e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="url(#bg)"/>
  <rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="url(#glow)"/>
  <g stroke="#f2c14e" stroke-opacity="0.16" stroke-width="2">
    <rect x="128" y="128" width="256" height="256" rx="18" fill="none"/>
    <path d="M213.3 128v256M298.7 128v256M128 213.3h256M128 298.7h256"/>
  </g>
  <text x="256" y="320" text-anchor="middle"
    font-family="PingFang SC, Hiragino Sans GB, Noto Sans CJK SC, Microsoft YaHei, sans-serif"
    font-size="236" font-weight="700" fill="#f2c14e">数</text>
  <circle cx="384" cy="128" r="7" fill="#f2c14e" fill-opacity="0.65"/>
</svg>`;

const iconSvg = svg(false);
const maskableSvg = svg(true);

await mkdir(OUT, { recursive: true });
await writeFile(new URL('favicon.svg', PUBLIC), iconSvg, 'utf8');
await writeFile(new URL('icon.svg', OUT), iconSvg, 'utf8');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

async function shot(source, size, file, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${source}`,
    { waitUntil: 'load' },
  );
  await page.screenshot({ path: fileURLToPath(new URL(file, OUT)), omitBackground: transparent });
  console.log('wrote', file, size);
}

await shot(iconSvg, 192, 'icon-192.png');
await shot(iconSvg, 512, 'icon-512.png');
await shot(maskableSvg, 512, 'icon-maskable-512.png');
await shot(iconSvg, 180, 'apple-touch-icon.png');
await browser.close();
