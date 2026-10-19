# 首帧主题提示是唯一同步读 Web Storage 的地方

主题必须在首帧前落到 `<html data-theme>`，否则系统浅色下会先闪一下夜色。但模块脚本是 deferred 的：等 `main.ts` 加载再读设置已经太晚。因此构建时向 `index.html` 注入一小段同步脚本，只读 `sudoku:settings:v1` 里的 `theme` 字段，解析 `system / night / day` 后设置 `data-theme` 与 `theme-color`。

这段脚本是 ADR 0001「存储能力封装在适配层后面」的唯一例外，原因不是偷懒，而是浏览器只允许同步内联脚本在模块加载前运行。键名由 `src/storage/keys.ts` 注入（`vite.config.ts` 的 `themeBoot` 插件），不另写一份；脚本只读不写，启动后的主题状态仍由 `loadSettings` + `KeyValueStore` 决定。

## Consequences

- 如果以后把存储换成 Capacitor 原生适配器，首帧提示读不到就退回系统主题，不会报错；App 启动后仍由适配层给出真实偏好，最多闪一下，符合“优雅降级”。
- 设置键或 `theme` 字段改名时，必须同时更新 `keys.ts` 与这段脚本的读取逻辑；`e2e/app.spec.ts` 的「浅色系统首帧就是日间」覆盖了这条链路。
- 除这里之外，生产代码不得直接访问 `localStorage`；所有持久化都走 `src/storage/`。
- 主题颜色值集中在 `src/ui/theme-colors.ts`，首帧脚本、manifest 与运行时 meta 都引用它；CSS 变量仍是独立的颜色定义，改色时需同步 `styles.css`。
