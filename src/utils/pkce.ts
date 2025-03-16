import crypto from 'crypto';

/**
 * Encodes a buffer or string as base64url (URL safe base64)
 * 
 * @param str The string or buffer to encode
 * @returns Base64url encoded string
 */
export function base64URLEncode(str: string | Buffer): string {
  return Buffer.isBuffer(str)
    ? str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    : Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generates a cryptographically random code verifier for PKCE
 * 
 * @returns A random code verifier string
 */
export function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generates a code challenge from a code verifier using SHA-256 hashing
 * 
 * @param verifier The code verifier to generate a challenge from
 * @returns The code challenge
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256')
    .update(verifier)
    .digest();
  return base64URLEncode(hash);
}