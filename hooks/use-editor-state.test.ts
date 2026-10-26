import { describe, expect, it } from 'vitest';
import { createColumn } from '@/lib/editor/elements';
import type { ProjectElement } from '@/types/project';
import { applyElementChanges } from './use-editor-state';

describe('applyElementChanges', () => {
  it('preserves text rotation when its position changes and retains column behavior', () => {
    const text = {
      id: 'text-1',
      project_id: 'project-1',
      element_type: 'text',
      x1: 300,
      y1: 0,
      x2: 301,
      y2: 0,
      length: 1,
      rotation: Math.PI / 6,
      material_id: null,
      section_id: null,
      created_at: '',
      updated_at: '',
      properties: { text: 'Label', height: 2.5 },
    } as unknown as ProjectElement;

    const movedX = applyElementChanges(text, { x1: 400, x2: 401 }, [text]);
    const movedY = applyElementChanges(text, { y1: 100 }, [text]);
    expect(movedX.rotation).toBeCloseTo(Math.PI / 6);
    expect(movedY.rotation).toBeCloseTo(Math.PI / 6);

    const column = createColumn('column-1', 'project-1', { x: 0, y: 0 });
    const rotatedColumn = applyElementChanges(
      column,
      { x1: 0, y1: 0, x2: 100, y2: 200 },
      [column],
    );
    expect(rotatedColumn.rotation).toBeCloseTo(Math.atan2(200, 100));
  });
});
