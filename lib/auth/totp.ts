import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

export const TOTP_ISSUER = 'CareMeds';

export function createTotpSecret(): string {
  return generateSecret();
}

export function buildTotpUri(username: string, secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: username,
    secret,
    digits: 6,
    period: 30,
  });
}

export async function buildTotpQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 2,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

/**
 * Verifies a 6-digit RFC 6238 TOTP code with 30-second step and 1-step (30s) clock tolerance.
 */
export function verifyTotpCode(token: string, secret: string): boolean {
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const result = verifySync({
      secret,
      token: cleaned,
      epochTolerance: 30,
      digits: 6,
      period: 30,
    });
    return Boolean(result && result.valid);
  } catch {
    return false;
  }
}

export function generateCurrentTotpCode(secret: string): string {
  return generateSync({
    secret,
    digits: 6,
    period: 30,
  });
}
