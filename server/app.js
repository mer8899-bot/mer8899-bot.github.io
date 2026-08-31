const { createArticle } = require('./article');
const { authConfigured, publishConfigured } = require('./config');
const { parseCookies, serializeCookie } = require('./cookies');
const { createGitHubPublisher } = require('./github');
const { createOAuthClient } = require('./oauth');
const { createTokenCodec, randomToken, safeEqual } = require('./security');

const OAUTH_COOKIE = 'shenlan_oauth';
const SESSION_COOKIE = 'shenlan_session';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function createAuthApp({ config, fetchImpl = fetch, now = () => Date.now(), oauthClient, publisher } = {}) {
  const configured = authConfigured(config);
  const codec = configured ? createTokenCodec(config.sessionSecret, now) : null;
  const oauth = oauthClient || (configured ? createOAuthClient(config, fetchImpl) : null);
  const publishService = publisher || (publishConfigured(config) ? createGitHubPublisher(config, fetchImpl) : null);
  const cookieOptions = { httpOnly: true, sameSite: 'Lax', secure: config.secureCookies, path: '/' };
  const publishTasks = new Map();
  const rateLimits = new Map();

  function getSession(request) {
    if (!codec) return null;
    const cookies = parseCookies(request.headers.get('cookie') || '');
    return codec.verify(cookies[SESSION_COOKIE], 'session');
  }

  function issueSessionCookie(user) {
    const token = codec.sign({
      kind: 'session',
      userId: String(user.id),
      login: String(user.login || ''),
      csrf: randomToken(24)
    }, 60 * 60 * 12);
    return serializeCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 12 });
  }

  function clearCookie(name) {
    return serializeCookie(name, '', { ...cookieOptions, maxAge: 0 });
  }

  function validOrigin(request) {
    const origin = request.headers.get('origin');
    return origin === config.appOrigin;
  }

  function allowedByRateLimit(userId) {
    const cutoff = now() - 10 * 60 * 1000;
    const recent = (rateLimits.get(userId) || []).filter(time => time > cutoff);
    if (recent.length >= 10) return false;
    recent.push(now());
    rateLimits.set(userId, recent);
    return true;
  }

  async function publishOnce(idempotencyKey, article) {
    const existing = publishTasks.get(idempotencyKey);
    if (existing && existing.expiresAt > now()) return existing.promise;
    const promise = publishService.publish(article).then(result => ({
      ok: true,
      path: result.path,
      commitSha: result.commitSha,
      status: 'submitted'
    }));
    publishTasks.set(idempotencyKey, { expiresAt: now() + 15 * 60 * 1000, promise });
    try {
      return await promise;
    } catch (error) {
      publishTasks.delete(idempotencyKey);
      throw error;
    }
  }

  async function handle(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/auth/github') {
      if (!configured) return json({ error: '写作服务尚未完成配置' }, 503);
      const authorization = oauth.createAuthorization();
      const flowToken = codec.sign({
        kind: 'oauth',
        state: authorization.state,
        verifier: authorization.verifier
      }, 10 * 60);
      return redirect(authorization.url, [
        serializeCookie(OAUTH_COOKIE, flowToken, { ...cookieOptions, maxAge: 10 * 60 })
      ]);
    }

    if (request.method === 'GET' && url.pathname === '/auth/github/callback') {
      if (!configured) return json({ error: '写作服务尚未完成配置' }, 503);
      const cookies = parseCookies(request.headers.get('cookie') || '');
      const flow = codec.verify(cookies[OAUTH_COOKIE], 'oauth');
      const state = url.searchParams.get('state') || '';
      const code = url.searchParams.get('code') || '';
      if (!flow || !code || !safeEqual(flow.state, state)) {
        return json({ error: '登录验证已失效，请重新登录' }, 400);
      }

      try {
        const accessToken = await oauth.exchangeCode(code, flow.verifier);
        const user = await oauth.fetchUser(accessToken);
        if (!safeEqual(String(user.id), config.authorizedUserId)) {
          return json({ error: '这个入口只对作者本人开放' }, 403, {
            'Set-Cookie': clearCookie(OAUTH_COOKIE)
          });
        }
        return redirect(`${config.appOrigin}/write/`, [
          issueSessionCookie(user),
          clearCookie(OAUTH_COOKIE)
        ]);
      } catch (_error) {
        return json({ error: 'GitHub 登录没有完成，请稍后重试' }, 502, {
          'Set-Cookie': clearCookie(OAUTH_COOKIE)
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session') {
      const session = getSession(request);
      if (!session || !safeEqual(String(session.userId), config.authorizedUserId)) {
        return json({ authenticated: false });
      }
      return json({
        authenticated: true,
        user: { login: session.login },
        csrfToken: session.csrf
      });
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const session = getSession(request);
      if (session && (!validOrigin(request) || !safeEqual(session.csrf, request.headers.get('x-csrf-token') || ''))) {
        return json({ error: '请求验证失败，请刷新页面后重试' }, 403);
      }
      return new Response(null, {
        status: 204,
        headers: { 'Set-Cookie': clearCookie(SESSION_COOKIE), 'Cache-Control': 'no-store' }
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/publish') {
      const session = getSession(request);
      if (!session) return json({ error: '请先登录后再发布' }, 401);
      if (!safeEqual(String(session.userId), config.authorizedUserId)) {
        return json({ error: '这个入口只对作者本人开放' }, 403);
      }
      if (!validOrigin(request) || !safeEqual(session.csrf, request.headers.get('x-csrf-token') || '')) {
        return json({ error: '请求验证失败，请刷新页面后重试' }, 403);
      }
      if (!publishService) return json({ error: '发布服务尚未完成配置' }, 503);

      const idempotencyKey = request.headers.get('idempotency-key') || '';
      if (!/^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)) {
        return json({ error: '发布请求已失效，请刷新页面后重试' }, 400);
      }

      let article;
      try {
        const bodyText = await request.text();
        if (Buffer.byteLength(bodyText, 'utf8') > 220 * 1024) {
          return json({ error: '文章内容过大' }, 413);
        }
        article = createArticle(JSON.parse(bodyText));
      } catch (error) {
        const message = error instanceof SyntaxError ? '文章格式不正确' : error.message;
        return json({ error: message }, 400);
      }

      const existing = publishTasks.get(idempotencyKey);
      if (!existing && !allowedByRateLimit(session.userId)) {
        return json({ error: '发布得太频繁，请稍后再试' }, 429);
      }
      try {
        return json(await publishOnce(idempotencyKey, article), 201);
      } catch (_error) {
        return json({ error: '暂时无法提交到 GitHub，草稿已为你保留' }, 502);
      }
    }

    return json({ error: 'Not found' }, 404);
  }

  return { handle, issueSessionCookie };
}

module.exports = { createAuthApp };
