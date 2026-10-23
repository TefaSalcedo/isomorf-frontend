import { describe, expect, it } from 'vitest';
import type { BlockDefinition, BlockRefElement, ProjectElement } from '@/types/project';
import { createLine, createRectangle, createWall, drawModeOf } from './elements';
import { mirrorElement, rotateElement } from './edit-ops';
import { rectCorners, rotate, type Point } from './geometry';
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

function asymmetricBlock(): BlockDefinition {
  const payload = createBlockFromSelection('asymmetric', [
    createLine('horizontal', PROJECT, { x: 0, y: 0 }, { x: 300, y: 0 }),
    createLine('vertical', PROJECT, { x: 0, y: 0 }, { x: 0, y: 100 }),
    createRectangle('rect', PROJECT, { x: 60, y: 20 }, { x: 240, y: 80 }),
  ])!;
  return { id: 'blk-asymmetric', project_id: PROJECT, created_at: '', updated_at: '', ...payload, description: payload.description ?? '' };
}

function geometryPoints(element: ProjectElement): Point[] {
  if (drawModeOf(element.element_type) === 'rect') return rectCorners(element);
  return [{ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }];
}

function expectGeometryClose(actual: ProjectElement[], expected: ProjectElement[], epsilon = 1e-6) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((element, index) => {
    const actualPoints = geometryPoints(element);
    const expectedPoints = geometryPoints(expected[index]);
    expect(actualPoints).toHaveLength(expectedPoints.length);
    actualPoints.forEach((point, pointIndex) => {
      expect(Math.abs(point.x - expectedPoints[pointIndex].x)).toBeLessThanOrEqual(epsilon);
      expect(Math.abs(point.y - expectedPoints[pointIndex].y)).toBeLessThanOrEqual(epsilon);
    });
  });
}

function expectPointSetsClose(actual: Point[], expected: Point[], epsilon = 1e-6) {
  expect(actual).toHaveLength(expected.length);
  const remaining = [...actual];
  for (const point of expected) {
    const index = remaining.findIndex(
      (candidate) => Math.abs(candidate.x - point.x) <= epsilon && Math.abs(candidate.y - point.y) <= epsilon,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    if (index >= 0) remaining.splice(index, 1);
  }
}

function reflectPoint(point: Point, a: Point, b: Point): Point {
  const axis = { x: b.x - a.x, y: b.y - a.y };
  const fromA = { x: point.x - a.x, y: point.y - a.y };
  const t = (fromA.x * axis.x + fromA.y * axis.y) / (axis.x * axis.x + axis.y * axis.y);
  const projection = { x: a.x + t * axis.x, y: a.y + t * axis.y };
  return { x: 2 * projection.x - point.x, y: 2 * projection.y - point.y };
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

  it('rotates items around the reference bbox center', () => {
    const def = sampleBlock();
    const ref = { ...createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 }), rotation: Math.PI / 2 };
    const ghosts = instantiateBlock(def, ref as BlockRefElement);
    const line = ghosts.find((g) => g.element_type === 'line')!;
    expect(line.x1).toBeCloseTo(560);
    expect(line.y1).toBeCloseTo(480);
    expect(line.x2).toBeCloseTo(560);
    expect(line.y2).toBeCloseTo(560);
  });

  it('stretches items when the ref bbox is resized', () => {
    const def = sampleBlock();
    const ref = { ...createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 }), x2: 500 + 160 };
    const ghosts = instantiateBlock(def, ref as BlockRefElement);
    const line = ghosts.find((g) => g.element_type === 'line')!;
    expect(line.x2 - line.x1).toBeCloseTo(160);
  });

  it('keeps unrotated, unmirrored ghost geometry at its existing insertion coordinates', () => {
    const def = sampleBlock();
    const ref = createBlockRef('ref-1', PROJECT, def, { x: 500, y: 500 });

    expect(instantiateBlock(def, ref).map(geometryPoints)).toEqual([
      [{ x: 500, y: 500 }, { x: 580, y: 500 }],
      [{ x: 500, y: 500 }, { x: 520, y: 500 }, { x: 520, y: 540 }, { x: 500, y: 540 }],
    ]);
  });

  it('rotates every item about the reference bbox center for either pivot', () => {
    const def = asymmetricBlock();
    const insert = { x: 100, y: 100 };
    const ref = createBlockRef('ref-rotate', PROJECT, def, insert);
    const original = instantiateBlock(def, ref);
    const angle = Math.PI / 2;

    for (const pivot of [insert, { x: 25, y: -40 }]) {
      const rotatedRef = rotateElement(ref, pivot, angle) as BlockRefElement;
      const actual = instantiateBlock(def, rotatedRef);
      const expected = original.map((ghost) => rotateElement(ghost, pivot, angle));
      expectGeometryClose(actual, expected);

      const refCorners = rectCorners(rotatedRef);
      const bbox = {
        minX: Math.min(...refCorners.map((point) => point.x)),
        minY: Math.min(...refCorners.map((point) => point.y)),
        maxX: Math.max(...refCorners.map((point) => point.x)),
        maxY: Math.max(...refCorners.map((point) => point.y)),
      };
      for (const point of actual.flatMap(geometryPoints)) {
        expect(point.x).toBeGreaterThanOrEqual(bbox.minX - 1e-6);
        expect(point.x).toBeLessThanOrEqual(bbox.maxX + 1e-6);
        expect(point.y).toBeGreaterThanOrEqual(bbox.minY - 1e-6);
        expect(point.y).toBeLessThanOrEqual(bbox.maxY + 1e-6);
      }
    }
  });

  it('mirrors instance contents across an arbitrary axis and toggles the ref flag', () => {
    const def = asymmetricBlock();
    const ref = createBlockRef('ref-mirror', PROJECT, def, { x: 100, y: 100 });
    const axisStart = { x: 0, y: 0 };
    const axisEnd = { x: 1, y: 2 };
    const original = instantiateBlock(def, ref).flatMap(geometryPoints);
    const mirroredRef = mirrorElement(ref, axisStart, axisEnd) as BlockRefElement;
    const mirrored = instantiateBlock(def, mirroredRef).flatMap(geometryPoints);

    expect(mirroredRef.properties.mirrored).toBe(true);
    expectPointSetsClose(mirrored, original.map((point) => reflectPoint(point, axisStart, axisEnd)));

    const restoredRef = mirrorElement(mirroredRef, axisStart, axisEnd) as BlockRefElement;
    expect(restoredRef.properties.mirrored).toBe(false);
    expectPointSetsClose(instantiateBlock(def, restoredRef).flatMap(geometryPoints), original);
  });

  it('explodes rotated and mirrored contents with fresh ids and no ref-only mirror flag', () => {
    const def = asymmetricBlock();
    const ref = createBlockRef('ref-explode', PROJECT, def, { x: 100, y: 100 });
    const rotated = rotateElement(ref, { x: 100, y: 100 }, Math.PI / 2) as BlockRefElement;
    const transformed = mirrorElement(rotated, { x: 0, y: 0 }, { x: 1, y: 2 }) as BlockRefElement;
    const ghosts = instantiateBlock(def, transformed);
    const exploded = explodeBlockRef(transformed, def);

    expectGeometryClose(exploded, ghosts);
    expect(
      exploded.every((element, index) => element.id !== transformed.id && element.id !== ghosts[index].id),
    ).toBe(true);
    expect(exploded.every((element) => !Object.prototype.hasOwnProperty.call(element.properties, 'mirrored'))).toBe(true);
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
