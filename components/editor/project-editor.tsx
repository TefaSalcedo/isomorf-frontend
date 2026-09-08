'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type Konva from 'konva';
import { useEditorState } from '@/hooks/use-editor-state';
import { CanvasStage } from '@/components/editor/canvas-stage';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { PropertiesPanel } from '@/components/editor/properties-panel';
import { SelectionSummary } from '@/components/editor/selection-summary';
import { ProjectSettingsPanel } from '@/components/editor/project-settings-panel';
import { api } from '@/lib/api-client';
import type { Project, ProjectElement } from '@/types/project';
import type { ElementPayload } from '@/lib/api-client';
import { defaultDesignSettings } from '@/lib/editor/elements';

const Model3DPreview = dynamic(
  () => import('@/components/editor/model-3d-preview').then((mod) => mod.Model3DPreview),
  { ssr: false },
);

export function ProjectEditor({ initialProject }: { initialProject: Project }) {
  const { state, actions, selectedElements, summary } = useEditorState(initialProject);
  const [saving, setSaving] = useState(false);
  const [designSettings, setDesignSettings] = useState<Project['design_settings']>(
    initialProject.design_settings ?? defaultDesignSettings(),
  );
  const [view3D, setView3D] = useState(false);
  const original = useRef(new Map((initialProject.elements ?? []).map((element) => [element.id, element])));
  const stageRef = useRef<Konva.Stage | null>(null);

  async function save() {
    setSaving(true);
    actions.clearError();
    try {
      const currentIds = new Set(state.elements.map((el) => el.id));
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
      actions.loadProject({ ...initialProject, elements: persisted, design_settings: designSettings });
    } catch (saveError) {
      actions.setError(saveError instanceof Error ? saveError.message : 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function saveDesignSettings() {
    actions.clearError();
    try {
      await api.updateProject(initialProject.id, { design_settings: designSettings });
    } catch (error) {
      actions.setError(error instanceof Error ? error.message : 'Unable to save settings');
    }
  }

  function handleExport() {
    const dataURL = stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
    if (!dataURL) return;
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${initialProject.name || 'plan'}.png`;
    a.click();
  }

  function handleToggle3D() {
    setView3D((v) => !v);
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
        onSave={saveDesignSettings}
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
        projectName={initialProject.name}
        state={state}
        actions={actions}
        view3D={view3D}
        onToggle3D={handleToggle3D}
        onSave={save}
        onExport={handleExport}
        onPrint={handlePrint}
        saving={saving}
      />
      <div className="flex min-h-0 flex-1">
        {!state.cleanMode && <EditorSidebar state={state} actions={actions} />}
        <div className="relative min-h-0 flex-1">
          {view3D ? (
            <Model3DPreview elements={state.elements} />
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
