'use client';

import {
  Undo,
  Redo,
  Grid3x3,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Printer,
  Trash2,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SaveStatus } from '@/components/editor/save-status';
import type { EditorState, Tool } from '@/hooks/use-editor-state';

export function EditorToolbar({
  projectName,
  state,
  actions,
  onSave,
  onExport,
  onPrint,
  saving,
}: {
  projectName: string;
  state: EditorState;
  actions: {
    undo: () => void;
    redo: () => void;
    toggleGrid: () => void;
    toggleSnap: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
    toggleCleanMode: () => void;
    deleteSelection: () => void;
    setTool: (tool: Tool) => void;
  };
  onSave: () => void;
  onExport: () => void;
  onPrint: () => void;
  saving: boolean;
}) {
  const canDelete = state.selectedIds.length > 0;
  const zoomPct = Math.round(state.viewport.zoom * 100);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        Dashboard
      </a>
      <span className="text-slate-300">/</span>
      <h1 className="max-w-xs truncate text-sm font-semibold text-slate-900">{projectName}</h1>
      <span className="ml-2 text-xs text-slate-400">{state.elements.length} elements</span>
      <div className="ml-auto flex items-center gap-1.5">
        <ToolbarButton onClick={actions.undo} disabled={state.past.length === 0} icon={Undo} label="Undo" />
        <ToolbarButton onClick={actions.redo} disabled={state.future.length === 0} icon={Redo} label="Redo" />
        <Divider />
        <ToolbarButton onClick={actions.zoomOut} icon={ZoomOut} label="Zoom out" />
        <span className="w-12 text-center text-xs text-slate-500">{zoomPct}%</span>
        <ToolbarButton onClick={actions.zoomIn} icon={ZoomIn} label="Zoom in" />
        <ToolbarButton onClick={actions.fit} icon={Maximize} label="Fit" />
        <ToolbarButton
          onClick={actions.toggleGrid}
          icon={Grid3x3}
          label="Grid"
          active={state.showGrid}
        />
        <ToolbarButton
          onClick={actions.toggleSnap}
          icon={Magnet}
          label="Snap"
          active={state.snapEnabled}
        />
        <Divider />
        <ToolbarButton onClick={onExport} icon={Download} label="Export PNG" />
        <ToolbarButton onClick={onPrint} icon={Printer} label="Print" />
        <ToolbarButton onClick={actions.toggleCleanMode} icon={state.cleanMode ? Eye : EyeOff} label="Clean mode" />
        <Divider />
        <ToolbarButton
          onClick={actions.deleteSelection}
          icon={Trash2}
          label="Delete"
          disabled={!canDelete}
          danger
        />
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <div className="ml-2">
          <SaveStatus dirty={state.dirty} saving={saving} error={state.error} />
        </div>
      </div>
    </header>
  );
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  disabled,
  active,
  danger,
}: {
  onClick: () => void;
  icon: typeof Undo;
  label: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-slate-100 text-slate-900'
          : danger
            ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      } disabled:opacity-40`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}
