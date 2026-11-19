import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { canAccessResident } from '@/lib/permissions/scope';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { z } from 'zod';

const signedUrlSchema = z.object({
  residentId: z.string().min(1),
  documentType: z.enum(['Lab result', 'Visit letter', 'Other']),
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.coerce.number().int().min(1).max(10 * 1024 * 1024, 'File exceeds 10 MB maximum'),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('clinical_notes.create');
  if (!auth.ok) return auth.response;

  const parsed = signedUrlSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid upload metadata' }, { status: 400 });
  }

  const store = loadStore();
  const resident = store.residents.find((r) => r.residentId === parsed.data.residentId);
  if (!resident) {
    return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
  }

  if (
    !canAccessResident(
      { userId: auth.ctx.user.userId, role: auth.ctx.user.role },
      resident,
      store.careAssignments
    )
  ) {
    return NextResponse.json({ error: 'Forbidden: resident outside your scope' }, { status: 403 });
  }

  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const docId = randomUUID();
  const storagePath = `resident-documents/${resident.residentId}/${docId}-${safeName}`;
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  const record = {
    documentId: docId,
    residentId: resident.residentId,
    documentType: parsed.data.documentType,
    storagePath,
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    uploadedBy: auth.ctx.user.userId,
    uploadedAt: new Date().toISOString(),
  };

  store.residentDocuments.unshift(record);
  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'INSERT',
    tableName: 'resident_documents',
    recordId: docId,
    newValues: { file_name: record.fileName, document_type: record.documentType },
  });
  persistStore(store);

  return NextResponse.json({
    ok: true,
    document: record,
    signedUrlExpiresAt: expiresAt,
    bucket: 'resident-documents',
    supabaseStorageConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
