import { describe, expect, it } from 'vitest';
import type { WallElement } from '@/types/project';
import {
  createBeam,
  createColumn,
  createDoor,
  createWall,
  createWindow,
  defaultDesignSettings,
  normalizeElement,
  updateBeamLength,
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
