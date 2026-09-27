'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api-client';
import { rememberPendingInvite } from '@/lib/teams/pending-invite';
import type { InvitePreview } from '@/types/team';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.invitePreview(token).then(setPreview).catch(() => setError(t('invite.invalid')));
  }, [token, t]);

  useEffect(() => {
    if (!loading && !user) rememberPendingInvite(token);
  }, [loading, user, token]);

  async function accept() {
    setPending(true); setError('');
    try {
      const team = await api.acceptInvite(token);
      setJoined(team.name);
      setTimeout(() => router.replace(`/teams/${team.id}`), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('invite.invalid'));
    } finally { setPending(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9ff] p-5 text-slate-900">
      <div className="absolute right-5 top-5"><LanguageSwitcher /></div>
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-violet-100/40" aria-live="polite">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-600"><Users className="h-6 w-6" /></span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{t('invite.title')}</h1>
        {error && !preview && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        {!error && !preview && <p className="mt-3 text-sm text-slate-500" role="status">{tc('loading')}</p>}
        {preview && (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t('invite.subtitle', { inviter: preview.invited_by, team: preview.team_name, role: t(`roles.${preview.role}`) })}</p>
            {preview.email && <p className="mt-2 text-xs text-slate-500">{t('invite.forEmail', { email: preview.email })}</p>}
            <p className="mt-1 text-xs text-slate-400">{t('expires', { date: new Date(preview.expires_at).toLocaleDateString() })}</p>
            {joined && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{t('invite.accepted', { team: joined })}</p>}
            {error && <p className="mt-5 text-sm text-red-600" role="alert">{error}</p>}
            {!joined && !loading && user && (
              <button type="button" onClick={accept} disabled={pending} className="mt-6 h-12 w-full rounded-xl bg-violet-600 text-sm font-bold text-white disabled:opacity-50">{pending ? t('invite.accepting') : t('invite.accept')}</button>
            )}
            {!loading && !user && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-slate-600">{t('invite.loginFirst')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/login" className="grid h-11 place-items-center rounded-xl bg-violet-600 text-sm font-bold text-white">{t('invite.signIn')}</Link>
                  <Link href="/register" className="grid h-11 place-items-center rounded-xl border border-violet-200 text-sm font-bold text-violet-700">{t('invite.register')}</Link>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
