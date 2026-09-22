'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle, Loader2, CircleDot } from 'lucide-react';

export function SaveStatus({
  dirty,
  saving,
  error,
  revision,
}: {
  dirty: boolean;
  saving: boolean;
  error: string;
  revision?: number;
}) {
  const t = useTranslations('editor.saveStatus');

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <AlertCircle className="h-3.5 w-3.5" />
        {t('failed')}
      </span>
    );
  }
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('saving')}
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <CircleDot className="h-3.5 w-3.5" />
        {t('unsaved')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
      <CheckCircle className="h-3.5 w-3.5" />
      {revision ? t('savedRevision', { revision }) : t('saved')}
    </span>
  );
}
