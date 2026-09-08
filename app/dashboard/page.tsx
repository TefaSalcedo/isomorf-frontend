'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ProjectCard } from '@/components/dashboard/project-card';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api-client';
import type { Project } from '@/types/project';

function DashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.projects().then(setProjects).catch((e) => setError(e.message));
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const description = (project.description ?? '').toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [projects, query]);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const project = await api.createProject({
        name: String(data.name),
        description: String(data.description),
      });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create project');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-cyan-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="font-mono text-xs tracking-[.3em] text-cyan-600">ISOMORF / CONTROL ROOM</p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">Structural workspace</h1>
          </div>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-slate-500">Good to see you,</p>
            <h2 className="mt-1 text-4xl font-semibold text-slate-900">{user?.first_name}</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-4 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white sm:w-64"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-500"
            >
              + New project
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {filteredProjects.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center text-slate-500 backdrop-blur">
              {query ? 'No projects match your search.' : 'No projects yet. Create your first structural workspace.'}
            </div>
          )}
        </div>
      </section>
      {showForm && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <form
            onSubmit={createProject}
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-2xl backdrop-blur-xl"
          >
            <h3 className="text-xl font-semibold text-slate-900">New project</h3>
            <input
              required
              name="name"
              placeholder="Project name"
              className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
            />
            <textarea
              name="description"
              placeholder="Description"
              className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
