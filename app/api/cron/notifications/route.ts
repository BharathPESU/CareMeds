import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/crypto';
import { loadStore, persistStore } from '@/lib/store/repository';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  return safeCompare(auth.slice(7), secret);
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const store = loadStore();
  let processed = 0;
  let failed = 0;

  for (const n of store.notifications) {
    if (n.status !== 'Queued') continue;
    n.attempts += 1;
    const providerReady =
      (n.channel === 'Email' && Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('MY_'))) ||
      (n.channel === 'SMS' && Boolean(process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('MY_')));

    if (providerReady) {
      n.status = 'Sent';
      n.sentAt = new Date().toISOString();
      n.lastError = null;
      processed++;
    } else if (n.attempts >= 3) {
      n.status = 'Failed';
      n.lastError = `${n.channel} delivery provider credentials are not configured.`;
      failed++;
    } else {
      n.lastError = `Deferred attempt ${n.attempts}/3: provider not configured.`;
    }
  }

  persistStore(store);
  return NextResponse.json({ ok: true, processed, failed });
}
