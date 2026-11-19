import { argon2id } from '@noble/hashes/argon2.js';
import { randomBytes } from 'node:crypto';
import { safeCompare } from '../crypto';

const ARGON2_PARAMS = {
  t: 2,
  m: 19456, // 19 MiB (OWASP recommended baseline for Argon2id)
  p: 1,
  dkLen: 32,
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = argon2id(password, salt, ARGON2_PARAMS);
  const saltB64 = Buffer.from(salt).toString('base64');
  const hashB64 = Buffer.from(derived).toString('base64');
  return `$argon2id$v=19$m=${ARGON2_PARAMS.m},t=${ARGON2_PARAMS.t},p=${ARGON2_PARAMS.p}$${saltB64}$${hashB64}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[1] !== 'argon2id') return false;
  const paramStr = parts[3];
  const saltB64 = parts[4];
  const expectedB64 = parts[5];

  const paramMap: Record<string, number> = {};
  for (const pair of paramStr.split(',')) {
    const [k, v] = pair.split('=');
    paramMap[k] = Number(v);
  }
  if (!paramMap.m || !paramMap.t || !paramMap.p) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(expectedB64, 'base64');
  const actual = argon2id(password, salt, {
    m: paramMap.m,
    t: paramMap.t,
    p: paramMap.p,
    dkLen: expected.length,
  });

  return safeCompare(Buffer.from(actual).toString('base64'), expectedB64);
}

export function validatePasswordRules(
  newPassword: string,
  username: string,
  currentOrTempPassword?: string
): { valid: boolean; error?: string } {
  if (newPassword.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (newPassword.trim().toLowerCase() === username.trim().toLowerCase()) {
    return { valid: false, error: 'Password cannot match your username.' };
  }
  if (currentOrTempPassword && newPassword === currentOrTempPassword) {
    return { valid: false, error: 'New password cannot match the temporary or current password.' };
  }
  return { valid: true };
}

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

export function generateTemporaryPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

export function generateUsername(fullName: string, existingUsernames: Iterable<string>): string {
  const existing = new Set(Array.from(existingUsernames, (u) => u.toLowerCase()));
  const cleaned = fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const first = cleaned[0] || 'staff';
  const last = cleaned.length > 1 ? cleaned[cleaned.length - 1] : 'user';
  const base = `${first}.${last}`;

  if (!existing.has(base)) return base;

  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = String(100 + (randomBytes(2).readUInt16BE(0) % 900));
    const candidate = `${base}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }

  return `${base}${Date.now().toString().slice(-3)}`;
}
