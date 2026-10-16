import { describe, expect, it } from 'vitest';
import type { BlockDefinition, BlockRefElement } from '@/types/project';
import { createLine, createRectangle, createWall } from './elements';
import {
  blockBounds,
  blockById,
  createBlockFromSelection,
  createBlockRef,
  explodeBlockRef,
  instantiateBlock,
} from './blocks';

const PROJECT = 'p1';

function sampleBlock(): BlockDefinition {
  const payload = createBlockFromSelection('door-swing', [
    createLine('l1', PROJECT, { x: 100, y: 50 }, { x: 180, y: 50 }),
    createRectangle('r1', PROJECT, { x: 100, y: 50 }, { x: 120, y: 90 }),
  ])!;
  return { id: 'blk-1', project_id: PROJECT, created_at: '', updated_at: '', ...payload, description: payload.description ?? '' };
}

describe('createBlockFromSelection', () => {
  it('freezes elements as items with the bbox min corner as base point', () => {
    const payload = createBlockFromSelection('col-pair', [
      createLine('a', PROJECT, { x: 300, y: 100 }, { x: 400, y: 100 }),
      createWall('b', PROJECT, { x: 350, y: 200 }, { x: 350, y: 260 }),
    ]);
    expect(payload).not.toBeNull();
    expect(payload!.items).toHaveLength(2);
    expect(payload!.base_x).toBe(300);
    expect(payload!.base_y).toBe(100);
    // Item payloads strip project-owned identity fields.
    expect(payload!.items[0]).not.toHaveProperty('id');
    expect(payload!.items[0].element_type).toBe('line');
  });

  it('keeps material and section references on the items', () => {
    const wall = { ...createWall('w', PROJECT, { x: 0, y: 0 }, { x: 100, y: 0 }), material_id: 'mat-9', section_id: 'sec-3' };
    const payload = createBlockFromSelection('wall-block', [wall])!;
    expect(payload.items[0].material_id).toBe('mat-9');
    expect(payload.items[0].section_id).toBe('sec-3');
  });

  it('skips nested block references and returns null when nothing remains', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 0, y: 0 });
    expect(createBlockFromSelection('nested', [ref])).toBeNull();
  });
});

describe('blockBounds', () => {
  it('returns the union bbox relative to the base point', () => {
    const def = sampleBlock();
    const bounds = blockBounds(def);
    // Items span x 100..180, y 50..90; base is the min corner (100, 50).
    expect(bounds).toEqual({ x: 0, y: 0, w: 80, h: 40 });
  });
});

describe('createBlockRef / instantiateBlock', () => {
  it('stores the unscaled footprint so sx === 1 at insertion', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 });
    expect(ref.x2 - ref.x1).toBe(80);
    expect(ref.y2 - ref.y1).toBe(40);
    const ghosts = instantiateBlock(def, ref);
    const line = ghosts.find((g) => g.element_type === 'line')!;
    // Insert at (500,500) with base (100,50): item (100,50)→(500,500).
    expect(line.x1).toBeCloseTo(500);
    expect(line.y1).toBeCloseTo(500);
    expect(line.x2).toBeCloseTo(580);
    expect(line.y2).toBeCloseTo(500);
  });

  it('gives each ghost a stable ref:id:index key', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 0, y: 0 });
    expect(instantiateBlock(def, ref).map((g) => g.id)).toEqual(['ref-1:0', 'ref-1:1']);
  });

  it('rotates items around the insertion point', () => {
    const def = sampleBlock();
    const ref = { ...createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 }), rotation: Math.PI / 2 };
    const ghosts = instantiateBlock(def, ref as BlockRefElement);
    const line = ghosts.find((g) => g.element_type === 'line')!;
    // (100,50)→insert; (180,50) is +80 x from base → rotated to +80 y (canvas y-down).
    expect(line.x1).toBeCloseTo(500);
    expect(line.y1).toBeCloseTo(500);
    expect(line.x2).toBeCloseTo(500);
    expect(line.y2).toBeCloseTo(580);
  });

  it('stretches items when the ref bbox is resized', () => {
    const def = sampleBlock();
    const ref = { ...createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 }), x2: 500 + 160 };
    const ghosts = instantiateBlock(def, ref as BlockRefElement);
    const line = ghosts.find((g) => g.element_type === 'line')!;
    expect(line.x2 - line.x1).toBeCloseTo(160);
  });
});

describe('explodeBlockRef', () => {
  it('returns real elements with fresh ids preserving the item layer', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 });
    (ref.properties as Record<string, unknown>).layer_id = 'custom-layer';
    const items = explodeBlockRef(ref, def);
    expect(items).toHaveLength(2);
    expect(items.every((el) => el.id !== 'ref-1' && !el.id.includes(':'))).toBe(true);
    expect(items.every((el) => (el.properties as { layer_id?: string }).layer_id === 'custom-layer')).toBe(true);
  });

  it('keeps the item layer when items already carry one', () => {
    const def = sampleBlock();
    (def.items[0].properties as Record<string, unknown>).layer_id = 'item-layer';
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 0, y: 0 });
    const items = explodeBlockRef(ref, def);
    expect((items[0].properties as { layer_id?: string }).layer_id).toBe('item-layer');
  });

  it('returns an empty list for a missing definition', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 0, y: 0 });
    expect(explodeBlockRef(ref, undefined)).toEqual([]);
  });
});

describe('blockById', () => {
  it('finds the definition or undefined', () => {
    const def = sampleBlock();
    expect(blockById([def], 'blk-1')).toBe(def);
    expect(blockById([def], 'missing')).toBeUndefined();
    expect(blockById([def], null)).toBeUndefined();
  });
});
