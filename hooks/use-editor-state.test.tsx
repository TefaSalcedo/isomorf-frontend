import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import type { Project, ProjectElement } from '@/types/project';
import { useEditorState } from './use-editor-state';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LocaleProvider>{children}</LocaleProvider>
);

function project(elements: ProjectElement[] = []): Project {
  return { id: 'p1', public_id: 'pub-1', name: 'P', description: '', design_settings: {}, created_at: '', updated_at: '', elements, current_revision: 1, head_revision: 1 };
}

function drawWall(result: { current: ReturnType<typeof useEditorState> }) {
  act(() => {
    result.current.actions.setTool('wall');
    result.current.actions.beginDraft({ x: 0, y: 0 });
    result.current.actions.updateDraft({ x: 400, y: 0 });
    result.current.actions.commitDraft();
  });
}

describe('useEditorState', () => {
  it('loads project elements and default layers', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    expect(result.current.state.layers).toHaveLength(3);
    expect(result.current.state.elements).toHaveLength(0);
    expect(result.current.state.dirty).toBe(false);
  });

  it('creates a wall through the draft flow and marks the project dirty', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    drawWall(result);
    const { state } = result.current;
    expect(state.elements).toHaveLength(1);
    expect(state.elements[0].element_type).toBe('wall');
    expect(state.selectedIds).toEqual([state.elements[0].id]);
    expect(state.dirty).toBe(true);
    expect(state.tool).toBe('select');
  });

  it('seeds revision pointers from the loaded project', () => {
    const { result } = renderHook(() => useEditorState({ ...project(), current_revision: 3, head_revision: 5 }), { wrapper });
    expect(result.current.state.revision).toBe(3);
    expect(result.current.state.headRevision).toBe(5);
  });

  it('applyDocument replaces elements, updates revisions and clears dirty', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    drawWall(result);
    expect(result.current.state.dirty).toBe(true);
    const wall = result.current.state.elements[0];
    act(() => result.current.actions.applyDocument([], {}, 2, 4));
    expect(result.current.state.elements).toHaveLength(0);
    expect(result.current.state.revision).toBe(2);
    expect(result.current.state.headRevision).toBe(4);
    expect(result.current.state.dirty).toBe(false);
    act(() => result.current.actions.applyDocument([wall], {}, 3, 4));
    expect(result.current.state.elements).toHaveLength(1);
  });

  it('deletes the current selection', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    drawWall(result);
    act(() => result.current.actions.deleteSelection());
    expect(result.current.state.elements).toHaveLength(0);
  });

  it('clamps zoom between 0.2 and 5', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => result.current.actions.setZoom(100));
    expect(result.current.state.viewport.zoom).toBe(5);
    act(() => result.current.actions.setZoom(0.01));
    expect(result.current.state.viewport.zoom).toBe(0.2);
  });

  it('keeps at least one layer when removing layers', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      for (const layer of result.current.state.layers) result.current.actions.removeLayer(layer.id);
    });
    expect(result.current.state.layers).toHaveLength(1);
  });

  it('ignores element updates on locked layers', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    drawWall(result);
    const wall = result.current.state.elements[0];
    const layerId = (wall.properties as { layer_id?: string }).layer_id!;
    act(() => result.current.actions.updateLayer(layerId, { locked: true }));
    act(() => result.current.actions.updateElement(wall.id, { y1: 500 }));
    expect(result.current.state.elements[0].y1).toBe(wall.y1);
  });

  it('draws a slab through the rect draft flow and normalizes inverted corners', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('slab');
      result.current.actions.beginDraft({ x: 300, y: 200 });
      result.current.actions.updateDraft({ x: 0, y: 0 });
      result.current.actions.commitDraft();
    });
    const slab = result.current.state.elements[0];
    expect(slab.element_type).toBe('slab');
    expect(slab.x1).toBe(0);
    expect(slab.y1).toBe(0);
    expect(slab.x2).toBe(300);
    expect(slab.y2).toBe(200);
    expect(slab.rotation).toBe(0);
  });

  it('places a pile with a single click through the point flow', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('pile');
      result.current.actions.beginDraft({ x: 120, y: 90 });
      result.current.actions.commitDraft();
    });
    const pile = result.current.state.elements[0];
    expect(pile.element_type).toBe('pile');
    expect(pile.x1).toBe(120);
    expect(pile.y1).toBe(90);
  });

  it('rejects rect drafts smaller than the minimum footprint', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('slab');
      result.current.actions.beginDraft({ x: 0, y: 0 });
      result.current.actions.updateDraft({ x: 2, y: 2 });
      result.current.actions.commitDraft();
    });
    expect(result.current.state.elements).toHaveLength(0);
  });

  it('updateMany applies shared changes to every listed element', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    drawWall(result);
    act(() => {
      result.current.actions.setTool('beam');
      result.current.actions.beginDraft({ x: 0, y: 500 });
      result.current.actions.updateDraft({ x: 400, y: 500 });
      result.current.actions.commitDraft();
    });
    const ids = result.current.state.elements.map((el) => el.id);
    act(() => result.current.actions.updateMany(ids, { material_id: 'mat-1', section_id: 'sec-1' }));
    for (const el of result.current.state.elements) {
      expect(el.material_id).toBe('mat-1');
      expect(el.section_id).toBe('sec-1');
    }
  });

  it('updateMany skips geometry edits on point elements and respects locked layers', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('pile');
      result.current.actions.beginDraft({ x: 50, y: 50 });
      result.current.actions.commitDraft();
    });
    drawWall(result);
    const pile = result.current.state.elements.find((el) => el.element_type === 'pile')!;
    const wall = result.current.state.elements.find((el) => el.element_type === 'wall')!;
    act(() => result.current.actions.updateMany([pile.id, wall.id], { x1: 999 }));
    const after = result.current.state.elements;
    expect(after.find((el) => el.id === pile.id)?.x1).toBe(50);
    expect(after.find((el) => el.id === wall.id)?.x1).toBe(999);
  });

  it('updateElement applies rotation to a line element by recomputing the end', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('beam');
      result.current.actions.beginDraft({ x: 0, y: 0 });
      result.current.actions.updateDraft({ x: 400, y: 0 });
      result.current.actions.commitDraft();
    });
    const beam = result.current.state.elements[0];
    act(() => result.current.actions.updateElement(beam.id, { rotation: Math.PI / 2 }));
    const rotated = result.current.state.elements[0];
    expect(rotated.x2).toBeCloseTo(0);
    expect(rotated.y2).toBeCloseTo(400);
    expect(rotated.length).toBeCloseTo(400);
  });

  it('updateElement resizes a rect element through metric width/depth properties', () => {
    const { result } = renderHook(() => useEditorState(project()), { wrapper });
    act(() => {
      result.current.actions.setTool('slab');
      result.current.actions.beginDraft({ x: 0, y: 0 });
      result.current.actions.updateDraft({ x: 200, y: 200 });
      result.current.actions.commitDraft();
    });
    const slab = result.current.state.elements[0];
    act(() => result.current.actions.updateElement(slab.id, { properties: { width: 5, depth: 4 } }));
    const resized = result.current.state.elements[0];
    expect(resized.x2 - resized.x1).toBe(500);
    expect(resized.y2 - resized.y1).toBe(400);
  });
});
