# 数独

纯单机、可安装到安卓主屏幕的数独。没有账号，没有网络请求，所有对局与统计都留在本机。

## 跑起来

```bash
pnpm install
pnpm dev        # http://localhost:5173/sudoku/
pnpm build
pnpm preview    # 生产构建，地址同样是 /sudoku/
```

需要 Node 22.12+。生产构建的 `base` 固定为 `/sudoku/`（见 ADR 0004）。

## 检查

```bash
pnpm typecheck
pnpm test       # 引擎、生成器、对局状态机、存档与统计
pnpm test:e2e   # Playwright，真实指针事件、小屏布局、离线重开
pnpm icons      # 只有改图标时才需要：用本机 Chrome 重画 PNG
```

`pnpm test:e2e` 会自己构建并启动 preview。它使用本机 Chrome（`channel: 'chrome'`），不会下载浏览器。

## 它是什么

- **四档难度按技巧分级**，不按空格数量：简单只需要唯一余数与隐性唯一；中等会用到区块排除；困难需要数对；专家在四类技巧下无法推进，需要试错。生成器保证唯一解，并对每道题重新求解、核验等级。
- **轻点数字记笔记，长按 450ms 填答案**（ADR 0005）。轻点擦除清一格，长按擦除清空全部笔记。落子会清掉同行、同列、同宫以及本格的对应候选。
- **提示分三级**：先高亮相关格，再解释所用技巧，最后揭示答案。提示次数在第一次请求时 +1，揭示单独计入统计。专家题会如实说明“这一步需要试错”。
- **对局**带计时、错误、撤销历史；切到后台会自动暂停。关闭页面后只保留一个进行中存档，下次打开从 `#/play` 继续。
- **完成记录**不可变，进入统计：每档的完成局数、最佳/平均用时、平均错误与提示，以及最近 12 局。
- **主题**跟随系统，也可固定夜色/日间；另有震动与音效开关（音效默认关）。
- **PWA**：manifest + Service Worker 预缓存全部构建产物，断网可玩；新版本就绪时提示刷新。

## 代码地图

```
src/
  engine/     盘面几何、唯一解计数、技巧求解与分级、生成器
  game/       对局状态机（纯函数，不碰 DOM）
  storage/    localStorage 适配层：存档、统计、设置
  generation/ 出题 Worker 与主线程客户端
  ui/         对局、首页、统计、设置、引导、主题、震动/音效
  app.ts      路由、存档生命周期、结果落库
  pwa.ts      Service Worker 注册与更新提示
tests/        Vitest：引擎、生成器、对局、存储
e2e/          Playwright：真实手势、继续、完成、主题、小屏、离线
public/       图标与 favicon
prototype/    一次性 UI 原型（保留结论与截图，正式实现不引用）
```

存储键：`sudoku:settings:v1`、`sudoku:save:v1`、`sudoku:results:v1`。存档读取时会重新校验题面唯一解、答案一致性与数值范围，损坏的存档会被丢弃。

## 部署

推送到 `main` 后，`.github/workflows/deploy.yml` 跑测试、构建、发布到 GitHub Pages：

<https://sweet-lemon-n.github.io/sudoku/>

仓库公开，由 ADR 0004 决定；任何密钥都不要进入仓库。

## 文档

- `CONTEXT.md` — 项目语言：题面、解、已知数、候选、笔记、技巧、难度、对局、错误、提示、揭示、存档、完成记录。
- `docs/adr/` — PWA 优先、技巧分级、零框架、GitHub Pages、轻点/长按交互。
