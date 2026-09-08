'use client';

import Link from 'next/link';
import type { Project } from '@/types/project';

export function ProjectCard({ project }: { project: Project }) { return <Link href={`/projects/${project.id}`} className="block rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/70"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-mono uppercase tracking-widest text-cyan-400">Project</p><h3 className="mt-2 text-lg font-semibold text-white">{project.name}</h3></div><span className="text-xs text-slate-500">Open →</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-400">{project.description || 'No description provided.'}</p><p className="mt-6 text-xs text-slate-500">Updated {new Date(project.updated_at).toLocaleDateString()}</p></Link>; }
