import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { buildCredentialCsv } from '@/lib/exports/csv';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth('user.create');
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const store = loadStore();
  const target = store.users.find((u) => u.userId === id);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!target.pendingTempPasswordForExport) {
    return NextResponse.json(
      {
        error:
          'Credential file has already been downloaded or expired. Only the password hash is stored—reset the user’s password to generate a new one-time file.',
      },
      { status: 410 }
    );
  }

  const csv = buildCredentialCsv({
    fullName: target.fullName,
    role: target.role,
    username: target.username,
    temporaryPassword: target.pendingTempPasswordForExport,
    expiresOn: (target.tempPasswordExpiresAt || new Date().toISOString()).slice(0, 10),
    facility: store.facility.name,
  });

  // Immediately clear plaintext temp password after generating the one-time file
  target.pendingTempPasswordForExport = null;

  const exportId = randomUUID();
  store.credentialExports.unshift({
    exportId,
    targetUserId: target.userId,
    exportedBy: auth.ctx.user.userId,
    exportedAt: new Date().toISOString(),
  });

  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'EXPORT_CREDENTIALS',
    tableName: 'credential_exports',
    recordId: exportId,
    newValues: { target_user_id: target.userId, target_username: target.username },
  });
  persistStore(store);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="caremeds-credentials-${target.username}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
