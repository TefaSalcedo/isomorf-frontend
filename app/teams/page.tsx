'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, Plus, Users } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { api } from '@/lib/api-client';
import type { Team } from '@/types/team';

function TeamsContent() {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const router = useRouter();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.teams().then(setTeams).catch((e) => { setTeams([]); setError(e instanceof Error ? e.message : t('loadError')); });
  }, [t]);

  async function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    const name = String(new FormData(event.currentTarget).get('name') || '').trim();
    try {
      const team = await api.createTeam({ name: name || tc('untitled') });
      router.push(`/teams/${team.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : t('loadError')); } finally { setPending(false); }
  }

  return (
    <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />{t('backToDashboard')}</Link>
        <div className="ml-auto"><LanguageSwitcher /></div>
      </header>
      <section className="mx-auto w-full max-w-5xl space-y-8 p-5 sm:p-8">
        <div><h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1><p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p></div>
        <form onSubmit={createTeam} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row" aria-label={t('newTeam')}>
          <input name="name" required maxLength={200} placeholder={t('teamNamePlaceholder')} aria-label={t('teamNamePlaceholder')} className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-500" />
          <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{pending ? t('creating') : t('createTeam')}</button>
        </form>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{error}</p>}
        {teams === null && <p className="text-sm text-slate-500" role="status">{tc('loading')}</p>}
        {teams && teams.length === 0 && <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center text-sm text-slate-500">{t('noTeams')}</div>}
        {teams && teams.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                <Link href={`/teams/${team.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-600"><Users className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{team.name}</strong>
                    <small className="text-xs text-slate-500">{t('membersCount', { count: team.member_count })} · {t('projectsCount', { count: team.project_count })}</small>
                  </span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{t(`roles.${team.my_role}`)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function TeamsPage() { return <ProtectedRoute><TeamsContent /></ProtectedRoute>; }
