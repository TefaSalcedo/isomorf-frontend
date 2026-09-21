'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type Konva from 'konva';
import { Layers3, PanelRightClose, SlidersHorizontal, X } from 'lucide-react';
import { useEditorState } from '@/hooks/use-editor-state';
import { useIsCompact } from '@/hooks/use-media-query';
import { CanvasStage } from '@/components/editor/canvas-stage';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { PropertiesPanel } from '@/components/editor/properties-panel';
import { SelectionSummary } from '@/components/editor/selection-summary';
import { ProjectSettingsPanel } from '@/components/editor/project-settings-panel';
import { LoadEditor } from '@/components/editor/load-editor';
import { LayersPanel } from '@/components/editor/layers-panel';
import { MobileToolbar } from '@/components/editor/mobile-toolbar';
import { FemComingSoon } from '@/components/editor/fem-coming-soon';
import { HistoryPanel } from '@/components/editor/history-panel';
import { MemberDesignPanel, isDesignable } from '@/components/editor/member-design-panel';
import type { DesignPatch } from '@/components/editor/member-design-panel';
import { api } from '@/lib/api-client';
import type { DocumentState, Project, ProjectElement } from '@/types/project';
import { defaultDesignSettings } from '@/lib/editor/elements';
import { ensureLayers } from '@/lib/editor/layers';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

const Model3DPreview = dynamic(
  () => import('@/components/editor/model-3d-preview').then((mod) => mod.Model3DPreview),
  { ssr: false },
);

export function ProjectEditor({ initialProject }: { initialProject: Project }) {
  const { state, actions, selectedElements, summary } = useEditorState(initialProject);
  const [projectName, setProjectName] = useState(initialProject.name || 'Sin nombre');
  const [saving, setSaving] = useState(false);
  const [designSettings, setDesignSettings] = useState<Project['design_settings']>(
    initialProject.design_settings ?? defaultDesignSettings(),
  );
  const [activeView, setActiveView] = useState<EditorView>('2d');
  const [mobilePanel, setMobilePanel] = useState<'none' | 'tools' | 'inspector'>('none');
  const compact = useIsCompact();
  const stageRef = useRef<Konva.Stage | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const undoRef = useRef<() => Promise<void>>(async () => undefined);
  const redoRef = useRef<() => Promise<void>>(async () => undefined);
  const stateRef = useRef(state);
  const projectNameRef = useRef(projectName);
  const designSettingsRef = useRef(designSettings);
  stateRef.current = state;
  projectNameRef.current = projectName;
  designSettingsRef.current = designSettings;
  const initialNameRef = useRef(initialProject.name || 'Sin nombre');
  const initialSettingsRef = useRef(
    JSON.stringify({
      ...(initialProject.design_settings ?? defaultDesignSettings()),
      layers: ensureLayers(initialProject.design_settings?.layers),
    }),
  );

  function hasUnsavedChanges(): boolean {
    const current = stateRef.current;
    return (
      current.dirty ||
      projectNameRef.current.trim() !== initialNameRef.current ||
      JSON.stringify({ ...designSettingsRef.current, layers: current.layers }) !== initialSettingsRef.current
    );
  }

  async function save(): Promise<void> {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return savePromiseRef.current ?? Promise.resolve();
    }
    savingRef.current = true;
    setSaving(true);
    actions.clearError();
    const elementsSnapshot = state.elements;
    const layersSnapshot = state.layers;
    const run = (async () => {
      try {
        const settingsToSave = { ...designSettingsRef.current, layers: layersSnapshot };
        const nameToSave = projectNameRef.current.trim() || 'Sin nombre';
        const doc = await api.saveDocument(initialProject.id, {
          name: nameToSave,
          design_settings: settingsToSave,
          elements: elementsSnapshot.map((element) => ({
            id: element.id,
            element_type: element.element_type,
            x1: element.x1,
            y1: element.y1,
            x2: element.x2,
            y2: element.y2,
            length: element.length,
            rotation: element.rotation,
            properties: element.properties as Record<string, unknown>,
          })),
        });
        initialNameRef.current = nameToSave;
        initialSettingsRef.current = JSON.stringify(settingsToSave);
        const stillDirty = stateRef.current.elements !== elementsSnapshot || stateRef.current.layers !== layersSnapshot;
        actions.markSaved(doc.revision, doc.head_revision, stillDirty);
      } catch (saveError) {
        actions.setError(saveError instanceof Error ? saveError.message : 'Unable to save changes');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    })();
    savePromiseRef.current = run;
    await run;
    savePromiseRef.current = null;
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      await save();
    }
  }

  async function flushPendingSave(): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (savePromiseRef.current) {
        await savePromiseRef.current;
        continue;
      }
      if (!hasUnsavedChanges()) return true;
      await save();
    }
    return !hasUnsavedChanges();
  }

  function applyDocumentState(doc: DocumentState) {
    setDesignSettings(doc.design_settings);
    initialSettingsRef.current = JSON.stringify({
      ...doc.design_settings,
      layers: ensureLayers(doc.design_settings?.layers),
    });
    actions.applyDocument(doc.elements, doc.design_settings, doc.revision, doc.head_revision);
  }

  async function runHistoryAction(action: () => Promise<DocumentState>) {
    if (stateRef.current.historyBusy) return;
    const flushed = await flushPendingSave();
    if (!flushed) {
      actions.setError('Unable to save pending changes before changing revision');
      return;
    }
    actions.setHistoryBusy(true);
    try {
      applyDocumentState(await action());
    } catch (historyError) {
      actions.setError(historyError instanceof Error ? historyError.message : 'Unable to change revision');
    } finally {
      actions.setHistoryBusy(false);
    }
  }

  async function handleUndo() {
    if (stateRef.current.revision <= 1) return;
    await runHistoryAction(() => api.undoDocument(initialProject.id));
  }

  async function handleRedo() {
    if (stateRef.current.revision >= stateRef.current.headRevision) return;
    await runHistoryAction(() => api.redoDocument(initialProject.id));
  }

  async function handleRestore(revision: number) {
    if (revision === stateRef.current.revision) return;
    await runHistoryAction(() => api.restoreRevision(initialProject.id, revision));
  }

  useEffect(() => {
    saveRef.current = save;
    undoRef.current = handleUndo;
    redoRef.current = handleRedo;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        void undoRef.current();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        void redoRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const projectChanged =
      projectName.trim() !== initialNameRef.current ||
      JSON.stringify({ ...designSettings, layers: state.layers }) !== initialSettingsRef.current;
    if (!state.dirty && !projectChanged) return undefined;
    const timeout = window.setTimeout(() => void saveRef.current(), 700);
    return () => window.clearTimeout(timeout);
  }, [state.dirty, state.layers, projectName, designSettings, initialProject.name]);

  function commitProjectName(value: string) {
    setProjectName(value.trim() || 'Sin nombre');
  }

  function handleExport() {
    const dataURL = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataURL) return;
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${projectName || 'plan'}.png`;
    a.click();
  }

  function handleToggle3D() {
    setActiveView((view) => view === '3d' ? '2d' : '3d');
  }

  function handlePrint() {
    const dataURL = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataURL) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><body style="margin:0"><img src="${dataURL}" style="width:100%" onload="window.print()"></body></html>`);
    w.document.close();
  }

  const designTarget =
    activeView === '3d' && selectedElements.length === 1 && isDesignable(selectedElements[0])
      ? selectedElements[0]
      : null;

  let rightPanel: React.ReactNode = null;
  if (designTarget) {
    rightPanel = (
      <MemberDesignPanel
        element={designTarget}
        projectName={projectName}
        onUpdate={(id, properties: DesignPatch) =>
          actions.updateElement(id, { properties } as Partial<ProjectElement>)
        }
      />
    );
  } else if (state.activeSection === 'layers') {
    rightPanel = (
      <LayersPanel
        layers={state.layers}
        activeLayerId={state.activeLayerId}
        elements={state.elements}
        selectionCount={state.selectedIds.length}
        actions={actions}
      />
    );
  } else if (state.activeSection === 'history') {
    rightPanel = (
      <HistoryPanel
        projectId={initialProject.id}
        revision={state.revision}
        headRevision={state.headRevision}
        busy={state.historyBusy}
        onRestore={(revision) => void handleRestore(revision)}
      />
    );
  } else if (state.activeSection === 'settings') {
    rightPanel = (
      <ProjectSettingsPanel
        settings={designSettings}
        onChange={setDesignSettings}
        onSave={() => void saveRef.current()}
      />
    );
  } else if (state.activeSection === 'calculations' || selectedElements.length > 1) {
    rightPanel = <SelectionSummary summary={summary} />;
  } else {
    rightPanel = <PropertiesPanel elements={selectedElements} onUpdate={actions.updateElement} />;
  }

  const canvas = activeView === '3d' ? (
    <Model3DPreview
      elements={state.elements}
      selectedIds={state.selectedIds}
      onSelectElement={(id) => {
        actions.select(id, false);
        if (compact) setMobilePanel('inspector');
      }}
    />
  ) : activeView === 'loads' ? (
    <LoadEditor projectId={initialProject.id} state={state} />
  ) : activeView === 'fem' ? (
    <FemComingSoon />
  ) : (
    <CanvasStage state={state} actions={actions} stageRef={stageRef} displayUnit={designSettings.unit ?? 'm'} />
  );

  const sidebar = (
    <EditorSidebar
      state={state}
      actions={actions}
      view={activeView}
      onOpenLoads={() => { setActiveView('loads'); setMobilePanel('none'); }}
      compact={compact}
      onClose={() => setMobilePanel('none')}
    />
  );

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <EditorToolbar
        projectName={projectName}
        state={state}
        actions={actions}
        onUndo={() => void handleUndo()}
        onRedo={() => void handleRedo()}
        onOpenHistory={() => actions.setSection('history')}
        view={activeView}
        onViewChange={setActiveView}
        view3D={activeView === '3d'}
        onToggle3D={handleToggle3D}
        onProjectNameCommit={commitProjectName}
        onSave={() => void saveRef.current()}
        onExport={handleExport}
        onPrint={handlePrint}
        saving={saving}
      />
      <div className="flex min-h-0 flex-1">
        {!state.cleanMode && !compact && sidebar}
        <div className="relative min-h-0 flex-1">{canvas}</div>
        {!state.cleanMode && !compact && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
            {rightPanel}
          </aside>
        )}
      </div>

      {compact && !state.cleanMode && (
        <MobileToolbar
          state={state}
          actions={{ ...actions, undo: () => void handleUndo(), redo: () => void handleRedo() }}
          view={activeView}
          onViewChange={setActiveView}
          onOpenTools={() => setMobilePanel('tools')}
          onOpenInspector={() => {
            if (state.activeSection === 'layers' || state.activeSection === 'history') actions.setSection('draw');
            setMobilePanel('inspector');
          }}
          onOpenLayers={() => { actions.setSection('layers'); setMobilePanel('inspector'); }}
          onOpenHistory={() => { actions.setSection('history'); setMobilePanel('inspector'); }}
        />
      )}

      {compact && mobilePanel !== 'none' && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-slate-950/30" role="dialog" aria-modal="true">
          <button type="button" aria-label="Cerrar panel" className="flex-1" onClick={() => setMobilePanel('none')} />
          <section className="max-h-[80dvh] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              {mobilePanel === 'tools' ? <SlidersHorizontal className="h-4 w-4 text-violet-600" /> : state.activeSection === 'layers' ? <Layers3 className="h-4 w-4 text-violet-600" /> : <PanelRightClose className="h-4 w-4 text-violet-600" />}
              <h2 className="text-sm font-bold">{mobilePanel === 'tools' ? 'Herramientas' : state.activeSection === 'layers' ? 'Capas' : 'Propiedades'}</h2>
              <button type="button" onClick={() => setMobilePanel('none')} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar panel">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[70dvh] overflow-y-auto">
              {mobilePanel === 'tools' ? sidebar : rightPanel}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
