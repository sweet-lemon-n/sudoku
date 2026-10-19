# 先做 PWA，再用 Capacitor 出 APK

本机只有 Node 与 Chrome，没有 Java、Android SDK 或 Flutter；原生安卓开发要先下载约 2GB 工具链并接受许可协议。数独不需要任何原生能力——没有相机、推送、后台定位，甚至不需要网络。因此首版以可安装的 PWA 交付，全部游戏逻辑与界面用 Web 技术实现；将来若需要 APK，用 Capacitor 套壳，引擎与界面不改。

## Considered Options

- **Kotlin + Jetpack Compose**：最原生的体验，但要先装工具链，且日后若想要 Web 版必须重写。
- **Flutter**：同样需要工具链，且为一个 81 格棋盘引入整套渲染引擎。
- **React Native / Expo**：可用云构建绕过本机工具链，但运行时更重，且 Expo 账号与构建链路成为新依赖。

## Consequences

- 手机上的"安装"走浏览器"添加到主屏幕"，首次需要通过 HTTPS 访问；本地开发用 HTTP 局域网只能试玩、不能安装。
- 存储、震动、全屏等能力必须只通过 Web 标准 API 使用，并封装在适配层后面，套壳时替换这一层即可。
