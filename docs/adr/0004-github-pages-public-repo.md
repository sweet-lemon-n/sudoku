# 用 GitHub Pages 托管，仓库公开

本机的 gh 已登录 `sweet-lemon-n`，但没有 Vercel / Netlify 账号；PWA 的安装与离线能力要求 HTTPS。GitHub Pages 免费提供 HTTPS，并能在 push 后自动重新部署，因此代码放在公开仓库 `sweet-lemon-n/sudoku`，由 GitHub Actions 构建并发布，地址为 `https://sweet-lemon-n.github.io/sudoku/`。

## Considered Options

- **Vercel / Netlify**：部署体验更好，但需要额外账号授权，且对纯静态站点没有实质收益。
- **只在本地局域网跑**：零配置，但拿不到 HTTPS，也就没有"安装到主屏幕"和离线。
- **临时隧道**：能立刻安装，但地址会失效，不能作为长期交付。

## Consequences

- 构建的 `base` 必须是 `/sudoku/`，Service Worker 的作用域也随之落在该前缀下。
- 代码与提交历史对所有人可见，任何密钥都不能进入仓库。
- 以后换托管只需改构建产物与域名，游戏代码不受影响。
