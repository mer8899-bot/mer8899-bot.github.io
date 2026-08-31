function loadConfig(env = process.env) {
  const appOrigin = String(
    env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:8787'
  ).replace(/\/$/, '');
  const origin = new URL(appOrigin);

  return {
    appOrigin,
    appId: String(env.GITHUB_APP_ID || ''),
    privateKey: String(env.GITHUB_APP_PRIVATE_KEY || ''),
    installationId: String(env.GITHUB_INSTALLATION_ID || ''),
    authorizedUserId: String(env.AUTHORIZED_GITHUB_USER_ID || ''),
    clientId: String(env.GITHUB_CLIENT_ID || ''),
    clientSecret: String(env.GITHUB_CLIENT_SECRET || ''),
    sessionSecret: String(env.SESSION_SECRET || ''),
    secureCookies: origin.protocol === 'https:',
    port: Number(env.PORT || origin.port || 8787),
    host: String(env.HOST || (env.RENDER ? '0.0.0.0' : '127.0.0.1')),
    repoOwner: String(env.REPO_OWNER || 'mer8899-bot'),
    repoName: String(env.REPO_NAME || 'mer8899-bot.github.io'),
    repoBranch: String(env.REPO_BRANCH || 'main')
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

function publishConfigured(config) {
  return Boolean(config.appId && config.privateKey && config.installationId && config.repoOwner && config.repoName);
}

module.exports = { authConfigured, loadConfig, publishConfigured };
