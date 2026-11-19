import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type {
  SafeUser,
  UserRecord,
  AuditLogRecord,
} from '../types';
import { createInitialPreviewStore, type CareMedsStoreData } from './seed-data';

const STORE_FILE_PATH = '/tmp/caremeds-preview-store-v1.json';

declare global {
  var _caremedsMemoryStore: CareMedsStoreData | undefined;
}

export function loadStore(): CareMedsStoreData {
  if (!global._caremedsMemoryStore) {
    if (existsSync(STORE_FILE_PATH)) {
      try {
        const raw = readFileSync(STORE_FILE_PATH, 'utf8');
        global._caremedsMemoryStore = JSON.parse(raw) as CareMedsStoreData;
      } catch {
        global._caremedsMemoryStore = createInitialPreviewStore();
        persistStore(global._caremedsMemoryStore);
      }
    } else {
      global._caremedsMemoryStore = createInitialPreviewStore();
      persistStore(global._caremedsMemoryStore);
    }
  }
  return global._caremedsMemoryStore;
}

export function persistStore(store: CareMedsStoreData): void {
  global._caremedsMemoryStore = store;
  try {
    writeFileSync(STORE_FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist local preview store:', (err as Error).message);
  }
}

export function appendAuditLog(
  store: CareMedsStoreData,
  entry: {
    userId: string | null;
    action: string;
    tableName: string;
    recordId: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }
): AuditLogRecord {
  const record: AuditLogRecord = {
    auditId: store.nextAuditId++,
    userId: entry.userId,
    action: entry.action,
    tableName: entry.tableName,
    recordId: entry.recordId,
    oldValues: entry.oldValues ?? null,
    newValues: entry.newValues ?? null,
    createdAt: new Date().toISOString(),
  };
  store.auditLog.push(record);
  return record;
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    userId: user.userId,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    tempPasswordExpiresAt: user.tempPasswordExpiresAt,
    isLocked: user.isLocked,
    lockedAt: user.lockedAt,
    mfaEnabled: user.mfaEnabled,
    mfaEnrolledAt: user.mfaEnrolledAt,
    hasPendingCredentialExport: Boolean(user.pendingTempPasswordForExport),
    createdAt: user.createdAt,
  };
}

export function revokeAllUserSessions(store: CareMedsStoreData, userId: string): void {
  const now = new Date().toISOString();
  for (const s of store.sessions) {
    if (s.userId === userId && !s.revokedAt) {
      s.revokedAt = now;
    }
  }
}

export function queueAlertIfNotActive(
  store: CareMedsStoreData,
  params: {
    alertCode: 'LOW_STOCK' | 'EXPIRY' | 'MISSED_DOSE' | 'OVERDUE_DOSE' | 'ABNORMAL_VITAL' | 'PRESCRIPTION_ENDING';
    priority: 'High' | 'Medium' | 'Low';
    residentId?: string | null;
    stockId?: string | null;
    doseEventId?: string | null;
    readingId?: string | null;
    prescriptionId?: string | null;
    message: string;
  }
) {
  const existing = store.alerts.find(
    (a) =>
      a.alertCode === params.alertCode &&
      (a.status === 'Open' || a.status === 'Acknowledged' || a.status === 'Escalated') &&
      (a.residentId ?? null) === (params.residentId ?? null) &&
      (a.stockId ?? null) === (params.stockId ?? null) &&
      (a.doseEventId ?? null) === (params.doseEventId ?? null) &&
      (a.readingId ?? null) === (params.readingId ?? null) &&
      (a.prescriptionId ?? null) === (params.prescriptionId ?? null)
  );
  if (existing) return existing;

  const escMin = Number(store.systemSettings.escalation_minutes || '15');
  const createdAt = new Date().toISOString();
  const alert = {
    alertId: randomUUID(),
    alertCode: params.alertCode,
    priority: params.priority,
    status: 'Open' as const,
    residentId: params.residentId ?? null,
    stockId: params.stockId ?? null,
    doseEventId: params.doseEventId ?? null,
    readingId: params.readingId ?? null,
    prescriptionId: params.prescriptionId ?? null,
    message: params.message,
    createdAt,
    dueBy:
      params.priority === 'High'
        ? new Date(Date.now() + escMin * 60_000).toISOString()
        : null,
    escalatedTo: null,
  };
  store.alerts.unshift(alert);

  // Queue notifications for opted-in family contacts on High MISSED_DOSE or ABNORMAL_VITAL
  if (
    params.residentId &&
    ((params.alertCode === 'MISSED_DOSE' && params.priority === 'High') ||
      params.alertCode === 'ABNORMAL_VITAL')
  ) {
    const contacts = store.residentContacts.filter(
      (c) => c.residentId === params.residentId && c.receivesNotifications
    );
    for (const c of contacts) {
      store.notifications.unshift({
        notificationId: randomUUID(),
        residentContactId: c.contactId,
        userId: null,
        alertId: alert.alertId,
        incidentId: null,
        channel: c.email ? 'Email' : 'SMS',
        status: 'Queued',
        attempts: 0,
        lastError: null,
        sentAt: null,
        createdAt,
      });
    }
  }

  return alert;
}
