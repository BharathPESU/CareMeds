import { randomBytes } from 'node:crypto';
import { sha256Hex } from '../crypto';
import type { MfaRecoveryCodeRecord } from '../types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function formatRecoveryCode(): string {
  const bytes = randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(`recovery:${normalizeRecoveryCode(code)}`);
}

export function generateRecoveryCodes(count = 10): { plainCodes: string[]; hashes: string[] } {
  const plainCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const plain = formatRecoveryCode();
    plainCodes.push(plain);
    hashes.push(hashRecoveryCode(plain));
  }
  return { plainCodes, hashes };
}

export function findMatchingUnusedRecoveryCode(
  records: MfaRecoveryCodeRecord[],
  candidateCode: string
): MfaRecoveryCodeRecord | null {
  const candidateHash = hashRecoveryCode(candidateCode);
  return records.find((r) => !r.usedAt && r.codeHash === candidateHash) || null;
}
