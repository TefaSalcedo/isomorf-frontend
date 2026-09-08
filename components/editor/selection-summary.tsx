'use client';

import type { SelectionSummary } from '@/lib/editor/calculations';

export function SelectionSummary({ summary }: { summary: SelectionSummary | null }) {
  if (!summary) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <p className="text-sm text-slate-500">Select elements on the canvas to see calculations.</p>
      </div>
    );
  }
  const items = [
    { label: 'Total length', value: `${summary.totalLength.toFixed(2)} m` },
    { label: 'Volume', value: `${summary.volume.toFixed(2)} m³` },
    { label: 'Walls', value: `${summary.wallCount}` },
    {
      label: 'Interior area',
      value: summary.interiorArea === null ? 'Not available' : `${summary.interiorArea.toFixed(2)} m²`,
    },
    {
      label: 'Exterior area',
      value: summary.exteriorArea === null ? 'Not available' : `${summary.exteriorArea.toFixed(2)} m²`,
    },
  ];
  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Calculations</p>
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
