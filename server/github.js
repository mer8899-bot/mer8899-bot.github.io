const crypto = require('node:crypto');
const { base64url } = require('./security');

function createAppJwt(config, now = () => Date.now()) {
  const issuedAt = Math.floor(now() / 1000) - 60;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: config.appId
  }));
  const unsigned = `${header}.${payload}`;
  const privateKey = config.privateKey.replace(/\\n/g, '\n');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

function createGitHubPublisher(config, fetchImpl = fetch) {
  const apiHeaders = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10'
  };

  async function installationToken() {
    const response = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
      {
        method: 'POST',
        headers: { ...apiHeaders, Authorization: `Bearer ${createAppJwt(config)}` },
        body: JSON.stringify({
          repositories: [config.repoName],
          permissions: { contents: 'write' }
        })
      }
    );
    const result = await response.json();
    if (!response.ok || !result.token) throw new Error('Installation token request failed');
    return result.token;
  }

  return {
    async publish(article) {
      const token = await installationToken();
      const url = `https://api.github.com/repos/${encodeURIComponent(config.repoOwner)}/${encodeURIComponent(config.repoName)}/contents/${article.path.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetchImpl(url, {
        method: 'PUT',
        headers: {
          ...apiHeaders,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `add: ${article.date} ${article.title}`,
          content: Buffer.from(article.markdown, 'utf8').toString('base64')
        })
      });
      const result = await response.json();
      if (!response.ok || !result.commit?.sha) throw new Error('GitHub content write failed');
      return { path: article.path, commitSha: result.commit.sha };
    }
  };
}

module.exports = { createAppJwt, createGitHubPublisher };
