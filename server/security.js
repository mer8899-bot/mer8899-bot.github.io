const crypto = require('node:crypto');

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString('base64url');
}

function randomToken(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

function sha256(value) {
  return base64url(crypto.createHash('sha256').update(value).digest());
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createTokenCodec(secret, now = () => Date.now()) {
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET 至少需要 32 个字符');
  }

  function signature(encoded) {
    return base64url(crypto.createHmac('sha256', secret).update(encoded).digest());
  }

  return {
    sign(payload, ttlSeconds) {
      const encoded = base64url(JSON.stringify({
        ...payload,
        exp: Math.floor(now() / 1000) + ttlSeconds
      }));
      return `${encoded}.${signature(encoded)}`;
    },

    verify(token, expectedKind) {
      if (!token || !token.includes('.')) return null;
      const [encoded, suppliedSignature] = token.split('.', 2);
      if (!safeEqual(signature(encoded), suppliedSignature)) return null;
      try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (payload.exp <= Math.floor(now() / 1000)) return null;
        if (expectedKind && payload.kind !== expectedKind) return null;
        return payload;
      } catch (_error) {
        return null;
      }
    }
  };
}

module.exports = { base64url, createTokenCodec, randomToken, safeEqual, sha256 };
