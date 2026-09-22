'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Project } from '@/types/project';

export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations('projectCard');
  return (
    <Link
      href={`/projects/${project.public_id}`}
      className="block rounded-xl border border-slate-200/70 bg-white/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-white hover:shadow-md backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-cyan-600">{t('project')}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{project.name}</h3>
        </div>
        <span className="text-xs text-cyan-600">{t('open')}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-500">
        {project.description || t('noDescription')}
      </p>
      <p className="mt-6 text-xs text-slate-400">
        {t('updated', { date: new Date(project.updated_at).toLocaleDateString() })}
      </p>
    </Link>
  );
}
