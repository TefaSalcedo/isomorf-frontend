'use client';

import { Box, DoorOpen, GripVertical, History, Layers3, Minus, MousePointer2, Redo, SlidersHorizontal, Square, Trash2, Undo } from 'lucide-react';
import type { EditorState, Tool } from '@/hooks/use-editor-state';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Seleccionar', icon: MousePointer2 },
  { id: 'wall', label: 'Muro', icon: Minus },
  { id: 'door', label: 'Puerta', icon: DoorOpen },
  { id: 'window', label: 'Ventana', icon: GripVertical },
  { id: 'column', label: 'Columna', icon: Square },
  { id: 'beam', label: 'Viga', icon: Box },
];

export function MobileToolbar({
  state,
  actions,
  view,
  onViewChange,
  onOpenTools,
  onOpenInspector,
  onOpenLayers,
  onOpenHistory,
}: {
  state: EditorState;
  actions: { setTool: (tool: Tool) => void; undo: () => void; redo: () => void; deleteSelection: () => void };
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  onOpenTools: () => void;
  onOpenInspector: () => void;
  onOpenLayers: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        {(['2d', '3d', 'loads', 'fem'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase transition ${view === mode ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            {mode}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">{state.elements.length} elem.</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2">
        {view === '2d' && TOOLS.map(({ id, label, icon: Icon }) => (
          <BarButton key={id} label={label} icon={Icon} active={state.tool === id} onClick={() => actions.setTool(id)} />
        ))}
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-200" />
        <BarButton label="Deshacer" icon={Undo} disabled={state.revision <= 1 || state.historyBusy} onClick={actions.undo} />
        <BarButton label="Rehacer" icon={Redo} disabled={state.revision >= state.headRevision || state.historyBusy} onClick={actions.redo} />
        <BarButton label="Historial" icon={History} onClick={onOpenHistory} />
        <BarButton label="Eliminar" icon={Trash2} disabled={state.selectedIds.length === 0} onClick={actions.deleteSelection} />
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-200" />
        <BarButton label="Capas" icon={Layers3} onClick={onOpenLayers} />
        <BarButton label="Herramientas" icon={SlidersHorizontal} onClick={onOpenTools} />
        <BarButton label="Propiedades" icon={Box} onClick={onOpenInspector} />
      </div>
    </nav>
  );
}

function BarButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: typeof MousePointer2;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[9px] transition ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-40`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
