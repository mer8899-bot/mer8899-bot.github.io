# 深蓝

“深蓝”是一个以 GitHub 为内容与版本核心的个人 Blog。

## 现有发布链路

```text
posts/*.md → build.js → posts/posts.json → GitHub Pages
```

本地备用写作入口仍由 `editor.js` 提供，地址是 `http://127.0.0.1:4321`。它会生成 Markdown、更新索引并推送 GitHub。

## 本地预览

公开站点是纯静态页面。在项目目录运行任意静态文件服务后打开根路径即可。安全写作后端可以运行：

```bash
npm run dev
```

默认地址为 `http://127.0.0.1:8787/write/`。未配置 GitHub App 时只会显示登录入口，不会获得任何仓库写权限。

## 公网写作配置

1. 复制 `.env.example` 为本机或托管平台的环境变量清单。
2. 在 GitHub App 中仅授予目标仓库 Contents read/write 与 Metadata read-only。
3. 把真实值直接保存到托管平台的 Secret / Environment Variables，不要写入文件或聊天。

需要的后端接口：

```text
GET  /auth/github
GET  /auth/github/callback
GET  /api/session
POST /auth/logout
POST /api/publish
```

认证使用 OAuth state、PKCE、GitHub numeric user ID allowlist、签名 HttpOnly session Cookie 与 CSRF/Origin 校验。发布使用短期 GitHub App installation token；浏览器不持有仓库写凭据。

## 检查

```bash
npm test
node --check editor.js
node --check build.js
node build.js
git diff --check
```
