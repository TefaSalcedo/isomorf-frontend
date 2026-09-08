'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProjectEditor } from '@/components/editor/project-editor';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { api } from '@/lib/api-client';
import type { Project } from '@/types/project';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.project(id).then(setProject).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load project')); }, [id]);
  return <ProtectedRoute>{project ? <ProjectEditor initialProject={project} /> : <main className="grid min-h-screen place-items-center bg-[#07101d] text-slate-300">{error || 'Loading project...'}</main>}</ProtectedRoute>;
}
