'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Layers3, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import type { PlanLayer, ProjectElement } from '@/types/project';
import { LAYER_PALETTE, countElementsByLayer } from '@/lib/editor/layers';

type LayersPanelProps = {
  layers: PlanLayer[];
  activeLayerId: string;
  elements: ProjectElement[];
  selectionCount: number;
  actions: {
    addLayer: () => void;
    updateLayer: (id: string, changes: Partial<PlanLayer>) => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string) => void;
    assignSelectionToLayer: (id: string) => void;
  };
};

export function LayersPanel({ layers, activeLayerId, elements, selectionCount, actions }: LayersPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startRename(layer: PlanLayer) {
    setEditingId(layer.id);
    setDraftName(layer.name);
  }

  function commitRename(layer: PlanLayer) {
    const name = draftName.trim();
    if (name && name !== layer.name) actions.updateLayer(layer.id, { name });
    setEditingId(null);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Layers3 className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-bold text-slate-800">Capas del plano 2D</h2>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Los elementos nuevos se dibujan en la capa activa. Renombra, cambia el color, oculta o bloquea cada capa.
      </p>

      <button
        type="button"
        onClick={actions.addLayer}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Nueva capa
      </button>

      <ul className="mt-3 space-y-2">
        {layers.map((layer) => {
          const active = layer.id === activeLayerId;
          const count = countElementsByLayer(elements, layer.id);
          return (
            <li
              key={layer.id}
              className={`rounded-xl border p-2.5 transition ${active ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center gap-2">
                <label className="relative h-6 w-6 shrink-0 cursor-pointer rounded-md border border-slate-200" style={{ background: layer.color }} title={`Color de ${layer.name}`}>
                  <input
                    type="color"
                    value={layer.color}
                    onChange={(event) => actions.updateLayer(layer.id, { color: event.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label={`Color de la capa ${layer.name}`}
                  />
                </label>
                {editingId === layer.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => commitRename(layer)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename(layer);
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-violet-300 px-2 py-1 text-xs outline-none"
                    aria-label="Nombre de la capa"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { actions.setActiveLayer(layer.id); startRename(layer); }}
                    className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-700"
                    title="Renombrar capa"
                  >
                    {layer.name}
                  </button>
                )}
                <span className="shrink-0 text-[10px] text-slate-400">{count}</span>
                <IconToggle
                  onClick={() => actions.updateLayer(layer.id, { visible: !layer.visible })}
                  label={layer.visible ? `Ocultar ${layer.name}` : `Mostrar ${layer.name}`}
                  icon={layer.visible ? Eye : EyeOff}
                  muted={!layer.visible}
                />
                <IconToggle
                  onClick={() => actions.updateLayer(layer.id, { locked: !layer.locked })}
                  label={layer.locked ? `Desbloquear ${layer.name}` : `Bloquear ${layer.name}`}
                  icon={layer.locked ? Lock : Unlock}
                  muted={layer.locked}
                />
                <IconToggle
                  onClick={() => actions.removeLayer(layer.id)}
                  label={`Eliminar ${layer.name}`}
                  icon={Trash2}
                  disabled={layers.length <= 1}
                  danger
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {LAYER_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => actions.updateLayer(layer.id, { color })}
                    className="h-4 w-4 rounded-full border border-white shadow-sm"
                    style={{ background: color }}
                    aria-label={`Aplicar color ${color} a ${layer.name}`}
                  />
                ))}
                {!active && (
                  <button
                    type="button"
                    onClick={() => actions.setActiveLayer(layer.id)}
                    className="ml-auto text-[10px] font-semibold text-violet-600"
                  >
                    Activar
                  </button>
                )}
                {active && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600">
                    <Check className="h-3 w-3" />
                    Activa
                  </span>
                )}
              </div>
              {selectionCount > 0 && (
                <button
                  type="button"
                  onClick={() => actions.assignSelectionToLayer(layer.id)}
                  className="mt-2 w-full rounded-lg border border-dashed border-violet-300 py-1.5 text-[10px] font-semibold text-violet-600 hover:bg-violet-50"
                >
                  Mover selección ({selectionCount}) a esta capa
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconToggle({
  onClick,
  label,
  icon: Icon,
  muted,
  danger,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: typeof Eye;
  muted?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : muted ? 'bg-slate-100 text-slate-500' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-30`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
