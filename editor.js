const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync, exec } = require("child_process");

const ROOT = __dirname;
const PORT = 4321;
const HOST = "127.0.0.1";

function run(command, args = []) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function getDateInfo() {
  const now = new Date();

  const date =
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate());

  const time =
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  return { date, time };
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>深蓝 · 写作</title>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #fff;
    color: #202124;
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "PingFang SC",
      "Helvetica Neue",
      Arial,
      sans-serif;
  }

  .page {
    width: min(760px, calc(100% - 40px));
    margin: 70px auto;
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 60px;
  }

  .brand {
    font-size: 14px;
    color: #888;
  }

  .status {
    font-size: 13px;
    color: #999;
  }

  #title {
    width: 100%;
    border: 0;
    outline: 0;
    padding: 0;
    margin-bottom: 32px;
    font-size: 32px;
    font-weight: 600;
    line-height: 1.35;
    color: #202124;
  }

  #title::placeholder {
    color: #ccc;
  }

  #content {
    width: 100%;
    min-height: 430px;
    resize: none;
    border: 0;
    outline: 0;
    padding: 0;
    font-family: inherit;
    font-size: 18px;
    line-height: 1.9;
    color: #303134;
  }

  #content::placeholder {
    color: #ccc;
  }

  .bottom {
    position: sticky;
    bottom: 0;
    padding: 24px 0 30px;
    background: rgba(255,255,255,.95);
    display: flex;
    justify-content: flex-end;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 11px 24px;
    font-size: 15px;
    cursor: pointer;
    background: #202124;
    color: white;
  }

  button:disabled {
    opacity: .45;
    cursor: default;
  }

  .message {
    margin-right: auto;
    font-size: 14px;
    color: #777;
    align-self: center;
  }
</style>
</head>

<body>

<div class="page">

  <div class="top">
    <div class="brand">深蓝 · 写作</div>
    <div class="status" id="saveStatus">已保存</div>
  </div>

  <input
    id="title"
    placeholder="标题"
    autocomplete="off"
  >

  <textarea
    id="content"
    placeholder="开始写点什么……"
  ></textarea>

  <div class="bottom">
    <div class="message" id="message"></div>
    <button id="publish">发布</button>
  </div>

</div>

<script>
const title = document.getElementById("title");
const content = document.getElementById("content");
const button = document.getElementById("publish");
const saveStatus = document.getElementById("saveStatus");
const message = document.getElementById("message");

title.value = localStorage.getItem("blogDraftTitle") || "";
content.value = localStorage.getItem("blogDraftContent") || "";

let timer;

function saveDraft() {
  saveStatus.textContent = "保存中…";

  clearTimeout(timer);

  timer = setTimeout(() => {
    localStorage.setItem("blogDraftTitle", title.value);
    localStorage.setItem("blogDraftContent", content.value);
    saveStatus.textContent = "已保存";
  }, 300);
}

title.addEventListener("input", saveDraft);
content.addEventListener("input", saveDraft);

button.addEventListener("click", async () => {

  const t = title.value.trim();
  const c = content.value.trim();

  if (!t) {
    message.textContent = "请先写标题";
    title.focus();
    return;
  }

  if (!c) {
    message.textContent = "正文还是空的";
    content.focus();
    return;
  }

  button.disabled = true;
  button.textContent = "发布中…";
  message.textContent = "正在同步到 GitHub";

  try {

    const response = await fetch("/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: t,
        content: c
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "发布失败");
    }

    localStorage.removeItem("blogDraftTitle");
    localStorage.removeItem("blogDraftContent");

    title.value = "";
    content.value = "";

    message.innerHTML =
      "✓ 已推送 GitHub，网站正在更新";

    button.textContent = "已发布";

    setTimeout(() => {
      button.disabled = false;
      button.textContent = "发布";
    }, 2000);

  } catch (error) {

    message.textContent = "发布失败：" + error.message;
    button.disabled = false;
    button.textContent = "重新发布";

  }

});
</script>

</body>
</html>`;

const server = http.createServer((req, res) => {

  if (req.method === "GET" && req.url === "/") {

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(page);
    return;
  }

  if (req.method === "POST" && req.url === "/publish") {

    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", () => {

      try {

        const data = JSON.parse(body);

        const title = String(data.title || "")
          .replace(/\\r?\\n/g, " ")
          .trim();

        const content = String(data.content || "").trim();

        if (!title || !content) {
          return sendJson(res, 400, {
            error: "标题和正文不能为空"
          });
        }

        const status = run("git", ["status", "--porcelain"]);

        if (status) {
          return sendJson(res, 409, {
            error:
              "本地还有未提交的修改。先处理这些修改后再发布。"
          });
        }

        run("git", ["pull", "--rebase"]);

        const { date, time } = getDateInfo();

        const filename = `${date}-${time}.md`;

        const relativePath = path.join("posts", filename);
        const fullPath = path.join(ROOT, relativePath);

        const markdown =
`---
title: ${title}
date: ${date}
type: thought
---

${content}
`;

        fs.writeFileSync(fullPath, markdown, "utf8");

        run("node", ["build.js"]);

        run("git", [
          "add",
          relativePath,
          "posts/posts.json"
        ]);

        run("git", [
          "commit",
          "-m",
          `add: ${date} ${title}`
        ]);

        run("git", ["push"]);

        sendJson(res, 200, {
          ok: true,
          filename
        });

      } catch (error) {

        console.error(error);

        sendJson(res, 500, {
          error:
            error.stderr?.toString().trim() ||
            error.message ||
            "未知错误"
        });

      }

    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");

});

server.listen(PORT, HOST, () => {

  const url = `http://${HOST}:${PORT}`;

  console.log("");
  console.log("✓ 深蓝写作后台已启动");
  console.log("");
  console.log(url);
  console.log("");
  console.log("不要关闭这个 Terminal 窗口。");
  console.log("");

  if (process.platform === "darwin") {
    exec(`open "${url}"`);
  }

});
