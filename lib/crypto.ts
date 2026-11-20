import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEV_FALLBACK_SESSION_SECRET = 'caremeds-local-dev-session-secret-not-for-production-000000000000';
const DEV_FALLBACK_MFA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SESSION_SECRET;
}

function getMfaKeyBuffer(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY || DEV_FALLBACK_MFA_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export interface SignedSessionPayload {
  userId: string;
  role: string;
  exp: number; // millisecond timestamp
  iat: number; // millisecond timestamp
  nonce: string;
}

/**
 * Creates a cryptographically signed session token using HMAC-SHA256 and SESSION_SECRET.
 * This allows stateless verification across multiple serverless lambda containers on Vercel.
 */
export function signSessionToken(payload: SignedSessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSessionSecret())
    .update(`session:${data}`)
    .digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verifies a signed session token. Returns the decoded payload if valid and not expired, or null.
 */
export function verifySessionToken(token: string): SignedSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return null;
  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!data || !sig) return null;

  const expectedSig = createHmac('sha256', getSessionSecret())
    .update(`session:${data}`)
    .digest('base64url');

  if (!safeCompare(sig, expectedSig)) return null;

  try {
    const raw = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as SignedSessionPayload;
    if (!parsed.userId || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null; // Expired
    return parsed;
  } catch {
    return null;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getMfaKeyBuffer();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }
  const key = getMfaKeyBuffer();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function deriveCsrfToken(sessionTokenHash: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(`csrf:${sessionTokenHash}`)
    .digest('hex');
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
