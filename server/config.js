function loadConfig(env = process.env) {
  const appOrigin = String(env.APP_ORIGIN || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const origin = new URL(appOrigin);

  return {
    appOrigin,
    authorizedUserId: String(env.AUTHORIZED_GITHUB_USER_ID || ''),
    clientId: String(env.GITHUB_CLIENT_ID || ''),
    clientSecret: String(env.GITHUB_CLIENT_SECRET || ''),
    sessionSecret: String(env.SESSION_SECRET || ''),
    secureCookies: origin.protocol === 'https:',
    port: Number(env.PORT || origin.port || 8787),
    host: String(env.HOST || '127.0.0.1')
  };
}

function authConfigured(config) {
  return Boolean(
    config.authorizedUserId &&
    config.clientId &&
    config.clientSecret &&
    config.sessionSecret &&
    config.sessionSecret.length >= 32
  );
}

module.exports = { authConfigured, loadConfig };
