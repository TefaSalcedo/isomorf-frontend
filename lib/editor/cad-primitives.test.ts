import { describe, expect, it } from 'vitest';
import type { ArcElement, CircleElement, PolylineElement } from '@/types/project';
import {
  ANNOTATION_TYPES,
  arcSpecFromPoints,
  createArc,
  createCircle,
  createEllipse,
  createHatch,
  createLine,
  createPolyline,
  createRectangle,
  createWall,
  drawModeOf,
  normalizeElement,
} from './elements';
import { ccwSweep, distance, sampleArcPoints } from './geometry';
import { hatchSegments } from './hatch';
import { snapToNearest } from './snapping';

describe('draw modes', () => {
  it('assigns the CAD modes to each primitive', () => {
    expect(drawModeOf('line')).toBe('line');
    expect(drawModeOf('polyline')).toBe('poly');
    expect(drawModeOf('arc')).toBe('arc');
    expect(drawModeOf('circle')).toBe('center');
    expect(drawModeOf('ellipse')).toBe('rect');
    expect(drawModeOf('rectangle')).toBe('rect');
    expect(drawModeOf('hatch')).toBe('rect');
  });

  it('marks every primitive as annotation, not structure', () => {
    for (const type of ['line', 'polyline', 'arc', 'circle', 'ellipse', 'rectangle', 'hatch'] as const) {
      expect(ANNOTATION_TYPES.has(type)).toBe(true);
    }
    expect(ANNOTATION_TYPES.has('wall')).toBe(false);
  });
});

describe('factories', () => {
  it('creates a plain line', () => {
    const line = createLine('l1', 'p1', { x: 0, y: 0 }, { x: 300, y: 400 });
    expect(line.element_type).toBe('line');
    expect(line.length).toBe(500);
  });

  it('creates an open polyline with ordered vertices', () => {
    const poly = createPolyline('pl1', 'p1', [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }]);
    expect(poly.properties.points).toHaveLength(3);
    expect(poly.properties.closed).toBe(false);
    expect(poly.x1).toBe(0);
    expect(poly.x2).toBe(600);
    expect(poly.length).toBeCloseTo(1000);
  });

  it('closes a polyline by repeating the first vertex', () => {
    const poly = createPolyline('pl1', 'p1', [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }, { x: 0, y: 400 }], true);
    expect(poly.properties.closed).toBe(true);
    expect(poly.properties.points).toHaveLength(5);
    expect(poly.properties.points[4]).toEqual({ x: 0, y: 0 });
  });

  it('does not duplicate the first vertex when it is already last', () => {
    const points = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 0, y: 0 }];
    const poly = createPolyline('pl1', 'p1', points, true);
    expect(poly.properties.points).toHaveLength(3);
    expect(poly.properties.closed).toBe(true);
  });

  it('detects an implicit close when the last click lands on the first vertex', () => {
    const points = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 0, y: 0 }];
    const poly = createPolyline('pl1', 'p1', points);
    expect(poly.properties.closed).toBe(true);
  });

  it('creates a circle storing center and radius', () => {
    const circle = createCircle('c1', 'p1', { x: 100, y: 100 }, 75);
    expect(circle.x1).toBe(100);
    expect(circle.x2).toBe(175);
    expect(circle.properties.radius).toBe(75);
    expect(circle.length).toBeCloseTo(2 * Math.PI * 75);
  });

  it('creates ellipse, rectangle and hatch as normalized rects', () => {
    const ellipse = createEllipse('e1', 'p1', { x: 200, y: 100 }, { x: 100, y: 200 });
    expect(ellipse.x1).toBe(100);
    expect(ellipse.y2).toBe(200);
    const rect = createRectangle('r1', 'p1', { x: 0, y: 0 }, { x: 600, y: 400 });
    expect(rect.length).toBe(600);
    const hatch = createHatch('h1', 'p1', { x: 0, y: 0 }, { x: 600, y: 400 });
    expect(hatch.properties.pattern).toBe('ansi31');
    expect(hatch.properties.spacing).toBe(35);
  });
});

describe('arcs', () => {
  // Quarter arc: start (100,0), through (100*cos45, 100*sin45), end (0,100).
  const start = { x: 100, y: 0 };
  const mid = { x: Math.SQRT1_2 * 100, y: Math.SQRT1_2 * 100 };
  const end = { x: 0, y: 100 };

  it('derives center, radius and angles from three points', () => {
    const spec = arcSpecFromPoints(start, mid, end);
    expect(spec).not.toBeNull();
    expect(spec!.cx).toBeCloseTo(0);
    expect(spec!.cy).toBeCloseTo(0);
    expect(spec!.radius).toBeCloseTo(100);
    expect(spec!.start_angle).toBeCloseTo(0);
    expect(spec!.end_angle).toBeCloseTo(Math.PI / 2);
    expect(spec!.clockwise).toBe(false);
  });

  it('detects the clockwise direction when the mid point goes the other way', () => {
    const spec = arcSpecFromPoints(start, { x: Math.SQRT1_2 * 100, y: -Math.SQRT1_2 * 100 }, end);
    expect(spec).not.toBeNull();
    expect(spec!.clockwise).toBe(true);
  });

  it('returns null for collinear points', () => {
    expect(arcSpecFromPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 })).toBeNull();
  });

  it('creates an arc element whose length is the arc length', () => {
    const arc = createArc('a1', 'p1', start, mid, end);
    expect(arc).not.toBeNull();
    expect(arc!.length).toBeCloseTo((Math.PI / 2) * 100, 0);
    expect(arc!.properties.mid).toEqual(mid);
  });

  it('samples arc points including both chord endpoints', () => {
    const points = sampleArcPoints(0, 0, 100, 0, Math.PI / 2, false);
    expect(points[0]).toEqual({ x: 100, y: 0 });
    const last = points[points.length - 1];
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(100);
    // Every sample stays on the circle.
    for (const p of points) expect(distance(p, { x: 0, y: 0 })).toBeCloseTo(100, 5);
  });

  it('sampled sweep follows the clockwise flag', () => {
    const cw = sampleArcPoints(0, 0, 100, 0, Math.PI / 2, true);
    // Clockwise from angle 0 travels through negative angles first.
    expect(cw[Math.floor(cw.length / 2)].y).toBeLessThan(0);
    const sweep = ccwSweep(Math.PI / 2, 0); // cw sweep from 0 to 90°
    expect(sweep).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe('normalizeElement', () => {
  it('backfills defaults for CAD primitives from older documents', () => {
    const raw = {
      id: 'h1', project_id: 'p1', element_type: 'hatch', x1: 0, y1: 0, x2: 100, y2: 100,
      length: 100, rotation: 0, properties: {}, created_at: '', updated_at: '',
      material_id: null, section_id: null,
    };
    const el = normalizeElement(raw as never);
    expect(el.element_type).toBe('hatch');
    if (el.element_type === 'hatch') {
      expect(el.properties.pattern).toBe('ansi31');
      expect(el.properties.spacing).toBe(35);
    }
  });
});

describe('hatchSegments', () => {
  const rect = { x: 0, y: 0, width: 200, height: 100 };

  it('produces clipped 45° lines for ansi31', () => {
    const segs = hatchSegments(rect, 'ansi31', 25, 45);
    expect(segs.length % 4).toBe(0);
    expect(segs.length).toBeGreaterThan(8);
    for (let i = 0; i < segs.length; i += 4) {
      const [x1, y1, x2, y2] = segs.slice(i, i + 4);
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        expect(x).toBeGreaterThanOrEqual(-0.001);
        expect(x).toBeLessThanOrEqual(200.001);
        expect(y).toBeGreaterThanOrEqual(-0.001);
        expect(y).toBeLessThanOrEqual(100.001);
      }
    }
  });

  it('grid pattern emits axis-aligned segments only', () => {
    const segs = hatchSegments(rect, 'grid', 50, 0);
    for (let i = 0; i < segs.length; i += 4) {
      const [x1, y1, x2, y2] = segs.slice(i, i + 4);
      expect(x1 === x2 || y1 === y2).toBe(true);
    }
  });

  it('cross pattern emits two perpendicular families', () => {
    const segs = hatchSegments(rect, 'cross', 40, 0);
    const slopes = new Set<number>();
    for (let i = 0; i < segs.length; i += 4) {
      const [x1, y1, x2, y2] = segs.slice(i, i + 4);
      slopes.add(Math.round(Math.atan2(y2 - y1, x2 - x1) * 1000));
    }
    expect(slopes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('snapping on primitives', () => {
  const polyline = createPolyline('pl1', 'p1', [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }]) as PolylineElement;
  const circle = createCircle('c1', 'p1', { x: 300, y: 300 }, 100) as CircleElement;
  const arc = createArc('a1', 'p1', { x: 0, y: 0 }, { x: 707, y: 707 }, { x: 0, y: 1000 }) as ArcElement;

  it('snaps to polyline vertices', () => {
    // Approaching the corner from outside the segments keeps the vertex anchor
    // on a tie against the clamped edge projections.
    const result = snapToNearest({ x: 602, y: -5 }, [polyline], 1, 1);
    expect(result?.target.type).toBe('vertex');
    expect(result?.point).toEqual({ x: 600, y: 0 });
  });

  it('snaps to circle center and quadrants', () => {
    const center = snapToNearest({ x: 301, y: 302 }, [circle], 1, 1);
    expect(center?.target.type).toBe('center');
    // On the 0° quadrant the anchor wins the tie against the edge projection.
    const quadrant = snapToNearest({ x: 401, y: 300 }, [circle], 1, 1);
    expect(quadrant?.target.type).toBe('quadrant');
    expect(quadrant?.point).toEqual({ x: 400, y: 300 });
  });

  it('snaps to the nearest point on a circle edge', () => {
    // Cursor 105 cm from the center (5 cm outside the 100 cm edge): the
    // projection lands on the circumference.
    const cursor = { x: 300 + 105 * Math.SQRT1_2, y: 300 + 105 * Math.SQRT1_2 };
    const result = snapToNearest(cursor, [circle], 1, 1);
    expect(result?.target.type).toBe('nearest');
    expect(distance(result!.point, { x: 300, y: 300 })).toBeCloseTo(100, 4);
  });

  it('snaps to the arc center and its mid point', () => {
    const center = snapToNearest({ x: arc.properties.cx + 2, y: arc.properties.cy + 2 }, [arc], 1, 1);
    expect(center?.target.type).toBe('center');
    // Exactly on the mid point the vertex anchor wins over the arc edge.
    const mid = snapToNearest({ x: 707, y: 707 }, [arc], 1, 1);
    expect(mid?.target.type).toBe('vertex');
    expect(mid?.point).toEqual({ x: 707, y: 707 });
  });

  it('snaps perpendicular from the draft anchor', () => {
    const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 });
    const result = snapToNearest({ x: 150, y: 5 }, [wall], 1, 1, undefined, { x: 150, y: 300 });
    expect(result?.target.type).toBe('perpendicular');
    expect(result?.point).toEqual({ x: 150, y: 0 });
  });

  it('snaps to the nearest point on a polyline segment', () => {
    const result = snapToNearest({ x: 300, y: 8 }, [polyline], 1, 1);
    expect(result?.target.type).toBe('nearest');
    expect(result?.point).toEqual({ x: 300, y: 0 });
  });
});
