'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeftRight, CircleDot, CloudRain, Loader2, MoveDown, Snowflake, Trash2, Wind, Zap } from 'lucide-react';
import type { EditorState } from '@/hooks/use-editor-state';
import { api } from '@/lib/api-client';
import type { LoadCase, LoadType } from '@/types/structural-load';

const loadTypes: { id: LoadType; label: string; icon: typeof MoveDown; className: string }[] = [
  { id: 'dead', label: 'Dead', icon: MoveDown, className: 'bg-slate-100 text-slate-600' }, { id: 'live', label: 'Live', icon: ArrowDown, className: 'bg-blue-50 text-blue-600' }, { id: 'point', label: 'Point', icon: CircleDot, className: 'bg-red-50 text-red-500' }, { id: 'distributed', label: 'Distributed', icon: ArrowLeftRight, className: 'bg-orange-50 text-orange-500' }, { id: 'wind', label: 'Wind', icon: Wind, className: 'bg-cyan-50 text-cyan-600' }, { id: 'snow', label: 'Snow', icon: Snowflake, className: 'bg-slate-100 text-slate-500' }, { id: 'seismic', label: 'Seismic', icon: Zap, className: 'bg-violet-50 text-violet-600' }, { id: 'self_weight', label: 'Self weight', icon: CloudRain, className: 'bg-emerald-50 text-emerald-600' },
];

export function LoadEditor({ projectId, state }: { projectId: string; state: EditorState }) {
  const [cases, setCases] = useState<LoadCase[]>([]);
  const [selectedType, setSelectedType] = useState<LoadType | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { api.loadCases(projectId).then(setCases).catch(() => setMessage('Unable to load load cases')); }, [projectId]);

  async function chooseLoad(type: LoadType) {
    setSelectedType(type); setMessage(''); setPending(true);
    try {
      const loadCase = cases[0] ?? await api.createLoadCase(projectId, { name: 'Default service case', category: 'service' });
      if (!cases.length) setCases([loadCase]);
      await api.createLoad(projectId, { load_case_id: loadCase.id, element_id: state.elements[0]?.id ?? null, load_type: type, magnitude: 1, unit: type === 'point' ? 'kN' : 'kN/m', direction: '-Y', position: {} });
      setMessage(`${type.replace('_', ' ')} load saved`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save load'); } finally { setPending(false); }
  }

  return <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"><aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">Select a load type to store a model input. Analysis results are not generated in this version.</div><h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Explore loads</h2><div className="mt-3 grid grid-cols-2 gap-2">{loadTypes.map(({ id, label, icon: Icon, className }) => <button key={id} type="button" onClick={() => chooseLoad(id)} disabled={pending} className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-[11px] font-semibold transition hover:scale-[1.02] disabled:opacity-60 ${className}`}><Icon className="h-5 w-5" />{label}</button>)}</div><button type="button" disabled className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-xs font-semibold text-red-400"><Trash2 className="h-4 w-4" />Remove load</button></aside><main className="dot-grid relative flex min-w-0 flex-1 items-center justify-center p-4 sm:p-6"><div className="w-full max-w-md rounded-2xl border border-white bg-white/90 p-8 text-center shadow-xl shadow-slate-300/20"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">{pending ? <Loader2 className="h-7 w-7 animate-spin" /> : <Zap className="h-7 w-7" />}</div><h2 className="mt-4 text-xl font-bold">Load workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">{state.elements.length ? 'Choose a load type from the left panel to add it to the default service case.' : 'Your canvas is empty. Add structural elements in the 2D view before applying loads.'}</p>{message && <p className="mt-4 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">{message}</p>}<span className="mt-5 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{cases.length} load cases · Inputs only</span></div></main><aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white p-4 xl:block"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Properties</h2><div className="mt-5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-5 text-center text-xs leading-5 text-slate-500">{selectedType ? `${selectedType.replace('_', ' ')} load selected` : 'Select a load to inspect its properties.'}</div></aside></div>;
}
