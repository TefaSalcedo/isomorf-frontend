'use client';

import { useTranslations } from 'next-intl';
import type { SelectionSummary } from '@/lib/editor/calculations';

export function SelectionSummary({ summary }: { summary: SelectionSummary | null }) {
  const t = useTranslations('editor.panels.summary');

  if (!summary) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <p className="text-sm text-slate-500">{t('empty')}</p>
      </div>
    );
  }
  const items = [
    { label: t('totalLength'), value: `${summary.totalLength.toFixed(2)} m` },
    { label: t('volume'), value: `${summary.volume.toFixed(2)} m³` },
    { label: t('walls'), value: `${summary.wallCount}` },
    {
      label: t('interiorArea'),
      value: summary.interiorArea === null ? t('notAvailable') : `${summary.interiorArea.toFixed(2)} m²`,
    },
    {
      label: t('exteriorArea'),
      value: summary.exteriorArea === null ? t('notAvailable') : `${summary.exteriorArea.toFixed(2)} m²`,
    },
  ];
  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('title')}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm text-slate-500">{item.label}</span>
            <span className="text-sm font-medium text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
