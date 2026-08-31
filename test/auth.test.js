const assert = require('node:assert/strict');
const test = require('node:test');
const { createAuthApp } = require('../server/app');

const config = {
  appOrigin: 'https://writer.example.com',
  authorizedUserId: '12345',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  sessionSecret: 'a'.repeat(48),
  secureCookies: true
};

function oauthFor(user) {
  return {
    createAuthorization() {
      return { state: 'known-state', verifier: 'known-verifier', url: 'https://github.com/login/oauth/authorize?state=known-state' };
    },
    async exchangeCode() { return 'temporary-user-token'; },
    async fetchUser() { return user; }
  };
}

async function beginFlow(app) {
  const response = await app.handle(new Request(`${config.appOrigin}/auth/github`));
  const cookie = response.headers.get('set-cookie').split(';', 1)[0];
  return cookie;
}

test('session endpoint denies anonymous requests', async () => {
  const app = createAuthApp({ config, oauthClient: oauthFor({ id: 12345, login: 'author' }) });
  const response = await app.handle(new Request(`${config.appOrigin}/api/session`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('OAuth callback rejects a GitHub user outside the numeric allowlist', async () => {
  const app = createAuthApp({ config, oauthClient: oauthFor({ id: 999, login: 'visitor' }) });
  const cookie = await beginFlow(app);
  const response = await app.handle(new Request(
    `${config.appOrigin}/auth/github/callback?code=ok&state=known-state`,
    { headers: { Cookie: cookie } }
  ));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: '这个入口只对作者本人开放' });
});

test('authorized GitHub user receives a secure session', async () => {
  const app = createAuthApp({ config, oauthClient: oauthFor({ id: 12345, login: 'author' }) });
  const oauthCookie = await beginFlow(app);
  const callback = await app.handle(new Request(
    `${config.appOrigin}/auth/github/callback?code=ok&state=known-state`,
    { headers: { Cookie: oauthCookie } }
  ));
  assert.equal(callback.status, 302);
  const setCookie = callback.headers.get('set-cookie');
  assert.match(setCookie, /shenlan_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);

  const sessionCookie = setCookie.match(/shenlan_session=[^;]+/)[0];
  const sessionResponse = await app.handle(new Request(`${config.appOrigin}/api/session`, {
    headers: { Cookie: sessionCookie }
  }));
  const session = await sessionResponse.json();
  assert.equal(session.authenticated, true);
  assert.equal(session.user.login, 'author');
  assert.ok(session.csrfToken.length >= 20);
});

test('OAuth state mismatch is rejected before token exchange', async () => {
  const app = createAuthApp({ config, oauthClient: oauthFor({ id: 12345, login: 'author' }) });
  const cookie = await beginFlow(app);
  const response = await app.handle(new Request(
    `${config.appOrigin}/auth/github/callback?code=ok&state=wrong`,
    { headers: { Cookie: cookie } }
  ));
  assert.equal(response.status, 400);
});

test('successful publish refreshes the served post index', async () => {
  let persisted;
  const app = createAuthApp({
    config,
    oauthClient: oauthFor({ id: 12345, login: 'author' }),
    publisher: { async publish(article) { return { path: article.path, commitSha: 'commit-sha' }; } },
    persistArticle(article) { persisted = article; }
  });
  const oauthCookie = await beginFlow(app);
  const callback = await app.handle(new Request(
    `${config.appOrigin}/auth/github/callback?code=ok&state=known-state`,
    { headers: { Cookie: oauthCookie } }
  ));
  const sessionCookie = callback.headers.get('set-cookie').match(/shenlan_session=[^;]+/)[0];
  const session = await app.handle(new Request(`${config.appOrigin}/api/session`, {
    headers: { Cookie: sessionCookie }
  })).then(response => response.json());
  const response = await app.handle(new Request(`${config.appOrigin}/api/publish`, {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      Origin: config.appOrigin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': 'publish-test-key-123456'
    },
    body: JSON.stringify({ title: '新文章', content: '正文' })
  }));
  assert.equal(response.status, 201);
  assert.equal(persisted.title, '新文章');
});
