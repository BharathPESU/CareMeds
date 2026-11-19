import type { RoleName } from '../types';

export interface CredentialCsvRow {
  fullName: string;
  role: RoleName;
  username: string;
  temporaryPassword: string;
  expiresOn: string;
  facility: string;
}

function escapeCsvCell(value: string): string {
  // Guard against spreadsheet formula injection and standard RFC 4180 quoting
  const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function buildCredentialCsv(row: CredentialCsvRow): string {
  const header = 'full_name,role,username,temporary_password,expires_on,facility';
  const values = [
    row.fullName,
    row.role,
    row.username,
    row.temporaryPassword,
    row.expiresOn,
    row.facility,
  ].map(escapeCsvCell);

  return `${header}\n${values.join(',')}\n`;
}

export function buildGenericCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map((h) => escapeCsvCell(String(h))).join(',');
  const body = rows
    .map((r) => r.map((cell) => escapeCsvCell(cell == null ? '' : String(cell))).join(','))
    .join('\n');
  return `${head}\n${body}\n`;
}
