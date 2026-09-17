'use client';

import { useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Download, Maximize2, X } from 'lucide-react';
import {
  BAR_DIAMETERS,
  DEFAULT_BEAM_LOADS,
  DEFAULT_BEAM_REINFORCEMENT,
  DEFAULT_COLUMN_LOADS,
  DEFAULT_COLUMN_REINFORCEMENT,
  DEFAULT_CONCRETE,
  beamDesign,
  columnDesign,
  currentInputs,
  isMemoryStale,
  memoryToMarkdown,
} from '@/lib/engineering/member-design';
import type {
  BeamElement,
  BeamProperties,
  ColumnElement,
  ColumnProperties,
  DesignMemory,
  ProjectElement,
} from '@/types/project';

type DesignableElement = ColumnElement | BeamElement;

export type DesignPatch = Partial<ColumnProperties & BeamProperties>;

export function isDesignable(element: ProjectElement | undefined): element is DesignableElement {
  return element?.element_type === 'column' || element?.element_type === 'beam';
}

function elementLabel(element: DesignableElement): string {
  const kind = element.element_type === 'column' ? 'Columna' : 'Viga';
  return `${kind} ${element.id.slice(0, 8)}`;
}

export function MemberDesignPanel({
  element,
  projectName,
  onUpdate,
}: {
  element: DesignableElement;
  projectName: string;
  onUpdate: (id: string, properties: DesignPatch) => void;
}) {
  const [showFullMemory, setShowFullMemory] = useState(false);

  const concrete = element.properties.concrete ?? DEFAULT_CONCRETE;
  const reinforcement =
    element.properties.reinforcement ??
    (element.element_type === 'column' ? DEFAULT_COLUMN_REINFORCEMENT : DEFAULT_BEAM_REINFORCEMENT);
  const loads =
    element.properties.design_loads ??
    (element.element_type === 'column' ? DEFAULT_COLUMN_LOADS : DEFAULT_BEAM_LOADS);
  const memory = element.properties.design_memory;
  const stale = memory ? isMemoryStale(memory, currentInputs(element, concrete, reinforcement, loads)) : false;

  function patch(properties: DesignPatch) {
    onUpdate(element.id, properties);
  }

  function calculate() {
    const result: DesignMemory =
      element.element_type === 'column'
        ? columnDesign(element, concrete, reinforcement, loads)
        : beamDesign(element, concrete, reinforcement, loads);
    patch({ concrete, reinforcement, design_loads: loads, design_memory: result });
  }

  function download() {
    if (!memory) return;
    const markdown = memoryToMarkdown(memory, { projectName, elementLabel: elementLabel(element) });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memoria-${element.element_type}-${element.id.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <header>
        <h2 className="text-sm font-bold text-slate-800">{elementLabel(element)}</h2>
        <p className="mt-1 text-[11px] text-slate-400">Refuerzo, concreto y memoria de cálculo</p>
      </header>

      {memory && (
        <div
          className={`mt-3 rounded-xl border p-3 text-[11px] leading-5 ${stale ? 'border-rose-200 bg-rose-50 text-rose-800' : memory.status === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {!stale && memory.status === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {stale ? 'Memoria desactualizada' : memory.status === 'ok' ? 'Elemento ya calculado' : 'Calculado con observaciones'}
          </div>
          <p className="mt-1">
            {stale
              ? 'Cambiaste datos de entrada después de calcular. Los resultados mostrados corresponden a los datos anteriores: valida nuevamente las cargas y recalcula antes de descargar la memoria.'
              : memory.status === 'ok'
                ? 'No recomendamos cambiar nada de este elemento. Si modificas secciones, refuerzo o materiales, valida nuevamente las cargas y vuelve a calcular.'
                : 'Revisa las observaciones y valida nuevamente las cargas antes de aprobar este elemento.'}
          </p>
          <p className="mt-1 text-[10px] opacity-80">
            {new Date(memory.calculated_at).toLocaleString('es-CO')} · D/C {memory.ratio}
          </p>
        </div>
      )}

      <Section title="Geometría">
        {element.element_type === 'column' ? (
          <>
            <Field label="Ancho b (m)" step={0.05} value={element.properties.width} onChange={(width) => patch({ width })} />
            <Field label="Profundidad h (m)" step={0.05} value={element.properties.depth} onChange={(depth) => patch({ depth })} />
            <Field label="Altura (m)" step={0.1} value={element.properties.height} onChange={(height) => patch({ height })} />
          </>
        ) : (
          <>
            <Field label="Ancho b (m)" step={0.05} value={element.properties.width} onChange={(width) => patch({ width })} />
            <Field label="Altura h (m)" step={0.05} value={element.properties.height} onChange={(height) => patch({ height })} />
            <Field label="Luz L (m)" step={0.1} value={element.properties.length} onChange={(length) => patch({ length })} />
          </>
        )}
      </Section>

      <Section title="Concreto y acero">
        <Field label="f'c (MPa)" value={concrete.fc} onChange={(fc) => patch({ concrete: { ...concrete, fc } })} />
        <Field label="fy (MPa)" value={concrete.fy} onChange={(fy) => patch({ concrete: { ...concrete, fy } })} />
        <Field label="Recubrimiento (m)" step={0.005} value={concrete.cover} onChange={(cover) => patch({ concrete: { ...concrete, cover } })} />
      </Section>

      <Section title="Refuerzo">
        <Field label="Barras longitudinales" value={reinforcement.bar_count} onChange={(bar_count) => patch({ reinforcement: { ...reinforcement, bar_count } })} />
        <label className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          Diámetro barra (mm)
          <select
            value={reinforcement.bar_diameter}
            onChange={(event) => patch({ reinforcement: { ...reinforcement, bar_diameter: Number(event.target.value) } })}
            className="h-8 w-24 rounded-md border border-slate-200 px-2 text-xs"
          >
            {BAR_DIAMETERS.map((diameter) => (
              <option key={diameter} value={diameter}>{diameter}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          Diámetro estribo (mm)
          <select
            value={reinforcement.stirrup_diameter}
            onChange={(event) => patch({ reinforcement: { ...reinforcement, stirrup_diameter: Number(event.target.value) } })}
            className="h-8 w-24 rounded-md border border-slate-200 px-2 text-xs"
          >
            {BAR_DIAMETERS.map((diameter) => (
              <option key={diameter} value={diameter}>{diameter}</option>
            ))}
          </select>
        </label>
        <Field label="Separación estribos (m)" step={0.01} value={reinforcement.stirrup_spacing} onChange={(stirrup_spacing) => patch({ reinforcement: { ...reinforcement, stirrup_spacing } })} />
      </Section>

      <Section title="Cargas externas mayoradas">
        {element.element_type === 'column' ? (
          <Field label="Axial Pu,externa (kN)" value={loads.axial} onChange={(axial) => patch({ design_loads: { ...loads, axial } })} />
        ) : (
          <Field label="Distribuida wu,externa (kN/m)" value={loads.distributed} onChange={(distributed) => patch({ design_loads: { ...loads, distributed } })} />
        )}
      </Section>

      <button
        type="button"
        onClick={calculate}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700"
      >
        <Calculator className="h-3.5 w-3.5" />
        {memory ? 'Recalcular memoria' : 'Calcular memoria'}
      </button>

      {memory && (
        <>
          <Section title={stale ? 'Memoria de cálculo (datos anteriores)' : 'Memoria de cálculo'}>
            <dl className="space-y-1">
              {memory.summary.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
                  <dt className="text-slate-500">{item.label}</dt>
                  <dd className="font-semibold text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
            {memory.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-700">
                {memory.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </Section>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setShowFullMemory(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:border-violet-300">
              <Maximize2 className="h-3.5 w-3.5" />Ver más
            </button>
            <button type="button" onClick={download} disabled={stale} title={stale ? 'Recalcula la memoria para descargarla' : undefined} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50">
              <Download className="h-3.5 w-3.5" />Descargar
            </button>
          </div>
        </>
      )}

      {showFullMemory && memory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-bold">Memoria de cálculo — {elementLabel(element)}</h3>
              <button type="button" onClick={() => setShowFullMemory(false)} aria-label="Cerrar memoria" className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-4 text-xs leading-6 text-slate-700">
              <p className="text-[11px] text-slate-400">{memory.code}</p>
              {memory.steps.map((entry, index) => (
                <section key={entry.title} className="mt-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{index + 1}. {entry.title}</h4>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{entry.formula}</p>
                  <p className="font-mono text-[11px] text-slate-500">{entry.substitution}</p>
                  <p className="font-semibold text-slate-900">{entry.result}</p>
                </section>
              ))}
              {memory.warnings.length > 0 && (
                <section className="mt-5 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
                  <h4 className="font-bold">Observaciones</h4>
                  <ul className="mt-1 list-disc pl-4">
                    {memory.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </section>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={download} disabled={stale} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-3.5 w-3.5" />Descargar memoria
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-8 w-24 rounded-md border border-slate-200 px-2 text-xs text-slate-900"
      />
    </label>
  );
}
