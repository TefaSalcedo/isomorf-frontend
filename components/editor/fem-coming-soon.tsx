'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, CheckCircle2, FlaskConical, LockKeyhole } from 'lucide-react';

export function FemComingSoon() {
  const t = useTranslations('editor.fem');
  const capabilities = t.raw('capabilities') as string[];

  return (
    <div className="dot-grid flex h-full min-h-0 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center shadow-2xl sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-950 text-cyan-400">
          <FlaskConical className="h-8 w-8" />
        </div>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-950/60 px-3 py-1 text-xs font-bold text-cyan-300">
          <LockKeyhole className="h-3.5 w-3.5" />
          {t('comingSoon')}
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-100">{t('title')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">{t('subtitle')}</p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {capabilities.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {item}
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <BarChart3 className="h-4 w-4" />
          {t('footer')}
        </div>
      </div>
    </div>
  );
}
