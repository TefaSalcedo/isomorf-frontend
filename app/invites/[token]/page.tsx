'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, Clock, LogIn, ShieldCheck, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import type { InvitePreview } from '@/types/team';

type PageState = 'loading' | 'ready' | 'accepting' | 'invalid' | 'expired' | 'error';

export default function InvitePage() {
  const t = useTranslations('invite');
  const tc = useTranslations('common');
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.invitePreview(token)
      .then((data) => { if (!cancelled) { setPreview(data); setState('ready'); } })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError instanceof ApiError && requestError.status === 410) setState('expired');
        else if (requestError instanceof ApiError && requestError.status === 404) setState('invalid');
        else setState('error');
      });
    return () => { cancelled = true; };
  }, [token]);

  async function accept() {
    setState('accepting');
    setError('');
    try {
      await api.acceptInvite(token);
      router.replace('/dashboard');
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 410) setState('expired');
      else if (requestError instanceof ApiError && requestError.status === 404) setState('invalid');
      else {
        setState('ready');
        setError(requestError instanceof Error ? requestError.message : t('errorBody'));
      }
    }
  }

  const emailMismatch = Boolean(preview?.email && user && preview.email !== user.email.toLowerCase());
  const returnPath = `/invites/${token}`;

  return (
    <main className="grid min-h-screen place-items-center bg-[#faf8fd] px-4 py-10 text-slate-900">
      <div className="absolute right-4 top-4 sm:right-8"><LanguageSwitcher /></div>
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_18px_60px_rgba(76,29,149,.10)]">
        <div className="border-b border-violet-50 px-8 py-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/25"><span className="text-base font-bold">S</span></span>
            <span><span className="block text-base font-bold tracking-tight text-slate-950">{tc('appName')}</span><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-violet-600">{tc('tagline')}</span></span>
          </Link>
        </div>
        <div className="px-8 py-8">
          {state === 'loading' || authLoading ? (
            <p className="py-8 text-center text-sm text-slate-400" role="status">{tc('loading')}</p>
          ) : state === 'invalid' || state === 'expired' || state === 'error' ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-500"><TriangleAlert className="h-7 w-7" /></span>
              <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-950">{t(`${state}Title`)}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t(`${state}Body`)}</p>
              <Link href="/" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-violet-300">{t('backHome')}</Link>
            </div>
          ) : preview ? (
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"><Users className="h-3.5 w-3.5" />{t('badge')}</span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{t('title', { team: preview.team_name })}</h1>
              {preview.invited_by && <p className="mt-1.5 text-sm text-slate-500">{t('subtitle', { name: preview.invited_by })}</p>}
              <dl className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-violet-500" />{t('roleLabel')}</dt>
                  <dd><span className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-bold capitalize text-violet-700">{preview.role}</span></dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 font-semibold text-slate-500"><Clock className="h-4 w-4 text-violet-500" />{t('expiresLabel')}</dt>
                  <dd className="text-xs font-medium text-slate-600">{new Date(preview.expires_at).toLocaleDateString()}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-400">{t(`roleHint.${preview.role}`)}</p>
              {preview.email && (
                <p className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${emailMismatch ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  {emailMismatch ? t('emailMismatch', { current: user?.email ?? '', expected: preview.email }) : t('forEmail', { email: preview.email })}
                </p>
              )}
              {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
              <div className="mt-6">
                {user ? (
                  <button onClick={accept} disabled={state === 'accepting' || emailMismatch} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 disabled:opacity-50">
                    {state === 'accepting' ? t('accepting') : t('accept')}<ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="space-y-3">
                    <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700"><LogIn className="h-4 w-4" />{t('signInToAccept')}</Link>
                    <Link href={`/register?next=${encodeURIComponent(returnPath)}`} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 transition hover:border-violet-300"><UserPlus className="h-4 w-4" />{t('createToAccept')}</Link>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
