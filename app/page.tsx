import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';
import { loadStore } from '@/lib/store/repository';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const ctx = await getSessionContext();
  if (ctx) {
    if (ctx.user.mustChangePassword) {
      redirect('/change-password');
    }
    const store = loadStore();
    const requireCaretakerMfa = store.systemSettings.require_mfa_caretakers === 'true';
    const needsMfa =
      !ctx.user.mfaEnabled &&
      (ctx.user.role === 'Admin' ||
        ctx.user.role === 'Doctor' ||
        (ctx.user.role === 'Caretaker' && requireCaretakerMfa));
    if (needsMfa) {
      redirect('/mfa-enroll');
    }
    redirect('/dashboard');
  }

  const store = loadStore();
  if (store.systemSettings.setup_completed !== 'true') {
    redirect('/setup');
  }
  redirect('/login');
}
