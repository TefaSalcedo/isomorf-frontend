'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Undo,
  Redo,
  History,
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
  ChevronLeft,
  LockKeyhole,
  Compass,
} from 'lucide-react';
import { SaveStatus } from '@/components/editor/save-status';
import { Tooltip } from '@/components/ui/tooltip';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import type { EditorState, Tool } from '@/hooks/use-editor-state';
import type { EditorView } from '@/lib/editor/commands';

export function EditorToolbar({
  projectName,
  state,
  actions,
  view,
  onViewChange,
  view3D,
  onToggle3D,
  onUndo,
  onRedo,
  onOpenHistory,
  onProjectNameCommit,
  onSave,
  onExport,
  onPrint,
  saving,
  readOnly,
}: {
  projectName: string;
  state: EditorState;
  actions: {
    toggleGrid: () => void;
    toggleSnap: () => void;
    togglePolar: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
    toggleCleanMode: () => void;
    deleteSelection: () => void;
    setTool: (tool: Tool) => void;
  };
  onUndo: () => void;
  onRedo: () => void;
  onOpenHistory: () => void;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  view3D: boolean;
  onToggle3D: () => void;
  onProjectNameCommit: (name: string) => void;
  onSave: () => void;
  onExport: () => void;
  onPrint: () => void;
  saving: boolean;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.toolbar');
  const tv = useTranslations('editor.views');
  const tc = useTranslations('common');
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950 px-2 sm:gap-3 sm:px-4">
      <a href="/dashboard" className="hidden text-sm text-slate-400 hover:text-slate-100 sm:inline">{t('dashboard')}</a>
      <a href="/dashboard" className="text-slate-400 hover:text-slate-100 sm:hidden" aria-label={t('dashboard')}><ChevronLeft className="h-4 w-4" /></a>
      <span className="hidden text-slate-700 sm:inline">/</span>
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
            className="h-8 w-32 rounded-md sm:w-48 border border-cyan-700 bg-slate-900 px-2 text-sm font-semibold text-slate-100 outline-none ring-2 ring-cyan-950"
            aria-label={t('projectName')}
          />
          <button type="button" onClick={commitName} title={t('saveProjectName')} aria-label={t('saveProjectName')} className="rounded p-1 text-emerald-400 hover:bg-slate-800"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={cancelName} title={t('cancelProjectName')} aria-label={t('cancelProjectName')} className="rounded p-1 text-slate-500 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
      ) : readOnly ? (
        <span className="flex min-w-0 max-w-[40vw] items-center gap-1.5 truncate text-sm font-semibold text-slate-100 sm:max-w-xs">
          <span className="truncate">{projectName || tc('untitled')}</span>
        </span>
      ) : (
        <button type="button" onClick={() => { setDraftName(projectName); setEditingName(true); }} className="group flex min-w-0 max-w-[40vw] items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-100 sm:max-w-xs" title={t('editProjectName')}>
          <span className="truncate">{projectName || tc('untitled')}</span>
          <Pencil className="h-3 w-3 shrink-0 text-slate-500 transition group-hover:text-cyan-400" />
        </button>
      )}
      {readOnly && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-amber-800" title={t('readOnlyHint')}>
          <LockKeyhole className="h-3 w-3" />{t('readOnlyBadge')}
        </span>
      )}
      <span className="ml-1 hidden text-xs text-slate-500 lg:inline">{t('elementCount', { count: state.elements.length })}</span>
      <div className="ml-4 hidden items-center gap-1 rounded-xl bg-slate-900 p-1 lg:flex" role="group" aria-label={tv('2d') + ' / ' + tv('3d')}>
        {(['2d', '3d', 'table', 'loads', 'fem'] as const).map((mode) => (
          <button key={mode} onClick={() => onViewChange(mode)} aria-pressed={view === mode} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === mode ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}>
            {tv(mode)}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <LanguageSwitcher className="hidden sm:inline-flex" variant="dark" />
        <div className="hidden items-center gap-1.5 lg:flex">
          <ToolbarButton onClick={onUndo} disabled={readOnly || state.revision <= 1 || state.historyBusy} icon={Undo} label={t('undo')} />
          <ToolbarButton onClick={onRedo} disabled={readOnly || state.revision >= state.headRevision || state.historyBusy} icon={Redo} label={t('redo')} />
          <ToolbarButton onClick={onOpenHistory} icon={History} label={t('history')} active={state.activeSection === 'history'} />
          <Divider />
          <ToolbarButton onClick={actions.zoomOut} icon={ZoomOut} label={t('zoomOut')} />
          <span className="w-12 text-center text-xs text-slate-400">{zoomPct}%</span>
          <ToolbarButton onClick={actions.zoomIn} icon={ZoomIn} label={t('zoomIn')} />
        </div>
        <ToolbarButton onClick={actions.fit} icon={Maximize} label={t('fit')} />
        <ToolbarButton onClick={actions.toggleGrid} icon={Grid3x3} label={t('grid')} active={state.showGrid} />
        <ToolbarButton onClick={actions.toggleSnap} icon={Magnet} label={t('snap')} active={state.snapEnabled} />
        <ToolbarButton onClick={actions.togglePolar} icon={Compass} label={t('polar')} active={state.polarEnabled} />
        <div className="hidden items-center gap-1.5 lg:flex">
          <Divider />
          <ToolbarButton onClick={onExport} icon={Download} label={t('exportPng')} />
          <ToolbarButton onClick={onPrint} icon={Printer} label={t('print')} />
          <ToolbarButton onClick={onToggle3D} icon={Box} label={t('view3d')} active={view3D} />
        </div>
        <ToolbarButton onClick={actions.toggleCleanMode} icon={state.cleanMode ? Eye : EyeOff} label={t('cleanMode')} />
        <div className="hidden items-center gap-1.5 lg:flex">
          <Divider />
          <ToolbarButton onClick={actions.deleteSelection} icon={Trash2} label={t('delete')} disabled={!canDelete || readOnly} danger />
        </div>
        {!readOnly && (
          <button onClick={onSave} disabled={saving} aria-label={t('save')} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cyan-600 px-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 sm:px-3">
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{saving ? t('saving') : t('save')}</span>
          </button>
        )}
        <div className="ml-2 hidden sm:block"><SaveStatus dirty={state.dirty} saving={saving} error={state.error} revision={state.revision} /></div>
      </div>
    </header>
  );
}

function ToolbarButton({ onClick, icon: Icon, label, disabled, active, danger }: { onClick: () => void; icon: typeof Undo; label: string; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <Tooltip label={label} position="bottom">
      <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active === undefined ? undefined : active} className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${active ? 'bg-slate-800 text-cyan-300' : danger ? 'text-slate-500 hover:bg-red-950 hover:text-red-400' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'} disabled:opacity-40`}>
        <Icon className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-800" />;
}
