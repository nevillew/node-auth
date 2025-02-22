const crypto = require('crypto');

function base64URLEncode(str) {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256')
    .update(verifier)
    .digest();
  return base64URLEncode(hash);
}

module.exports = {
  generateCodeVerifier,
  generateCodeChallenge
};
