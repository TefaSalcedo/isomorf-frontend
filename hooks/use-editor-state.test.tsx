import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Project, ProjectElement } from '@/types/project';
import { useEditorState } from './use-editor-state';

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
    const { result } = renderHook(() => useEditorState(project()));
    expect(result.current.state.layers).toHaveLength(3);
    expect(result.current.state.elements).toHaveLength(0);
    expect(result.current.state.dirty).toBe(false);
  });

  it('creates a wall through the draft flow and marks the project dirty', () => {
    const { result } = renderHook(() => useEditorState(project()));
    drawWall(result);
    const { state } = result.current;
    expect(state.elements).toHaveLength(1);
    expect(state.elements[0].element_type).toBe('wall');
    expect(state.selectedIds).toEqual([state.elements[0].id]);
    expect(state.dirty).toBe(true);
    expect(state.tool).toBe('select');
  });

  it('seeds revision pointers from the loaded project', () => {
    const { result } = renderHook(() => useEditorState({ ...project(), current_revision: 3, head_revision: 5 }));
    expect(result.current.state.revision).toBe(3);
    expect(result.current.state.headRevision).toBe(5);
  });

  it('applyDocument replaces elements, updates revisions and clears dirty', () => {
    const { result } = renderHook(() => useEditorState(project()));
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
    const { result } = renderHook(() => useEditorState(project()));
    drawWall(result);
    act(() => result.current.actions.deleteSelection());
    expect(result.current.state.elements).toHaveLength(0);
  });

  it('clamps zoom between 0.2 and 5', () => {
    const { result } = renderHook(() => useEditorState(project()));
    act(() => result.current.actions.setZoom(100));
    expect(result.current.state.viewport.zoom).toBe(5);
    act(() => result.current.actions.setZoom(0.01));
    expect(result.current.state.viewport.zoom).toBe(0.2);
  });

  it('keeps at least one layer when removing layers', () => {
    const { result } = renderHook(() => useEditorState(project()));
    act(() => {
      for (const layer of result.current.state.layers) result.current.actions.removeLayer(layer.id);
    });
    expect(result.current.state.layers).toHaveLength(1);
  });

  it('ignores element updates on locked layers', () => {
    const { result } = renderHook(() => useEditorState(project()));
    drawWall(result);
    const wall = result.current.state.elements[0];
    const layerId = (wall.properties as { layer_id?: string }).layer_id!;
    act(() => result.current.actions.updateLayer(layerId, { locked: true }));
    act(() => result.current.actions.updateElement(wall.id, { y1: 500 }));
    expect(result.current.state.elements[0].y1).toBe(wall.y1);
  });
});
