'use client';

import { useTranslations } from 'next-intl';
import { Box, DoorOpen, GripVertical, History, Layers3, Minus, MousePointer2, Redo, SlidersHorizontal, Square, Trash2, Undo } from 'lucide-react';
import type { EditorState, Tool } from '@/hooks/use-editor-state';
import { Tooltip } from '@/components/ui/tooltip';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

const TOOLS: { id: Tool; icon: typeof MousePointer2 }[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'wall', icon: Minus },
  { id: 'door', icon: DoorOpen },
  { id: 'window', icon: GripVertical },
  { id: 'column', icon: Square },
  { id: 'beam', icon: Box },
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
  const t = useTranslations('editor.mobile');
  const tt = useTranslations('editor.tools');
  const tv = useTranslations('editor.views');

  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        {(['2d', '3d', 'loads', 'fem'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            aria-pressed={view === mode}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase transition ${view === mode ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            {tv(mode)}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">{t('elementCount', { count: state.elements.length })}</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2">
        {view === '2d' && TOOLS.map(({ id, icon: Icon }) => (
          <BarButton key={id} label={tt(id)} icon={Icon} active={state.tool === id} onClick={() => actions.setTool(id)} />
        ))}
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-200" />
        <BarButton label={t('undo')} icon={Undo} disabled={state.revision <= 1 || state.historyBusy} onClick={actions.undo} />
        <BarButton label={t('redo')} icon={Redo} disabled={state.revision >= state.headRevision || state.historyBusy} onClick={actions.redo} />
        <BarButton label={t('history')} icon={History} onClick={onOpenHistory} />
        <BarButton label={t('delete')} icon={Trash2} disabled={state.selectedIds.length === 0} onClick={actions.deleteSelection} />
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-200" />
        <BarButton label={t('layers')} icon={Layers3} onClick={onOpenLayers} />
        <BarButton label={t('tools')} icon={SlidersHorizontal} onClick={onOpenTools} />
        <BarButton label={t('properties')} icon={Box} onClick={onOpenInspector} />
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
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[9px] transition ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-40`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
