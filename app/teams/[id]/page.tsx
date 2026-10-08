'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Copy, Layers3, Link2, Trash2, Users } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useAuth } from '@/lib/auth/auth-context';
import { api, ApiError } from '@/lib/api-client';
import type { Project } from '@/types/project';
import type { TeamDetail, TeamInviteCreated, TeamRole } from '@/types/team';

const INVITE_ROLES: TeamRole[] = ['viewer', 'editor'];
const MEMBER_ROLES: TeamRole[] = ['viewer', 'editor', 'owner'];
const INVITE_DAYS = 7;

function TeamContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [invite, setInvite] = useState<TeamInviteCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = team?.my_role === 'owner';

  const reload = useCallback(() => {
    api.team(id).then((data) => { setTeam(data); setNotFound(false); }).catch((e) => {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : t('loadError'));
    });
  }, [id, t]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (isOwner) api.projects().then((items) => setMyProjects(items.filter((p) => (p.access_role ?? 'owner') === 'owner'))).catch(() => undefined);
  }, [isOwner]);

  const shareable = useMemo(() => {
    const shared = new Set(team?.projects.map((p) => p.id));
    return myProjects.filter((p) => !shared.has(p.id));
  }, [myProjects, team]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); reload(); } catch (e) { setError(e instanceof Error ? e.message : t('loadError')); } finally { setBusy(false); }
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const role = String(data.get('role') || 'viewer') as TeamRole;
    setCopied(false);
    await run(async () => setInvite(await api.createInvite(id, { email: email || undefined, role, expires_in_days: INVITE_DAYS })));
  }

  async function copyLink() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite.accept_url); setCopied(true); } catch { setCopied(false); }
  }

  async function shareProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectId = String(new FormData(event.currentTarget).get('project_id') || '');
    if (!projectId) return;
    await run(() => api.shareProject(id, projectId));
  }

  async function deleteTeam() {
    if (!window.confirm(t('confirmDelete'))) return;
    await run(async () => { await api.deleteTeam(id); router.replace('/teams'); });
  }

  if (notFound) {
    return <main className="grid min-h-screen place-items-center bg-[#f8f9ff] p-5 text-slate-600"><div className="text-center"><p role="alert">{t('notFound')}</p><Link href="/teams" className="mt-4 inline-block text-sm font-semibold text-violet-600">{t('title')}</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />{t('title')}</Link>
        <div className="ml-auto"><LanguageSwitcher /></div>
      </header>
      <section className="mx-auto w-full max-w-5xl space-y-8 p-5 sm:p-8">
        {!team && !error && <p className="text-sm text-slate-500" role="status">{tc('loading')}</p>}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{error}</p>}
        {team && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><Users className="h-7 w-7" /></span>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
                  <p className="mt-1 text-sm text-slate-500">{t('membersCount', { count: team.member_count })} · {t('projectsCount', { count: team.project_count })} · {t('yourRole')}: <span className="font-semibold text-violet-700">{t(`roles.${team.my_role}`)}</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                {isOwner ? (
                  <button type="button" onClick={deleteTeam} disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />{t('deleteTeam')}</button>
                ) : (
                  <button type="button" onClick={() => run(async () => { await api.leaveTeam(id); router.replace('/teams'); })} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('leave')}</button>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <section className="space-y-4 lg:col-span-3">
                <h2 className="text-xl font-bold tracking-tight">{t('membersTitle')}</h2>
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
                  {team.members.map((member) => {
                    const name = `${member.first_name} ${member.last_name}`.trim() || member.email;
                    const isCreator = member.user_id === team.owner_id;
                    return (
                      <li key={member.id} className="flex flex-wrap items-center gap-3 p-4">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white" aria-hidden>{member.first_name?.[0] ?? member.email[0]}</span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{name}{member.user_id === user?.id ? ` (${tc('you')})` : ''}</strong><small className="block truncate text-xs text-slate-500">{member.email}</small></span>
                        {isOwner && !isCreator ? (
                          <>
                            <select aria-label={t('changeRole', { name })} value={member.role} disabled={busy} onChange={(e) => run(() => api.updateMemberRole(id, member.id, e.target.value as TeamRole))} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs">
                              {MEMBER_ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                            </select>
                            <button type="button" disabled={busy} onClick={() => run(() => api.removeMember(id, member.id))} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">{t('remove')}</button>
                          </>
                        ) : (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{t(`roles.${member.role}`)}</span>
                        )}
                      </li>
                    );
                  })}
                  {team.members.length === 0 && <li className="p-4 text-sm text-slate-500">{t('noMembers')}</li>}
                </ul>

                {isOwner && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-bold">{t('inviteTitle')}</h3>
                    <form onSubmit={createInvite} className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input name="email" type="email" placeholder={t('inviteEmailPlaceholder')} aria-label={t('inviteEmailPlaceholder')} className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-500" />
                      <select name="role" defaultValue="viewer" aria-label={t('inviteRoleLabel')} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
                        {INVITE_ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                      </select>
                      <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50"><Link2 className="h-4 w-4" />{t('generateLink')}</button>
                    </form>
                    {invite && (
                      <div className="mt-4 rounded-xl bg-violet-50 p-4" role="status">
                        <p className="text-xs text-violet-800">{t('inviteLinkReady', { days: INVITE_DAYS })}</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input readOnly value={invite.accept_url} aria-label={t('copyLink')} data-testid="invite-link" onFocus={(e) => e.currentTarget.select()} className="h-10 flex-1 rounded-lg border border-violet-200 bg-white px-3 font-mono text-xs" />
                          <button type="button" onClick={copyLink} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t('copied') : t('copyLink')}</button>
                        </div>
                      </div>
                    )}
                    {team.invites.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('invitesTitle')}</h4>
                        <ul className="mt-2 divide-y divide-slate-100">
                          {team.invites.map((item) => (
                            <li key={item.id} className="flex items-center gap-3 py-2 text-xs">
                              <span className="min-w-0 flex-1 truncate">{item.email ?? t('inviteAnyone')} · {t(`roles.${item.role}`)}</span>
                              <span className="text-slate-400">{t('expires', { date: new Date(item.expires_at).toLocaleDateString() })}</span>
                              <button type="button" disabled={busy} onClick={() => run(() => api.revokeInvite(id, item.id))} className="font-semibold text-red-600 hover:underline disabled:opacity-50">{t('revoke')}</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-4 lg:col-span-2">
                <h2 className="text-xl font-bold tracking-tight">{t('projectsTitle')}</h2>
                {isOwner && (
                  <form onSubmit={shareProject} className="flex gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-label={t('shareTitle')}>
                    <select name="project_id" defaultValue="" aria-label={t('sharePlaceholder')} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs">
                      <option value="" disabled>{t('sharePlaceholder')}</option>
                      {shareable.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                    <button disabled={busy || shareable.length === 0} className="h-10 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-50">{t('share')}</button>
                  </form>
                )}
                <ul className="space-y-3">
                  {team.projects.map((project) => (
                    <li key={project.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-500"><Layers3 className="h-5 w-5" /></span>
                      <Link href={`/projects/${project.public_id}`} className="min-w-0 flex-1"><strong className="block truncate text-sm hover:text-violet-700">{project.name}</strong><small className="block truncate text-xs text-slate-500">{project.description}</small></Link>
                      {isOwner && <button type="button" disabled={busy} onClick={() => run(() => api.unshareProject(id, project.id))} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">{t('unshare')}</button>}
                    </li>
                  ))}
                  {team.projects.length === 0 && <li className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center text-sm text-slate-500">{t('noProjects')}</li>}
                </ul>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function TeamPage() { return <ProtectedRoute><TeamContent /></ProtectedRoute>; }
