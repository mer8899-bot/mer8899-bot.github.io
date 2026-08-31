# AGENTS.md — 深蓝 Blog

## Mission

维护并演进“深蓝”个人 Blog，让作者可以低摩擦地写作与发布，同时保持公开站点克制、快速、适合中文阅读。

## Production system

这是已上线项目。不要重建仓库，不要运行 `git init`，不要删除现有文章或发布链路。

必须保留：

- `.github/workflows/build.yml`
- `build.js`
- `editor.js`
- `index.html`
- `posts/`
- 本地 `127.0.0.1:4321` 发布器兼容性

开始较大修改前先检查 `git status` 和近期提交；工作区不干净时不得丢弃未知修改。

## Product priorities

1. 不丢文章
2. 不泄露 secrets
3. 发布链路可靠
4. 作者体验简单
5. mobile-first
6. 公共阅读体验
7. 技术优雅

## Security

不得把 PAT、OAuth client secret、GitHub App private key、session secret、installation token 或用户 access token 写入前端或 Git。

公网作者认证使用 GitHub App、服务端 OAuth/session，并使用 GitHub numeric user ID 限定唯一作者。真实 secrets 仅存在于运行环境。

## Architecture

内容链路继续保持：

```text
posts/*.md → build.js → posts/posts.json → GitHub Pages
```

公网写作链路：

```text
/write/ → GitHub auth → secure backend → GitHub App → Contents API → posts/*.md
```

本地 `editor.js` 始终作为 fallback 保留。

## Implementation style

- 优先简单、可读、少依赖
- 后端业务逻辑保持 vendor-neutral，平台适配层尽量薄
- 用户可见错误使用清楚的中文
- 作者端 local autosave，发布失败不清草稿，成功才清空，并防重复提交
- 读者端优先中文排版、速度、可访问性和移动端体验
- 认证、发布、公开站重设计分阶段提交

## Git and checks

不要使用 `git push --force`、`git reset --hard` 或 `git clean -fd`。

修改后至少运行：

```bash
npm test
node --check editor.js
node --check build.js
node build.js
git diff --check
git status
```
