const assert = require('node:assert/strict');
const test = require('node:test');
const { createArticle } = require('../server/article');
const { createAuthApp } = require('../server/app');

const config = {
  appOrigin: 'https://writer.example.com',
  appId: '1',
  privateKey: 'not-used-by-mock',
  installationId: '2',
  authorizedUserId: '12345',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  sessionSecret: 'b'.repeat(48),
  secureCookies: true,
  repoOwner: 'mer8899-bot',
  repoName: 'mer8899-bot.github.io'
};

function setup(userId = 12345) {
  let calls = 0;
  const publisher = {
    async publish(article) {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      return { path: article.path, commitSha: 'abc123' };
    }
  };
  const app = createAuthApp({ config, publisher, oauthClient: {}, persistArticle() {} });
  const cookie = app.issueSessionCookie({ id: userId, login: 'author' }).split(';', 1)[0];
  return { app, cookie, calls: () => calls };
}

function publishRequest(cookie, body, key = 'request_key_123456789') {
  return new Request(`${config.appOrigin}/api/publish`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: config.appOrigin,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      'X-CSRF-Token': decodeSessionCsrf(cookie)
    },
    body: JSON.stringify(body)
  });
}

function decodeSessionCsrf(cookie) {
  const token = decodeURIComponent(cookie.split('=', 2)[1]);
  const encoded = token.split('.', 1)[0];
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')).csrf;
}

test('publish rejects anonymous and non-author sessions', async () => {
  const { app } = setup();
  const anonymous = await app.handle(new Request(`${config.appOrigin}/api/publish`, { method: 'POST' }));
  assert.equal(anonymous.status, 401);

  const outsider = setup(999);
  const denied = await outsider.app.handle(publishRequest(outsider.cookie, { title: '标题', content: '正文' }));
  assert.equal(denied.status, 403);
});

test('article validation rejects empty or oversized values', async () => {
  const { app, cookie } = setup();
  const empty = await app.handle(publishRequest(cookie, { title: '', content: '正文' }, 'empty_request_12345'));
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { error: '请先写标题' });

  const long = await app.handle(publishRequest(cookie, { title: '标题', content: '字'.repeat(100001) }, 'long_request_123456'));
  assert.ok([400, 413].includes(long.status));
});

test('Markdown front matter safely quotes special title characters', () => {
  const article = createArticle(
    { title: '标题: "深蓝"\n第二行', content: '第一段\r\n\r\n第二段' },
    { now: () => new Date(2026, 7, 31, 9, 8, 7), unique: () => 'fixed' }
  );
  assert.equal(article.filename, '2026-08-31-090807-fixed.md');
  assert.match(article.markdown, /^---\ntitle: "标题: \\"深蓝\\" 第二行"\ndate: 2026-08-31/m);
  assert.match(article.markdown, /第一段\n\n第二段/);
});

test('duplicate submit key produces one GitHub write', async () => {
  const { app, cookie, calls } = setup();
  const body = { title: '同一篇', content: '只发布一次' };
  const [first, second] = await Promise.all([
    app.handle(publishRequest(cookie, body, 'duplicate_key_123456')),
    app.handle(publishRequest(cookie, body, 'duplicate_key_123456'))
  ]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(calls(), 1);
  assert.equal((await first.json()).commitSha, 'abc123');
});
