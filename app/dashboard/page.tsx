'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BookOpen, ChevronRight, FolderOpen, Folder as FolderIcon, Grid2x2, Home, Layers3, LogOut, Plus, Search, Settings, Sparkles, Users, X } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api-client';
import type { Project } from '@/types/project';
import type { Folder } from '@/types/folder';

const templates = [
  ['Structural model', 'Frames, columns and walls', 'Model', 'violet'],
  ['Architectural project', 'Distribution and spaces', 'Project', 'blue'],
  ['2D CAD plan', 'Precision technical drawing', 'Plan', 'slate'],
  ['Parametric BIM', 'Intelligent families', 'BIM', 'indigo'],
  ['FEM analysis', 'Mesh and envelopes', 'Coming soon', 'emerald'],
  ['MEP networks', 'Building installations', 'Coming soon', 'slate'],
] as const;

function DashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.allSettled([api.projects(), api.folders()]).then(([projectsResult, foldersResult]) => {
      if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value);
      else setError(projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Unable to load projects');
      if (foldersResult.status === 'fulfilled') setFolders(foldersResult.value);
    });
  }, []);
  const filteredProjects = useMemo(() => { const q = query.trim().toLowerCase(); return q ? projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q)) : projects; }, [projects, query]);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const project = await api.createProject({ name: String(data.name || 'Sin nombre'), description: String(data.description) }); router.push(`/projects/${project.public_id}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to create project'); } finally { setPending(false); }
  }

  return <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
    <header className="sticky top-0 z-30 flex h-16 items-center gap-5 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
      <a href="/dashboard" className="flex w-44 shrink-0 items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-bold text-white">S</span><span><strong className="block text-sm tracking-tight">Isomorf</strong><small className="block text-[9px] text-slate-500">Design · Model · Analyze · Build</small></span></a>
      <div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, BIM models, plans or templates..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /><kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">⌘ K</kbd></div>
      <div className="ml-auto flex items-center gap-3"><button className="hidden rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 sm:block">Learn in 2 min</button><Bell className="h-4 w-4 text-slate-500" /><button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20"><Plus className="h-4 w-4" />New</button><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">{user?.first_name?.[0] ?? 'U'}</span></div>
    </header>
    <div className="flex">
      <aside className="hidden w-48 shrink-0 border-r border-slate-200 bg-white p-3 lg:block"><button onClick={() => setShowForm(true)} className="mb-4 flex w-full items-center justify-center gap-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-500/20"><Plus className="h-4 w-4" />Create</button><nav className="space-y-1 text-sm"><NavItem icon={Home} label="Home" active /><NavItem icon={FolderOpen} label="Projects" /><NavItem icon={Layers3} label="Recents" /><NavItem icon={FolderIcon} label="Folders" /><NavItem icon={Users} label="Teams" soon /><NavItem icon={Grid2x2} label="Templates" /><NavItem icon={BookOpen} label="Library" /></nav><div className="mt-20 border-t border-slate-100 pt-4"><NavItem icon={Settings} label="Settings" /><button onClick={() => logout().then(() => router.replace('/login'))} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button></div></aside>
      <section className="mx-auto w-full max-w-[1400px] space-y-10 p-5 sm:p-8">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50 to-white p-7 sm:p-10"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" /><div className="relative"><span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-violet-700 shadow-sm">Cloud v2026.4 · Workspace connected</span><h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Good morning, {user?.first_name ?? 'there'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">What do you want to design or model today? Start from scratch, calculate loads or import your technical plans.</p><div className="relative mt-6 max-w-3xl"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, models, calculation reports, plans or templates..." className="h-14 w-full rounded-2xl border border-white bg-white pl-12 pr-24 text-sm shadow-lg shadow-violet-200/30 outline-none focus:ring-4 focus:ring-violet-500/10" /><button className="absolute right-2 top-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Explore <ChevronRight className="inline h-3 w-3" /></button></div></div></section>
        <section><SectionTitle title="Create something new" subtitle="Start with a blank canvas optimized for your discipline" /><div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{templates.map(([title, description, tag, color]) => <button key={title} onClick={() => tag === 'Model' || tag === 'Project' || tag === 'Plan' ? setShowForm(true) : undefined} className="group flex min-h-44 flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-md"><span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${color === 'violet' ? 'bg-violet-100 text-violet-700' : color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'}`}><Sparkles className="h-5 w-5" /></span><span><strong className="mt-4 block text-sm">{title}</strong><small className="mt-1 block text-xs leading-4 text-slate-500">{description}</small></span><span className="mt-3 text-[11px] font-semibold text-violet-600">{tag === 'Coming soon' ? tag : 'Start here'} <ChevronRight className="inline h-3 w-3" /></span></button>)}</div></section>
        <section><SectionTitle title="Recent projects" subtitle="Cloud-synced models ready for editing" action="View all" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{filteredProjects.slice(0, 8).map((project) => <a key={project.id} href={`/projects/${project.public_id}`} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div className="grid h-32 place-items-center rounded-xl bg-gradient-to-br from-violet-100 via-indigo-50 to-slate-100 text-violet-400"><Layers3 className="h-12 w-12 opacity-40" /></div><strong className="mt-4 block truncate text-sm">{project.name}</strong><p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.description || 'Structural workspace'}</p><span className="mt-4 block text-[11px] text-slate-400">Updated {new Date(project.updated_at).toLocaleDateString()}</span></a>)}{filteredProjects.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-violet-200 bg-white p-10 text-center text-sm text-slate-500">{query ? 'No projects match your search.' : 'No projects yet. Create your first workspace.'}</div>}</div></section>
        <div className="grid gap-6 lg:grid-cols-5"><section className="lg:col-span-3"><SectionTitle title="Your folders" subtitle="Organize technical files by typology" action="New folder" /><div className="grid gap-3 sm:grid-cols-2">{folders.length ? folders.map((folder) => <FolderCard key={folder.id} label={folder.name} count={folder.project_count} />) : <><FolderCard label="Structural models" count={projects.length} /><FolderCard label="Technical plans" count={0} /><FolderCard label="Calculation reports" count={0} /><FolderCard label="Master thesis" count={0} /></>}</div></section><section className="lg:col-span-2"><SectionTitle title="Teams" subtitle="Collaborate with engineers and architects" action="Invite" /><div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center"><Users className="mx-auto h-8 w-8 text-violet-500" /><p className="mt-3 text-sm font-semibold">Team collaboration coming soon</p><p className="mt-1 text-xs leading-5 text-slate-500">Shared projects with owner, editor and viewer roles.</p></div></section></div>
        <section className="rounded-2xl border border-violet-100 bg-white p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-600"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-sm font-bold">Learn Isomorf in 2 minutes</h2><p className="text-xs text-slate-500">Interactive tutorials to get your model moving</p></div><span className="ml-auto text-xs font-bold text-violet-600">66%</span></div></section>
      </section>
    </div>
    {error && <p className="fixed bottom-5 right-5 z-40 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-lg">{error}</p>}
    {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-5 backdrop-blur-sm"><form onSubmit={createProject} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">New project</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-slate-400" /></button></div><input name="name" placeholder="Project name" className="mt-6 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-500" /><textarea name="description" placeholder="Description" className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-violet-500" /><button disabled={pending} className="mt-5 h-12 w-full rounded-xl bg-violet-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Creating…' : 'Create project'}</button></form></div>}
  </main>;
}

function NavItem({ icon: Icon, label, active, soon }: { icon: typeof Home; label: string; active?: boolean; soon?: boolean }) { return <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-violet-100 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}{soon && <span className="ml-auto text-[9px] text-violet-500">Soon</span>}</button>; }
function SectionTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) { return <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{action && <button className="text-xs font-semibold text-violet-600">{action} <ChevronRight className="inline h-3 w-3" /></button>}</div>; }
function FolderCard({ label, count }: { label: string; count: number }) { return <button className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm hover:border-violet-200"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><FolderIcon className="h-5 w-5" /></span><span><strong className="block text-xs">{label}</strong><small className="text-xs text-slate-500">{count} projects · Ready</small></span></button>; }

export default function DashboardPage() { return <ProtectedRoute><DashboardContent /></ProtectedRoute>; }
