import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json';
import { SETTINGS_KEY } from './src/storage/keys';
import { THEME_COLORS } from './src/ui/theme-colors';

/**
 * 模块脚本是 deferred 的，要在首帧前定主题只能同步执行一段内联脚本。
 * 键从 storage/keys.ts 注入，避免和设置模块各写一份；这是唯一直接读 Web Storage
 * 的地方，见 docs/adr/0006-first-paint-theme-boot.md。
 */
const THEME_BOOT = `<script>
(function () {
  var theme = 'night';
  try {
    var raw = localStorage.getItem(${JSON.stringify(SETTINGS_KEY)});
    var saved = raw ? JSON.parse(raw) : null;
    var pref = saved && (saved.theme === 'night' || saved.theme === 'day') ? saved.theme : null;
    if (pref) theme = pref;
    else theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'day' ? ${JSON.stringify(THEME_COLORS.day)} : ${JSON.stringify(THEME_COLORS.night)});
})();
</script>`;

function themeBoot(): Plugin {
  return {
    name: 'sudoku-theme-boot',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('<!--THEME_BOOT-->', THEME_BOOT);
      },
    },
  };
}

export default defineConfig({
  base: '/sudoku/',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  plugins: [
    themeBoot(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '数独',
        short_name: '数独',
        description: '纯单机数独，没有账号、没有网络请求，对局与统计都留在本机。',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME_COLORS.night,
        theme_color: THEME_COLORS.night,
        categories: ['games', 'puzzle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
