'use client';

import { useEffect, useState } from 'react';
import { Check, History, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { HistoryResponse, RevisionChange, RevisionEntry } from '@/types/project';

function summarize(changes: RevisionChange[]): string {
  const counts = { baseline: 0, create: 0, update: 0, delete: 0 };
  for (const change of changes) {
    if (change.operation in counts) counts[change.operation as keyof typeof counts] += 1;
  }
  const parts: string[] = [];
  if (counts.create) parts.push(`+${counts.create} nuevo${counts.create > 1 ? 's' : ''}`);
  if (counts.update) parts.push(`~${counts.update} editado${counts.update > 1 ? 's' : ''}`);
  if (counts.delete) parts.push(`-${counts.delete} eliminado${counts.delete > 1 ? 's' : ''}`);
  if (counts.baseline) parts.push('estado inicial');
  return parts.join(' · ') || 'Sin cambios de elementos';
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function HistoryPanel({
  projectId,
  revision,
  headRevision,
  busy,
  onRestore,
}: {
  projectId: string;
  revision: number;
  headRevision: number;
  busy: boolean;
  onRestore: (revision: number) => void;
}) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .documentHistory(projectId)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setError('');
          setLoading(false);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load history');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, revision, headRevision]);

  const entries: RevisionEntry[] = history?.revisions ?? [];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-bold text-slate-800">Historial del documento</h2>
      </div>
      <p className="text-[11px] leading-4 text-slate-500">
        Cada guardado crea una revisión. Deshacer y rehacer siguen disponibles aunque recargues o cambies de dispositivo.
      </p>
      {loading && (
        <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          Todavía no hay revisiones. Dibuja algo y el historial aparecerá aquí.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => {
          const isCurrent = entry.revision === revision;
          return (
            <li
              key={entry.revision}
              className={`rounded-xl border p-3 text-xs transition ${isCurrent ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">Revisión {entry.revision}</span>
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                    <Check className="h-3 w-3" /> Actual
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRestore(entry.revision)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-violet-100 hover:text-violet-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Restaurar
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{summarize(entry.changes)}</p>
              <p className="mt-1 text-[10px] text-slate-400">{formatTime(entry.created_at)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
