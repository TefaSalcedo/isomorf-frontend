'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type Konva from 'konva';
import { useEditorState } from '@/hooks/use-editor-state';
import { CanvasStage } from '@/components/editor/canvas-stage';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { PropertiesPanel } from '@/components/editor/properties-panel';
import { SelectionSummary } from '@/components/editor/selection-summary';
import { ProjectSettingsPanel } from '@/components/editor/project-settings-panel';
import { LoadEditor } from '@/components/editor/load-editor';
import { FemComingSoon } from '@/components/editor/fem-coming-soon';
import { api } from '@/lib/api-client';
import type { Project, ProjectElement } from '@/types/project';
import type { ElementPayload } from '@/lib/api-client';
import { defaultDesignSettings } from '@/lib/editor/elements';

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
  const original = useRef(new Map((initialProject.elements ?? []).map((element) => [element.id, element])));
  const stageRef = useRef<Konva.Stage | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const initialNameRef = useRef(initialProject.name || 'Sin nombre');
  const initialSettingsRef = useRef(JSON.stringify(initialProject.design_settings ?? defaultDesignSettings()));

  async function save() {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaving(true);
    actions.clearError();
    try {
      const currentIds = new Set(state.elements.map((el) => el.id));
      const updatedProject = await api.updateProject(initialProject.id, {
        name: projectName.trim() || 'Sin nombre',
        design_settings: designSettings,
      });
      for (const element of original.current.values()) {
        if (!currentIds.has(element.id)) {
          await api.deleteElement(initialProject.id, element.id);
        }
      }
      const persisted: ProjectElement[] = [];
      for (const element of state.elements) {
        const base: Omit<ElementPayload, 'id'> = {
          element_type: element.element_type,
          x1: element.x1,
          y1: element.y1,
          x2: element.x2,
          y2: element.y2,
          length: element.length,
          rotation: element.rotation,
          properties: element.properties as Record<string, unknown>,
        };
        const savedElement = original.current.has(element.id)
          ? await api.updateElement(initialProject.id, element.id, base)
          : await api.createElement(initialProject.id, { id: element.id, ...base });
        persisted.push(savedElement);
      }
      original.current = new Map(persisted.map((element) => [element.id, element]));
      setProjectName(updatedProject.name || 'Sin nombre');
      initialNameRef.current = updatedProject.name || 'Sin nombre';
      initialSettingsRef.current = JSON.stringify(designSettings);
      actions.markClean();
    } catch (saveError) {
      actions.setError(saveError instanceof Error ? saveError.message : 'Unable to save changes');
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => void saveRef.current(), 0);
      }
    }
  }

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const projectChanged =
      projectName.trim() !== initialNameRef.current ||
      JSON.stringify(designSettings) !== initialSettingsRef.current;
    if (!state.dirty && !projectChanged) return undefined;
    const timeout = window.setTimeout(() => void saveRef.current(), 700);
    return () => window.clearTimeout(timeout);
  }, [state.dirty, projectName, designSettings, initialProject.name]);

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

  let rightPanel: React.ReactNode = null;
  if (state.activeSection === 'settings') {
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

  return (
    <main className="flex h-screen w-full flex-col bg-slate-50 text-slate-900">
      <EditorToolbar
        projectName={projectName}
        state={state}
        actions={actions}
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
        {!state.cleanMode && <EditorSidebar state={state} actions={actions} view={activeView} onOpenLoads={() => setActiveView('loads')} />}
        <div className="relative min-h-0 flex-1">
          {activeView === '3d' ? (
            <Model3DPreview elements={state.elements} />
          ) : activeView === 'loads' ? (
            <LoadEditor projectId={initialProject.id} state={state} />
          ) : activeView === 'fem' ? (
            <FemComingSoon />
          ) : (
            <CanvasStage state={state} actions={actions} stageRef={stageRef} displayUnit={designSettings.unit ?? 'm'} />
          )}
        </div>
        {!state.cleanMode && (
          <aside className="w-72 shrink-0 border-l border-slate-200 bg-white">
            {rightPanel}
          </aside>
        )}
      </div>
    </main>
  );
}
