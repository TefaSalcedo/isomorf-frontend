import { describe, expect, it } from 'vitest';
import type { WallElement } from '@/types/project';
import { calculateSelectionSummary, findClosedLoops } from './calculations';
import { createWall } from './elements';

function square(): WallElement[] {
  return [
    createWall('w1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 }),
    createWall('w2', 'p1', { x: 400, y: 0 }, { x: 400, y: 300 }),
    createWall('w3', 'p1', { x: 400, y: 300 }, { x: 0, y: 300 }),
    createWall('w4', 'p1', { x: 0, y: 300 }, { x: 0, y: 0 }),
  ];
}

describe('findClosedLoops', () => {
  it('returns null with fewer than three walls', () => {
    expect(findClosedLoops(square().slice(0, 2))).toBeNull();
  });

  it('returns null for an open chain of walls', () => {
    expect(findClosedLoops(square().slice(0, 3))).toBeNull();
  });

  it('finds the loop of a closed rectangle', () => {
    const loops = findClosedLoops(square());
    expect(loops).toHaveLength(1);
    expect(loops![0].area).toBeCloseTo(12); // 4 m x 3 m
    expect(loops![0].perimeter).toBeCloseTo(14);
    expect(loops![0].points).toHaveLength(4);
  });
});

describe('calculateSelectionSummary', () => {
  it('summarizes an empty selection', () => {
    const summary = calculateSelectionSummary([]);
    expect(summary).toEqual({ totalLength: 0, volume: 0, interiorArea: null, exteriorArea: null, wallCount: 0 });
  });

  it('computes length, volume and wall-adjusted areas for a closed loop', () => {
    const summary = calculateSelectionSummary(square());
    expect(summary.wallCount).toBe(4);
    expect(summary.totalLength).toBeCloseTo(14);
    // 4m*2 walls: 4*2.5*0.15 = 1.5 m3 each; 3m*2 walls: 1.125 m3 each
    expect(summary.volume).toBeCloseTo(5.25);
    // thickness 0.15 m -> d = 0.075 m offset from the 12 m2 centerline
    expect(summary.interiorArea).toBeCloseTo(12 - 0.075 * 14 + Math.PI * 0.075 * 0.075);
    expect(summary.exteriorArea).toBeCloseTo(12 + 0.075 * 14 + Math.PI * 0.075 * 0.075);
  });

  it('reports null areas when the selection is not closed', () => {
    const summary = calculateSelectionSummary(square().slice(0, 3));
    expect(summary.interiorArea).toBeNull();
    expect(summary.exteriorArea).toBeNull();
    expect(summary.totalLength).toBeCloseTo(11);
  });
});
