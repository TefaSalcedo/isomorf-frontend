'use client';

import { useState } from 'react';
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
  Box,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { SaveStatus } from '@/components/editor/save-status';
import type { EditorState, Tool } from '@/hooks/use-editor-state';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

export function EditorToolbar({
  projectName,
  state,
  actions,
  view,
  onViewChange,
  view3D,
  onToggle3D,
  onProjectNameCommit,
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
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  view3D: boolean;
  onToggle3D: () => void;
  onProjectNameCommit: (name: string) => void;
  onSave: () => void;
  onExport: () => void;
  onPrint: () => void;
  saving: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const canDelete = state.selectedIds.length > 0;
  const zoomPct = Math.round(state.viewport.zoom * 100);

  function commitName() {
    onProjectNameCommit(draftName);
    setEditingName(false);
  }

  function cancelName() {
    setDraftName(projectName);
    setEditingName(false);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">Dashboard</a>
      <span className="text-slate-300">/</span>
      {editingName ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName();
              if (event.key === 'Escape') cancelName();
            }}
            className="h-8 w-48 rounded-md border border-violet-300 px-2 text-sm font-semibold outline-none ring-2 ring-violet-100"
            aria-label="Project name"
          />
          <button type="button" onClick={commitName} title="Save project name" className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={cancelName} title="Cancel project name" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => { setDraftName(projectName); setEditingName(true); }} className="group flex max-w-xs items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-900" title="Edit project name">
          <span className="truncate">{projectName || 'Sin nombre'}</span>
          <Pencil className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-violet-600" />
        </button>
      )}
      <span className="ml-1 text-xs text-slate-400">{state.elements.length} elements</span>
      <div className="ml-4 hidden items-center gap-1 rounded-xl bg-slate-100 p-1 lg:flex">
        {(['2d', '3d', 'loads', 'fem'] as const).map((mode) => (
          <button key={mode} onClick={() => onViewChange(mode)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === mode ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            {mode === 'fem' ? 'FEM' : mode}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <ToolbarButton onClick={actions.undo} disabled={state.past.length === 0} icon={Undo} label="Undo" />
        <ToolbarButton onClick={actions.redo} disabled={state.future.length === 0} icon={Redo} label="Redo" />
        <Divider />
        <ToolbarButton onClick={actions.zoomOut} icon={ZoomOut} label="Zoom out" />
        <span className="w-12 text-center text-xs text-slate-500">{zoomPct}%</span>
        <ToolbarButton onClick={actions.zoomIn} icon={ZoomIn} label="Zoom in" />
        <ToolbarButton onClick={actions.fit} icon={Maximize} label="Fit" />
        <ToolbarButton onClick={actions.toggleGrid} icon={Grid3x3} label="Grid" active={state.showGrid} />
        <ToolbarButton onClick={actions.toggleSnap} icon={Magnet} label="Snap" active={state.snapEnabled} />
        <Divider />
        <ToolbarButton onClick={onExport} icon={Download} label="Export PNG" />
        <ToolbarButton onClick={onPrint} icon={Printer} label="Print" />
        <ToolbarButton onClick={onToggle3D} icon={Box} label="3D view" active={view3D} />
        <ToolbarButton onClick={actions.toggleCleanMode} icon={state.cleanMode ? Eye : EyeOff} label="Clean mode" />
        <Divider />
        <ToolbarButton onClick={actions.deleteSelection} icon={Trash2} label="Delete" disabled={!canDelete} danger />
        <button onClick={onSave} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <div className="ml-2"><SaveStatus dirty={state.dirty} saving={saving} error={state.error} /></div>
      </div>
    </header>
  );
}

function ToolbarButton({ onClick, icon: Icon, label, disabled, active, danger }: { onClick: () => void; icon: typeof Undo; label: string; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${active ? 'bg-slate-100 text-slate-900' : danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'} disabled:opacity-40`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}
