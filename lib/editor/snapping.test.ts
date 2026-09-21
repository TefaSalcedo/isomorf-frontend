import { describe, expect, it } from 'vitest';
import { createColumn, createWall } from './elements';
import {
  findColumnContainingPoint,
  isPointInsideColumn,
  isPointOnWall,
  snapForColumn,
  snapPixelsForZoom,
  snapToNearest,
  snapToSegmentMidpoint,
  wallCrossesColumnInterior,
} from './snapping';

const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 });
const column = createColumn('c1', 'p1', { x: 200, y: 200 }); // 30x30 cm centered

describe('snapPixelsForZoom', () => {
  it('grows the tolerance with zoom, capped at +2 levels', () => {
    expect(snapPixelsForZoom(1)).toBe(12);
    expect(snapPixelsForZoom(2)).toBe(18);
    expect(snapPixelsForZoom(10)).toBe(24);
    expect(snapPixelsForZoom(0.5)).toBe(12);
  });
});

describe('snapToNearest', () => {
  it('snaps to the closest endpoint within tolerance', () => {
    const result = snapToNearest({ x: 3, y: 3 }, [wall], 1, 1);
    expect(result?.target.type).toBe('start');
    expect(result?.point).toEqual({ x: 0, y: 0 });
  });

  it('returns null beyond the tolerance', () => {
    expect(snapToNearest({ x: 200, y: 200 }, [wall], 1, 1)).toBeNull();
  });

  it('excludes the given element', () => {
    const result = snapToNearest({ x: 3, y: 3 }, [wall], 1, 1, 'w1');
    expect(result).toBeNull();
  });
});

describe('snapToSegmentMidpoint', () => {
  it('snaps near the midpoint only', () => {
    expect(snapToSegmentMidpoint({ x: 205, y: 5 }, wall, 1, 1)?.point).toEqual({ x: 200, y: 0 });
    expect(snapToSegmentMidpoint({ x: 5, y: 5 }, wall, 1, 1)).toBeNull();
  });
});

describe('column containment', () => {
  it('detects points inside the column footprint', () => {
    expect(findColumnContainingPoint({ x: 205, y: 205 }, [column])?.id).toBe('c1');
    expect(isPointInsideColumn({ x: 205, y: 205 }, [column])).toBe(true);
    expect(isPointInsideColumn({ x: 250, y: 250 }, [column])).toBe(false);
  });
});

describe('wallCrossesColumnInterior', () => {
  it('detects segments crossing the column footprint', () => {
    expect(wallCrossesColumnInterior({ x: 100, y: 200 }, { x: 300, y: 200 }, [column])).toBe(true);
    expect(wallCrossesColumnInterior({ x: 0, y: 0 }, { x: 100, y: 0 }, [column])).toBe(false);
  });
});

describe('snapForColumn', () => {
  it('snaps to wall intersections first', () => {
    const horizontal = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 });
    const vertical = createWall('w2', 'p1', { x: 200, y: -100 }, { x: 200, y: 100 });
    const result = snapForColumn({ x: 203, y: 3 }, [horizontal, vertical], 1, 1);
    expect(result?.target.type).toBe('intersection');
    expect(result?.point).toEqual({ x: 200, y: 0 });
  });

  it('falls back to projecting onto a wall', () => {
    const result = snapForColumn({ x: 200, y: 4 }, [wall], 1, 1);
    expect(result?.target.type).toBe('wall');
    expect(result?.point.y).toBe(0);
  });

  it('returns null with no walls', () => {
    expect(snapForColumn({ x: 0, y: 0 }, [], 1, 1)).toBeNull();
  });
});

describe('isPointOnWall', () => {
  it('checks distance to the segment', () => {
    expect(isPointOnWall({ x: 200, y: 2 }, wall, 5)).toBe(true);
    expect(isPointOnWall({ x: 200, y: 20 }, wall, 5)).toBe(false);
    expect(isPointOnWall({ x: 500, y: 0 }, wall, 5)).toBe(false);
  });

  it('ignores non-line elements', () => {
    expect(isPointOnWall({ x: 200, y: 200 }, column, 5)).toBe(false);
  });
});
