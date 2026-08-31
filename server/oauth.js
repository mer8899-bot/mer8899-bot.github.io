const { randomToken, sha256 } = require('./security');

function createOAuthClient(config, fetchImpl = fetch) {
  const callbackUrl = `${config.appOrigin}/auth/github/callback`;

  return {
    createAuthorization() {
      const state = randomToken(32);
      const verifier = randomToken(48);
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', sha256(verifier));
      url.searchParams.set('code_challenge_method', 'S256');
      return { state, verifier, url: url.toString() };
    },

    async exchangeCode(code, verifier) {
      const response = await fetchImpl('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: callbackUrl,
          code_verifier: verifier
        })
      });
      const result = await response.json();
      if (!response.ok || !result.access_token) throw new Error('OAuth token exchange failed');
      return result.access_token;
    },

    async fetchUser(accessToken) {
      const response = await fetchImpl('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2026-03-10'
        }
      });
      if (!response.ok) throw new Error('GitHub identity request failed');
      return response.json();
    }
  };
}

module.exports = { createOAuthClient };
