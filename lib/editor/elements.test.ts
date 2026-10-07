import { describe, expect, it } from 'vitest';
import type { ElementType, StairElement, WallElement } from '@/types/project';
import {
  createBeam,
  createBrace,
  createColumn,
  createDoor,
  createFooting,
  createGradeBeam,
  createJoist,
  createOpening,
  createPile,
  createRamp,
  createSlab,
  createStair,
  createWall,
  createWindow,
  defaultDesignSettings,
  defaultPropertiesFor,
  drawModeOf,
  normalizeElement,
  rectSize,
  updateBeamLength,
  updateRectSize,
  updateWallLength,
  wallLengthInMeters,
  WALL_DEFAULT_HEIGHT,
} from './elements';

describe('createWall', () => {
  it('computes length and rotation from endpoints', () => {
    const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 300, y: 400 });
    expect(wall.element_type).toBe('wall');
    expect(wall.length).toBe(500);
    expect(wall.rotation).toBeCloseTo(Math.atan2(400, 300));
    expect(wallLengthInMeters(wall)).toBe(5);
  });

  it('applies default properties and accepts overrides', () => {
    const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 100, y: 0 }, { thickness: 0.2 });
    expect(wall.properties.height).toBe(WALL_DEFAULT_HEIGHT);
    expect(wall.properties.thickness).toBe(0.2);
    expect(wall.properties.join_mode).toBe('perpendicular');
  });
});

describe('createColumn', () => {
  it('centers the column on the given point', () => {
    const column = createColumn('c1', 'p1', { x: 50, y: 60 });
    expect(column.element_type).toBe('column');
    expect(column.x1).toBe(50);
    expect(column.y1).toBe(60);
    expect(column.properties.width).toBeCloseTo(0.3);
    expect(column.properties.height).toBe(2.5);
  });
});

describe('createBeam / createDoor / createWindow', () => {
  it('creates a beam storing length in meters', () => {
    const beam = createBeam('b1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 });
    expect(beam.element_type).toBe('beam');
    expect(beam.length).toBe(400);
    expect(beam.properties.length).toBe(4);
    expect(beam.properties.material).toBe('concrete');
  });

  it('creates openings with metric width', () => {
    const door = createDoor('d1', 'p1', { x: 0, y: 0 }, { x: 90, y: 0 });
    expect(door.properties.width).toBeCloseTo(0.9);
    const window_ = createWindow('n1', 'p1', { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(window_.properties.width).toBeCloseTo(1);
    expect(window_.properties.sill_height).toBeCloseTo(0.9);
  });
});

describe('normalizeElement', () => {
  it('fills missing wall properties without dropping existing ones', () => {
    const raw = {
      id: 'w1', project_id: 'p1', element_type: 'wall', x1: 0, y1: 0, x2: 100, y2: 0,
      length: 100, rotation: 0, properties: { thickness: 0.25 }, created_at: '', updated_at: '',
    } as WallElement;
    const normalized = normalizeElement(raw) as WallElement;
    expect(normalized.properties.thickness).toBe(0.25);
    expect(normalized.properties.height).toBe(WALL_DEFAULT_HEIGHT);
    expect(normalized.properties.join_host_id).toBeNull();
  });

  it('fills beam defaults including metric length', () => {
    const raw = {
      id: 'b1', project_id: 'p1', element_type: 'beam', x1: 0, y1: 0, x2: 500, y2: 0,
      length: 500, rotation: 0, properties: {}, created_at: '', updated_at: '',
    } as never;
    const normalized = normalizeElement(raw);
    if (normalized.element_type !== 'beam') throw new Error('expected a beam');
    expect(normalized.properties.length).toBe(5);
    expect(normalized.properties.width).toBeCloseTo(0.2);
  });
});

describe('updateWallLength', () => {
  it('extends the wall along its rotation', () => {
    const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 200, y: 0 });
    const longer = updateWallLength(wall, 5);
    expect(longer.length).toBe(500);
    expect(longer.x2).toBeCloseTo(500);
    expect(longer.y2).toBeCloseTo(0);
  });

  it('moves the start when the join target is the end', () => {
    const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 200, y: 0 }, { join_target: 'end', join_host_id: 'host' });
    const longer = updateWallLength(wall, 5);
    expect(longer.x2).toBeCloseTo(200);
    expect(longer.x1).toBeCloseTo(-300);
  });
});

describe('updateBeamLength', () => {
  it('updates geometry and the metric property', () => {
    const beam = createBeam('b1', 'p1', { x: 0, y: 0 }, { x: 200, y: 0 });
    const longer = updateBeamLength(beam, 6);
    expect(longer.length).toBe(600);
    expect(longer.properties.length).toBe(6);
    expect(longer.x2).toBeCloseTo(600);
  });
});

describe('defaultDesignSettings', () => {
  it('returns meters and empty zones', () => {
    const settings = defaultDesignSettings();
    expect(settings.unit).toBe('m');
    expect(settings.material).toBeDefined();
  });
});

describe('drawModeOf', () => {
  it('assigns a draw mode to every element type', () => {
    const types: ElementType[] = [
      'wall', 'door', 'window', 'column', 'beam', 'joist', 'grade_beam',
      'brace', 'pile', 'slab', 'footing', 'stair', 'ramp', 'opening',
    ];
    for (const type of types) expect(drawModeOf(type)).toMatch(/line|point|rect/);
  });

  it('classifies line, point and rect tools', () => {
    expect(drawModeOf('wall')).toBe('line');
    expect(drawModeOf('joist')).toBe('line');
    expect(drawModeOf('grade_beam')).toBe('line');
    expect(drawModeOf('brace')).toBe('line');
    expect(drawModeOf('column')).toBe('point');
    expect(drawModeOf('pile')).toBe('point');
    expect(drawModeOf('slab')).toBe('rect');
    expect(drawModeOf('footing')).toBe('rect');
    expect(drawModeOf('stair')).toBe('rect');
    expect(drawModeOf('ramp')).toBe('rect');
    expect(drawModeOf('opening')).toBe('rect');
  });
});

describe('line factories', () => {
  it('creates a joist with spacing default', () => {
    const joist = createJoist('j1', 'p1', { x: 0, y: 0 }, { x: 500, y: 0 });
    expect(joist.element_type).toBe('joist');
    expect(joist.length).toBe(500);
    expect(joist.properties.spacing).toBeCloseTo(0.45);
  });

  it('creates a grade beam at ground elevation', () => {
    const beam = createGradeBeam('g1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 });
    expect(beam.element_type).toBe('grade_beam');
    expect(beam.properties.top_elevation).toBe(0);
  });

  it('creates a brace spanning a story height', () => {
    const brace = createBrace('x1', 'p1', { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(brace.element_type).toBe('brace');
    expect(brace.properties.bottom_z).toBe(0);
    expect(brace.properties.top_z).toBeGreaterThan(0);
  });
});

describe('createPile', () => {
  it('places a pile centered on the point', () => {
    const pile = createPile('pl1', 'p1', { x: 80, y: 120 });
    expect(pile.element_type).toBe('pile');
    expect(pile.x1).toBe(80);
    expect(pile.y1).toBe(120);
    expect(pile.properties.diameter).toBeCloseTo(0.4);
    expect(pile.properties.pile_length).toBe(12);
  });
});

describe('rect factories', () => {
  it('creates a slab normalized from inverted corners', () => {
    const slab = createSlab('s1', 'p1', { x: 300, y: 200 }, { x: 0, y: 0 });
    expect(slab.element_type).toBe('slab');
    expect(slab.x1).toBe(0);
    expect(slab.y1).toBe(0);
    expect(slab.x2).toBe(300);
    expect(slab.y2).toBe(200);
    expect(slab.rotation).toBe(0);
    expect(slab.properties.thickness).toBeCloseTo(0.15);
  });

  it('creates footing, stair, ramp and opening with defaults', () => {
    const footing = createFooting('f1', 'p1', { x: 0, y: 0 }, { x: 150, y: 150 });
    expect(footing.properties.depth).toBeCloseTo(0.4);
    const stair = createStair('st1', 'p1', { x: 0, y: 0 }, { x: 100, y: 400 });
    expect(stair.properties.step_count).toBe(14);
    expect(stair.properties.run_axis).toBe('x');
    const ramp = createRamp('r1', 'p1', { x: 0, y: 0 }, { x: 100, y: 600 });
    expect(ramp.properties.slope_percent).toBeCloseTo(12.5);
    const opening = createOpening('o1', 'p1', { x: 0, y: 0 }, { x: 80, y: 80 });
    expect(opening.element_type).toBe('opening');
  });
});

describe('rectSize / updateRectSize', () => {
  it('reads footprint size and resizes keeping the min corner', () => {
    const slab = createSlab('s1', 'p1', { x: 10, y: 20 }, { x: 310, y: 220 });
    expect(rectSize(slab)).toEqual({ width: 300, depth: 200 });
    const resized = updateRectSize(slab, 500, 400);
    expect(resized.x1).toBe(10);
    expect(resized.y1).toBe(20);
    expect(resized.x2).toBe(510);
    expect(resized.y2).toBe(420);
    expect(resized.length).toBe(500);
    expect(resized.rotation).toBe(0);
  });
});

describe('normalizeElement for new types', () => {
  it('fills stair defaults and null catalog references', () => {
    const raw = {
      id: 'st1', project_id: 'p1', element_type: 'stair', x1: 0, y1: 0, x2: 100, y2: 400,
      length: 100, rotation: 0, properties: { step_count: 10 }, created_at: '', updated_at: '',
    } as never;
    const normalized = normalizeElement(raw);
    if (normalized.element_type !== 'stair') throw new Error('expected a stair');
    const stair = normalized as StairElement;
    expect(stair.properties.step_count).toBe(10);
    expect(stair.properties.tread).toBeCloseTo(0.28);
    expect(stair.material_id).toBeNull();
    expect(stair.section_id).toBeNull();
  });
});

describe('defaultPropertiesFor', () => {
  it('returns defaults for every element type', () => {
    const types: ElementType[] = [
      'wall', 'door', 'window', 'column', 'beam', 'joist', 'grade_beam',
      'brace', 'pile', 'slab', 'footing', 'stair', 'ramp', 'opening',
    ];
    for (const type of types) expect(defaultPropertiesFor(type)).toBeTypeOf('object');
  });
});
