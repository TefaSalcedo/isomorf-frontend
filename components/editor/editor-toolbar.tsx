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
} from 'lucide-react';
import { SaveStatus } from '@/components/editor/save-status';
import { Tooltip } from '@/components/ui/tooltip';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
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
  onUndo,
  onRedo,
  onOpenHistory,
  onProjectNameCommit,
  onSave,
  onExport,
  onPrint,
  saving,
}: {
  projectName: string;
  state: EditorState;
  actions: {
    toggleGrid: () => void;
    toggleSnap: () => void;
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:gap-3 sm:px-4">
      <a href="/dashboard" className="hidden text-sm text-slate-500 hover:text-slate-900 sm:inline">{t('dashboard')}</a>
      <a href="/dashboard" className="text-slate-500 hover:text-slate-900 sm:hidden" aria-label={t('dashboard')}><ChevronLeft className="h-4 w-4" /></a>
      <span className="hidden text-slate-300 sm:inline">/</span>
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
            className="h-8 w-32 rounded-md sm:w-48 border border-violet-300 px-2 text-sm font-semibold outline-none ring-2 ring-violet-100"
            aria-label={t('projectName')}
          />
          <button type="button" onClick={commitName} title={t('saveProjectName')} aria-label={t('saveProjectName')} className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={cancelName} title={t('cancelProjectName')} aria-label={t('cancelProjectName')} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => { setDraftName(projectName); setEditingName(true); }} className="group flex min-w-0 max-w-[40vw] items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-900 sm:max-w-xs" title={t('editProjectName')}>
          <span className="truncate">{projectName || tc('untitled')}</span>
          <Pencil className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-violet-600" />
        </button>
      )}
      <span className="ml-1 hidden text-xs text-slate-400 lg:inline">{t('elementCount', { count: state.elements.length })}</span>
      <div className="ml-4 hidden items-center gap-1 rounded-xl bg-slate-100 p-1 lg:flex" role="group" aria-label={tv('2d') + ' / ' + tv('3d')}>
        {(['2d', '3d', 'loads', 'fem'] as const).map((mode) => (
          <button key={mode} onClick={() => onViewChange(mode)} aria-pressed={view === mode} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === mode ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            {tv(mode)}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <div className="hidden items-center gap-1.5 lg:flex">
          <ToolbarButton onClick={onUndo} disabled={state.revision <= 1 || state.historyBusy} icon={Undo} label={t('undo')} />
          <ToolbarButton onClick={onRedo} disabled={state.revision >= state.headRevision || state.historyBusy} icon={Redo} label={t('redo')} />
          <ToolbarButton onClick={onOpenHistory} icon={History} label={t('history')} active={state.activeSection === 'history'} />
          <Divider />
          <ToolbarButton onClick={actions.zoomOut} icon={ZoomOut} label={t('zoomOut')} />
          <span className="w-12 text-center text-xs text-slate-500">{zoomPct}%</span>
          <ToolbarButton onClick={actions.zoomIn} icon={ZoomIn} label={t('zoomIn')} />
        </div>
        <ToolbarButton onClick={actions.fit} icon={Maximize} label={t('fit')} />
        <ToolbarButton onClick={actions.toggleGrid} icon={Grid3x3} label={t('grid')} active={state.showGrid} />
        <ToolbarButton onClick={actions.toggleSnap} icon={Magnet} label={t('snap')} active={state.snapEnabled} />
        <div className="hidden items-center gap-1.5 lg:flex">
          <Divider />
          <ToolbarButton onClick={onExport} icon={Download} label={t('exportPng')} />
          <ToolbarButton onClick={onPrint} icon={Printer} label={t('print')} />
          <ToolbarButton onClick={onToggle3D} icon={Box} label={t('view3d')} active={view3D} />
        </div>
        <ToolbarButton onClick={actions.toggleCleanMode} icon={state.cleanMode ? Eye : EyeOff} label={t('cleanMode')} />
        <div className="hidden items-center gap-1.5 lg:flex">
          <Divider />
          <ToolbarButton onClick={actions.deleteSelection} icon={Trash2} label={t('delete')} disabled={!canDelete} danger />
        </div>
        <button onClick={onSave} disabled={saving} aria-label={t('save')} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:px-3">
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{saving ? t('saving') : t('save')}</span>
        </button>
        <div className="ml-2 hidden sm:block"><SaveStatus dirty={state.dirty} saving={saving} error={state.error} revision={state.revision} /></div>
      </div>
    </header>
  );
}

function ToolbarButton({ onClick, icon: Icon, label, disabled, active, danger }: { onClick: () => void; icon: typeof Undo; label: string; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <Tooltip label={label} position="bottom">
      <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active === undefined ? undefined : active} className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${active ? 'bg-slate-100 text-slate-900' : danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'} disabled:opacity-40`}>
        <Icon className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}
