import { describe, expect, it } from 'vitest';
import {
  add,
  clamp,
  cross,
  distance,
  dot,
  isClose,
  lineIntersection,
  midpoint,
  polarSnapPoint,
  projectPointOnSegment,
  rectangleFromCenter,
  rotate,
  sub,
  toDegrees,
  toRadians,
} from './geometry';

describe('vector helpers', () => {
  it('adds, subtracts and measures points', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(sub({ x: 3, y: 4 }, { x: 1, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 6 })).toEqual({ x: 2, y: 3 });
  });

  it('compares floats with tolerance', () => {
    expect(isClose(1, 1 + 1e-5)).toBe(true);
    expect(isClose(1, 1.01)).toBe(false);
  });
});

describe('projectPointOnSegment', () => {
  it('projects onto the interior of a segment', () => {
    const result = projectPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(result.point).toEqual({ x: 5, y: 0 });
    expect(result.t).toBe(0.5);
    expect(result.distance).toBe(5);
  });

  it('clamps to the nearest endpoint outside the segment', () => {
    const result = projectPointOnSegment({ x: -5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(result.point).toEqual({ x: 0, y: 0 });
    expect(result.t).toBe(0);
  });

  it('handles a degenerate segment', () => {
    const result = projectPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(result.t).toBe(0);
    expect(result.distance).toBe(5);
  });
});

describe('lineIntersection', () => {
  it('finds the crossing point of two segments', () => {
    const point = lineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 });
    expect(point).toEqual({ x: 5, y: 0 });
  });

  it('returns null for parallel segments', () => {
    expect(lineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBeNull();
  });

  it('returns null when the intersection lies outside the segments', () => {
    expect(lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe('rotation and angles', () => {
  it('converts between radians and degrees', () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
  });

  it('rotates a point 90 degrees', () => {
    const rotated = rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('builds a rectangle from center, size and rotation', () => {
    const corners = rectangleFromCenter({ x: 0, y: 0 }, 4, 2, 0);
    expect(corners).toHaveLength(4);
    expect(corners[0]).toEqual({ x: -2, y: -1 });
    expect(corners[2]).toEqual({ x: 2, y: 1 });
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('polarSnapPoint', () => {
  const start = { x: 0, y: 0 };

  it('locks a near-45-degree direction preserving the distance', () => {
    const point = { x: 10, y: 9.4 };
    const result = polarSnapPoint(start, point);
    expect(result.locked).toBe(true);
    expect(toDegrees(Math.atan2(result.point.y, result.point.x))).toBeCloseTo(45);
    expect(distance(start, result.point)).toBeCloseTo(distance(start, point));
  });

  it('locks horizontal and vertical directions', () => {
    expect(polarSnapPoint(start, { x: 10, y: 0.02 }).locked).toBe(true);
    const vertical = polarSnapPoint(start, { x: 0.02, y: 10 });
    expect(vertical.locked).toBe(true);
    expect(vertical.point.x).toBeCloseTo(0);
  });

  it('does not lock directions far from the increment', () => {
    const point = { x: 10, y: 3.6 };
    const result = polarSnapPoint(start, point);
    expect(result.locked).toBe(false);
    expect(result.point).toEqual(point);
  });

  it('does not lock a zero-length draft', () => {
    expect(polarSnapPoint(start, start).locked).toBe(false);
  });

  it('respects a custom increment', () => {
    const nearVertical = polarSnapPoint(start, { x: 0.05, y: 10 }, Math.PI / 2);
    expect(nearVertical.locked).toBe(true);
    expect(nearVertical.point.x).toBeCloseTo(0);
  });
});
