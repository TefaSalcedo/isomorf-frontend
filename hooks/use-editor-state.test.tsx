import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import type { ArcElement, CircleElement, PolylineElement, Project } from '@/types/project';
import { useEditorState } from './use-editor-state';

const project: Project = {
  id: 'project-1',
  public_id: 'P-TEST',
  name: 'Test project',
  description: '',
  design_settings: {},
  created_at: '',
  updated_at: '',
  elements: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}

function renderEditor() {
  return renderHook(() => useEditorState(project), { wrapper });
}

describe('CAD draft flows', () => {
  it('builds a polyline from repeated clicks and finishes on commit', () => {
    const { result } = renderEditor();
    act(() => result.current.actions.setTool('polyline'));
    act(() => result.current.actions.beginDraft({ x: 0, y: 0 }));
    act(() => result.current.actions.updateDraft({ x: 600, y: 0 }));
    act(() => result.current.actions.extendDraft());
    act(() => result.current.actions.updateDraft({ x: 600, y: 400 }));
    act(() => result.current.actions.extendDraft());
    act(() => result.current.actions.updateDraft({ x: 0, y: 400 }));
    act(() => result.current.actions.commitDraft());

    const el = result.current.state.elements[0] as PolylineElement;
    expect(el.element_type).toBe('polyline');
    expect(el.properties.points).toHaveLength(3);
    expect(el.properties.points[2]).toEqual({ x: 600, y: 400 });
    expect(result.current.state.tool).toBe('select');
  });

  it('closes a polyline when commitDraft(true) is used', () => {
    const { result } = renderEditor();
    act(() => result.current.actions.setTool('polyline'));
    act(() => result.current.actions.beginDraft({ x: 0, y: 0 }));
    act(() => result.current.actions.updateDraft({ x: 600, y: 0 }));
    act(() => result.current.actions.extendDraft());
    act(() => result.current.actions.updateDraft({ x: 0, y: 400 }));
    act(() => result.current.actions.commitDraft(true));

    const el = result.current.state.elements[0] as PolylineElement;
    expect(el.properties.closed).toBe(true);
    // Closing repeats the first vertex at the tail.
    expect(el.properties.points[el.properties.points.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it('builds a three-point arc through begin → extend → commit', () => {
    const { result } = renderEditor();
    act(() => result.current.actions.setTool('arc'));
    act(() => result.current.actions.beginDraft({ x: 100, y: 0 }));
    act(() => result.current.actions.updateDraft({ x: 70.71, y: 70.71 }));
    act(() => result.current.actions.extendDraft());
    act(() => result.current.actions.updateDraft({ x: 0, y: 100 }));
    act(() => result.current.actions.commitDraft());

    const el = result.current.state.elements[0] as ArcElement;
    expect(el.element_type).toBe('arc');
    expect(el.properties.cx).toBeCloseTo(0, 0);
    expect(el.properties.cy).toBeCloseTo(0, 0);
    expect(el.properties.radius).toBeCloseTo(100, 0);
  });

  it('creates a circle from center + radius drag', () => {
    const { result } = renderEditor();
    act(() => result.current.actions.setTool('circle'));
    act(() => result.current.actions.beginDraft({ x: 300, y: 300 }));
    act(() => result.current.actions.updateDraft({ x: 450, y: 300 }));
    act(() => result.current.actions.commitDraft());

    const el = result.current.state.elements[0] as CircleElement;
    expect(el.element_type).toBe('circle');
    expect(el.properties.radius).toBeCloseTo(150);
    expect(el.x1).toBe(300);
    expect(el.x2).toBeCloseTo(450);
  });

  it('exact updates bypass snapping for typed coordinates', () => {
    const { result } = renderEditor();
    // Seed a wall whose endpoint would normally capture a nearby cursor.
    act(() => result.current.actions.setTool('line'));
    act(() => result.current.actions.beginDraft({ x: 0, y: 0 }));
    act(() => result.current.actions.updateDraft({ x: 400, y: 0 }, true));
    act(() => result.current.actions.commitDraft());

    act(() => result.current.actions.setTool('line'));
    act(() => result.current.actions.beginDraft({ x: 0, y: 500 }));
    // A raw cursor at (397, 2) snaps to the wall end (400, 0) — explicit
    // anchors outrank the closer "nearest" edge projection…
    act(() => result.current.actions.updateDraft({ x: 397, y: 2 }));
    expect(result.current.state.draft?.end).toEqual({ x: 400, y: 0 });
    expect(result.current.state.draft?.snap?.target.type).toBe('end');
    // …but the same point typed as coordinates stays exact.
    act(() => result.current.actions.updateDraft({ x: 397, y: 2 }, true));
    expect(result.current.state.draft?.end).toEqual({ x: 397, y: 2 });
    expect(result.current.state.draft?.snap).toBeNull();
  });
});
