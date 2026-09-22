'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, CheckCircle2, FlaskConical, LockKeyhole } from 'lucide-react';

export function FemComingSoon() {
  const t = useTranslations('editor.fem');
  const capabilities = t.raw('capabilities') as string[];

  return (
    <div className="dot-grid flex h-full min-h-0 items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-xl shadow-violet-950/5 sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-violet-600">
          <FlaskConical className="h-8 w-8" />
        </div>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
          <LockKeyhole className="h-3.5 w-3.5" />
          {t('comingSoon')}
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('title')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{t('subtitle')}</p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {capabilities.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <BarChart3 className="h-4 w-4" />
          {t('footer')}
        </div>
      </div>
    </div>
  );
}
