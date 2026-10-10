import { describe, expect, it } from 'vitest';
import type { ArcElement, CircleElement, ColumnElement, LineElement, PolylineElement, RectangleElement } from '@/types/project';
import {
  createArc,
  createCircle,
  createColumn,
  createLine,
  createPolyline,
  createRectangle,
  createWall,
} from './elements';
import {
  applyGrip,
  elementInBox,
  extendLineTo,
  filletLines,
  gripsFor,
  mirrorElement,
  offsetChain,
  offsetElement,
  pickElementAt,
  polarArrayCopies,
  rectArrayCopies,
  rectCorners,
  rotateElement,
  scaleElement,
  translateElement,
  trimLineEnd,
} from './edit-ops';
import { distance } from './geometry';

const P = 'p1';

describe('translateElement', () => {
  it('moves a line keeping length and rotation', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 300, y: 400 });
    const moved = translateElement(line, 50, -25);
    expect(moved.x1).toBe(50);
    expect(moved.y1).toBe(-25);
    expect(moved.x2).toBe(350);
    expect(moved.y2).toBe(375);
    expect(moved.length).toBe(500);
  });

  it('moves every polyline vertex', () => {
    const poly = createPolyline('pl1', P, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const moved = translateElement(poly, 10, 20) as PolylineElement;
    expect(moved.properties.points).toEqual([{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 120 }]);
  });

  it('moves a circle keeping the radius', () => {
    const circle = createCircle('c1', P, { x: 100, y: 100 }, 50);
    const moved = translateElement(circle, 10, 0) as CircleElement;
    expect(moved.x1).toBe(110);
    expect(moved.properties.radius).toBe(50);
  });

  it('moves an arc translating center, chord and through-point', () => {
    const arc = createArc('a1', P, { x: 100, y: 0 }, { x: Math.SQRT1_2 * 100, y: Math.SQRT1_2 * 100 }, { x: 0, y: 100 })!;
    const moved = translateElement(arc, 1000, 2000) as ArcElement;
    expect(moved.properties.cx).toBeCloseTo(1000);
    expect(moved.properties.cy).toBeCloseTo(2000);
    expect(moved.x1).toBeCloseTo(1100);
    expect(moved.properties.radius).toBeCloseTo(100);
  });

  it('moves a column keeping its footprint size', () => {
    const col = createColumn('k1', P, { x: 50, y: 50 });
    const moved = translateElement(col, 100, 200) as ColumnElement;
    expect(moved.x1).toBe(150);
    expect(moved.y1).toBe(250);
    expect(moved.properties.width).toBe(col.properties.width);
  });
});

describe('rotateElement', () => {
  it('rotates a line 90° about the origin', () => {
    const line = createLine('l1', P, { x: 100, y: 0 }, { x: 200, y: 0 });
    const rotated = rotateElement(line, { x: 0, y: 0 }, Math.PI / 2);
    expect(rotated.x1).toBeCloseTo(0);
    expect(rotated.y1).toBeCloseTo(100);
    expect(rotated.x2).toBeCloseTo(0);
    expect(rotated.y2).toBeCloseTo(200);
    expect(rotated.rotation).toBeCloseTo(Math.PI / 2);
    expect(rotated.length).toBeCloseTo(100);
  });

  it('rotates a rectangle around its own center', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 200, y: 100 });
    const rotated = rotateElement(rect, { x: 100, y: 50 }, Math.PI / 2);
    expect(rotated.rotation).toBeCloseTo(Math.PI / 2);
    // Center stays put: the bbox swaps width/depth visually via rotation.
    expect((rotated.x1 + rotated.x2) / 2).toBeCloseTo(100);
    expect((rotated.y1 + rotated.y2) / 2).toBeCloseTo(50);
    const corners = rectCorners(rotated);
    // Rotated corners: the 200x100 box becomes 100x200 centered at (100,50).
    expect(corners.map((p) => Math.round(p.x)).sort((a, b) => a - b)).toEqual([50, 50, 150, 150]);
    expect(corners.map((p) => Math.round(p.y)).sort((a, b) => a - b)).toEqual([-50, -50, 150, 150]);
  });

  it('rotates a polyline vertex by vertex', () => {
    const poly = createPolyline('pl1', P, [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }]);
    const rotated = rotateElement(poly, { x: 0, y: 0 }, -Math.PI / 2) as PolylineElement;
    expect(rotated.properties.points[0].x).toBeCloseTo(0);
    expect(rotated.properties.points[0].y).toBeCloseTo(-100);
    expect(rotated.properties.points[2].x).toBeCloseTo(100);
    expect(rotated.properties.points[2].y).toBeCloseTo(-200);
  });

  it('rotates a column footprint orientation', () => {
    const col = createColumn('k1', P, { x: 100, y: 0 });
    const rotated = rotateElement(col, { x: 0, y: 0 }, Math.PI / 2);
    expect(rotated.rotation).toBeCloseTo(Math.PI / 2);
    expect(rotated.x1).toBeCloseTo(0);
    expect(rotated.y1).toBeCloseTo(100);
  });
});

describe('mirrorElement', () => {
  it('mirrors a line across the vertical axis x=0', () => {
    const line = createLine('l1', P, { x: 100, y: 0 }, { x: 200, y: 100 });
    const mirrored = mirrorElement(line, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(mirrored.x1).toBeCloseTo(-100);
    expect(mirrored.y1).toBeCloseTo(0);
    expect(mirrored.x2).toBeCloseTo(-200);
    expect(mirrored.y2).toBeCloseTo(100);
  });

  it('mirrors a rectangle across a horizontal axis keeping it axis-aligned', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 50 });
    const mirrored = mirrorElement(rect, { x: 0, y: 100 }, { x: 100, y: 100 });
    expect(mirrored.y1).toBeCloseTo(150);
    expect(mirrored.y2).toBeCloseTo(200);
    expect(mirrored.x1).toBeCloseTo(0);
    expect(mirrored.rotation).toBeCloseTo(0);
  });

  it('mirrors a rectangle across a 45° axis producing a 90° rotation', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 50 });
    const mirrored = mirrorElement(rect, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(mirrored.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('flips arc direction on mirror', () => {
    const arc = createArc('a1', P, { x: 100, y: 0 }, { x: Math.SQRT1_2 * 100, y: Math.SQRT1_2 * 100 }, { x: 0, y: 100 })!;
    const mirrored = mirrorElement(arc, { x: 0, y: -100 }, { x: 0, y: 100 }) as ArcElement;
    expect(mirrored.properties.clockwise).toBe(!arc.properties.clockwise);
    expect(mirrored.properties.cx).toBeCloseTo(0);
  });

  it('returns the element unchanged for a degenerate axis', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(mirrorElement(line, { x: 5, y: 5 }, { x: 5, y: 5 })).toBe(line);
  });
});

describe('scaleElement', () => {
  it('doubles a line about the origin', () => {
    const line = createLine('l1', P, { x: 100, y: 0 }, { x: 200, y: 100 });
    const scaled = scaleElement(line, { x: 0, y: 0 }, 2);
    expect(scaled.x1).toBeCloseTo(200);
    expect(scaled.x2).toBeCloseTo(400);
    expect(scaled.length).toBeCloseTo(2 * distance({ x: 100, y: 0 }, { x: 200, y: 100 }));
  });

  it('scales a circle radius about an external base point', () => {
    const circle = createCircle('c1', P, { x: 100, y: 100 }, 50);
    const scaled = scaleElement(circle, { x: 0, y: 0 }, 0.5) as CircleElement;
    expect(scaled.x1).toBeCloseTo(50);
    expect(scaled.properties.radius).toBeCloseTo(25);
  });

  it('scales a rect about a base point keeping rotation', () => {
    const rect = createRectangle('r1', P, { x: 100, y: 100 }, { x: 200, y: 200 });
    const rotated = rotateElement(rect, { x: 150, y: 150 }, Math.PI / 4);
    const scaled = scaleElement(rotated, { x: 0, y: 0 }, 2);
    expect(scaled.rotation).toBeCloseTo(Math.PI / 4);
    expect(Math.abs(scaled.x2 - scaled.x1)).toBeCloseTo(200);
  });

  it('scales a column footprint', () => {
    const col = createColumn('k1', P, { x: 100, y: 100 });
    const scaled = scaleElement(col, { x: 0, y: 0 }, 2) as ColumnElement;
    expect(scaled.properties.width).toBeCloseTo(col.properties.width * 2);
    expect(scaled.x1).toBeCloseTo(200);
  });

  it('ignores non-positive factors', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(scaleElement(line, { x: 0, y: 0 }, 0)).toBe(line);
  });
});

describe('arrays', () => {
  it('rect array clones fill the grid minus the origin slot', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 50, y: 50 });
    const copies = rectArrayCopies(rect, 2, 3, 100, 80);
    expect(copies).toHaveLength(5);
    // Cells (row,col): (0,1) (0,2) (1,0) (1,1) (1,2) → x1 = col*dx.
    const xs = copies.map((c) => c.x1).sort((a, b) => a - b);
    expect(xs).toEqual([0, 100, 100, 200, 200]);
    const ys = copies.map((c) => c.y1).sort((a, b) => a - b);
    expect(ys).toEqual([0, 0, 80, 80, 80]);
    expect(copies.every((c) => c.id !== rect.id)).toBe(true);
  });

  it('polar array on a full circle spaces copies evenly', () => {
    const line = createLine('l1', P, { x: 100, y: 0 }, { x: 150, y: 0 });
    const copies = polarArrayCopies(line, { x: 0, y: 0 }, 4, Math.PI * 2);
    expect(copies).toHaveLength(3);
    // Copies land at 90°, 180°, 270°.
    const angles = copies.map((c) => Math.round(Math.atan2(c.y1, c.x1) * 180 / Math.PI));
    expect(angles).toEqual([90, 180, -90]);
  });

  it('polar array on a partial fill keeps both ends occupied', () => {
    const line = createLine('l1', P, { x: 100, y: 0 }, { x: 150, y: 0 });
    const copies = polarArrayCopies(line, { x: 0, y: 0 }, 3, Math.PI / 2);
    expect(copies).toHaveLength(2);
    expect(copies[1].x1).toBeCloseTo(0);
    expect(copies[1].y1).toBeCloseTo(100);
  });
});

describe('offsetElement', () => {
  it('offsets a line to the clicked side', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const above = offsetElement(line, { x: 50, y: -30 })!;
    expect(above.y1).toBeCloseTo(-30);
    expect(above.y2).toBeCloseTo(-30);
    const below = offsetElement(line, { x: 50, y: 30 })!;
    expect(below.y1).toBeCloseTo(30);
  });

  it('honours an explicit typed distance', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const copy = offsetElement(line, { x: 50, y: -5 }, 120)!;
    expect(copy.y1).toBeCloseTo(-120);
  });

  it('grows a circle when clicking outside, shrinks inside', () => {
    const circle = createCircle('c1', P, { x: 0, y: 0 }, 100);
    const bigger = offsetElement(circle, { x: 150, y: 0 }) as CircleElement;
    expect(bigger.properties.radius).toBeCloseTo(150);
    const smaller = offsetElement(circle, { x: 60, y: 0 }) as CircleElement;
    expect(smaller.properties.radius).toBeCloseTo(60);
  });

  it('grows a rectangle outward when the click is outside', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 50 });
    const grown = offsetElement(rect, { x: 130, y: 25 }) as RectangleElement;
    expect(grown.x1).toBeCloseTo(-30);
    expect(grown.x2).toBeCloseTo(130);
    expect(grown.y1).toBeCloseTo(-30);
    expect(grown.y2).toBeCloseTo(80);
  });

  it('offsets an open polyline as a parallel chain', () => {
    const poly = createPolyline('pl1', P, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const copy = offsetElement(poly, { x: 50, y: -20 }, 20) as PolylineElement;
    const pts = copy.properties.points;
    expect(pts).toHaveLength(3);
    expect(pts[0].y).toBeCloseTo(-20);
    // The chain turns right (clockwise), so the consistent left-normal offset
    // lands on the outer side: the miter corner grows to (120,-20).
    expect(pts[1].x).toBeCloseTo(120);
    expect(pts[1].y).toBeCloseTo(-20);
    expect(pts[2].x).toBeCloseTo(120);
    expect(pts[2].y).toBeCloseTo(100);
  });

  it('offsets a closed square polyline into a concentric bigger square', () => {
    const square = createPolyline('pl1', P, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], true);
    const grown = offsetElement(square, { x: 150, y: 50 }, 10) as PolylineElement;
    const pts = grown.properties.points;
    expect(pts).toHaveLength(5);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(-10);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(110);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(-10);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(110);
  });

  it('offsets an arc keeping center and angles', () => {
    const arc = createArc('a1', P, { x: 100, y: 0 }, { x: Math.SQRT1_2 * 100, y: Math.SQRT1_2 * 100 }, { x: 0, y: 100 })!;
    const copy = offsetElement(arc, { x: 150 * Math.SQRT1_2, y: 150 * Math.SQRT1_2 }, 50) as ArcElement;
    expect(copy.properties.radius).toBeCloseTo(150);
    expect(copy.properties.cx).toBeCloseTo(0);
    expect(copy.x1).toBeCloseTo(150);
  });

  it('refuses to offset unoffsettable types', () => {
    const col = createColumn('k1', P, { x: 0, y: 0 });
    expect(offsetElement(col, { x: 50, y: 0 })).toBeNull();
  });
});

describe('offsetChain', () => {
  it('keeps open chain endpoints at the offset distance', () => {
    const out = offsetChain([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, false)!;
    expect(out[0]).toEqual({ x: 0, y: 10 });
    expect(out[1]).toEqual({ x: 100, y: 10 });
  });
});

describe('trim / extend', () => {
  const horizontal = createLine('h1', P, { x: 0, y: 0 }, { x: 300, y: 0 });
  const vertical = createLine('v1', P, { x: 200, y: -50 }, { x: 200, y: 50 });

  it('trims the clicked end at the cutting edge', () => {
    const trimmed = trimLineEnd(horizontal, vertical, { x: 290, y: 0 })!;
    expect(trimmed.x2).toBeCloseTo(200);
    expect(trimmed.x1).toBe(0);
    const trimmedStart = trimLineEnd(horizontal, vertical, { x: 10, y: 0 })!;
    expect(trimmedStart.x1).toBeCloseTo(200);
    expect(trimmedStart.x2).toBe(300);
  });

  it('returns null when the lines do not cross', () => {
    const far = createLine('f1', P, { x: 500, y: -50 }, { x: 500, y: 50 });
    expect(trimLineEnd(horizontal, far, { x: 290, y: 0 })).toBeNull();
  });

  it('extends the clicked end onto the boundary', () => {
    const stub = createLine('s1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const boundary = createLine('b1', P, { x: 200, y: -50 }, { x: 200, y: 50 });
    const extended = extendLineTo(stub, boundary, { x: 95, y: 0 })!;
    expect(extended.x2).toBeCloseTo(200);
    expect(extended.x1).toBe(0);
  });

  it('extends backwards when the start is picked', () => {
    const stub = createLine('s1', P, { x: 100, y: 0 }, { x: 200, y: 0 });
    const boundary = createLine('b1', P, { x: 50, y: -50 }, { x: 50, y: 50 });
    const extended = extendLineTo(stub, boundary, { x: 105, y: 0 })!;
    expect(extended.x1).toBeCloseTo(50);
    expect(extended.x2).toBe(200);
  });

  it('returns null when the intersection is not ahead of the picked end', () => {
    // Boundary sits behind the picked end: extending would shrink the line.
    const boundary = createLine('b1', P, { x: 50, y: -50 }, { x: 50, y: 50 });
    expect(extendLineTo(horizontal, boundary, { x: 290, y: 0 })).toBeNull();
  });

  it('refuses non-line targets', () => {
    const circle = createCircle('c1', P, { x: 0, y: 0 }, 50);
    expect(trimLineEnd(circle, vertical, { x: 0, y: 0 })).toBeNull();
    expect(extendLineTo(circle, vertical, { x: 0, y: 0 })).toBeNull();
  });
});

describe('filletLines', () => {
  const hLine = createLine('h1', P, { x: 0, y: 0 }, { x: 300, y: 0 });
  const vLine = createLine('v1', P, { x: 300, y: -300 }, { x: 300, y: 0 });

  it('radius 0 joins both lines at the corner', () => {
    const h = createLine('h1', P, { x: 0, y: 0 }, { x: 200, y: 0 });
    const v = createLine('v1', P, { x: 300, y: -100 }, { x: 300, y: 100 });
    const result = filletLines(h, v, 0)!;
    expect(result.arc).toBeNull();
    expect(result.a.x2).toBeCloseTo(300);
    expect(result.b.y1).toBeCloseTo(0);
    expect(result.b.x1).toBeCloseTo(300);
  });

  it('produces a tangent arc and trims both lines', () => {
    const result = filletLines(hLine, vLine, 50, 'arc-1')!;
    expect(result.arc).not.toBeNull();
    const arc = result.arc!;
    expect(arc.properties.radius).toBeCloseTo(50);
    // Horizontal keeps its left end; right end lands on the tangent point.
    expect(result.a.x2).toBeCloseTo(250);
    expect(result.a.x1).toBe(0);
    // Vertical keeps its far start (-300); the end at the corner lands on
    // the tangent point (300,-50).
    expect(result.b.y1).toBeCloseTo(-300);
    expect(result.b.y2).toBeCloseTo(-50);
    // The arc is tangent: chord endpoints are the tangent points.
    expect(distance({ x: arc.x1, y: arc.y1 }, { x: 250, y: 0 })).toBeCloseTo(0, 4);
    expect(distance({ x: arc.x2, y: arc.y2 }, { x: 300, y: -50 })).toBeCloseTo(0, 4);
  });

  it('extends short lines to reach the tangent points', () => {
    const short = createLine('s1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const wall = createLine('w1', P, { x: 300, y: -300 }, { x: 300, y: 0 });
    const result = filletLines(short, wall, 50)!;
    expect(result.a.x2).toBeCloseTo(250); // extended, not trimmed
  });

  it('returns null for parallel lines', () => {
    const other = createLine('p2', P, { x: 0, y: 50 }, { x: 300, y: 50 });
    expect(filletLines(hLine, other, 20)).toBeNull();
  });
});

describe('gripsFor / applyGrip', () => {
  it('a line exposes start, end and midpoint grips', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const kinds = gripsFor(line).map((g) => g.kind);
    expect(kinds).toEqual(['start', 'end', 'mid']);
  });

  it('dragging the midpoint moves the whole line', () => {
    const line = createLine('l1', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const mid = gripsFor(line).find((g) => g.kind === 'mid')!;
    const moved = applyGrip(line, mid, { x: 150, y: 80 });
    expect(moved.x1).toBeCloseTo(100);
    expect(moved.y1).toBeCloseTo(80);
    expect(moved.x2).toBeCloseTo(200);
    expect(moved.y2).toBeCloseTo(80);
  });

  it('a polyline exposes a grip per vertex and drags just that vertex', () => {
    const poly = createPolyline('pl1', P, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const grips = gripsFor(poly);
    expect(grips).toHaveLength(3);
    const moved = applyGrip(poly, grips[1], { x: 150, y: -20 }) as PolylineElement;
    expect(moved.properties.points[1]).toEqual({ x: 150, y: -20 });
    expect(moved.properties.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('a circle exposes center + radius grips; radius grip resizes', () => {
    const circle = createCircle('c1', P, { x: 100, y: 100 }, 50);
    const radiusGrip = gripsFor(circle).find((g) => g.kind === 'radius')!;
    const resized = applyGrip(circle, radiusGrip, { x: 180, y: 100 }) as CircleElement;
    expect(resized.properties.radius).toBeCloseTo(80);
    const centerGrip = gripsFor(circle).find((g) => g.kind === 'center')!;
    const moved = applyGrip(circle, centerGrip, { x: 200, y: 50 });
    expect(moved.x1).toBeCloseTo(200);
    expect(moved.y1).toBeCloseTo(50);
  });

  it('rect corner grips resize anchoring the opposite corner', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 50 });
    const corner = gripsFor(rect).find((g) => g.key === 'corner:2')!;
    const resized = applyGrip(rect, corner, { x: 160, y: 90 });
    expect(resized.x2).toBeCloseTo(160);
    expect(resized.y2).toBeCloseTo(90);
    expect(resized.x1).toBe(0);
    expect(resized.y1).toBe(0);
  });

  it('rect center grip moves the footprint keeping rotation', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 50 });
    const rotated = rotateElement(rect, { x: 50, y: 25 }, Math.PI / 4);
    const centerGrip = gripsFor(rotated).find((g) => g.kind === 'center')!;
    const moved = applyGrip(rotated, centerGrip, { x: 150, y: 125 });
    expect(moved.rotation).toBeCloseTo(Math.PI / 4);
    expect((moved.x1 + moved.x2) / 2).toBeCloseTo(150);
    expect((moved.y1 + moved.y2) / 2).toBeCloseTo(125);
  });

  it('arc mid grip re-fits the circle', () => {
    const arc = createArc('a1', P, { x: 100, y: 0 }, { x: Math.SQRT1_2 * 100, y: Math.SQRT1_2 * 100 }, { x: 0, y: 100 })!;
    const midGrip = gripsFor(arc).find((g) => g.key === 'arcMid')!;
    // Pull the through-point up to a bigger radius.
    const moved = applyGrip(arc, midGrip, { x: 0, y: 200 }) as ArcElement;
    expect(moved.properties.mid).toEqual({ x: 0, y: 200 });
    // Circle through (100,0), (0,200), (0,100): center (150,150), r≈158.11.
    expect(moved.properties.cx).toBeCloseTo(150);
    expect(moved.properties.cy).toBeCloseTo(150);
    expect(moved.properties.radius).toBeCloseTo(Math.sqrt(25000), 2);
  });
});

describe('elementInBox (window vs crossing)', () => {
  const line = createLine('l1', P, { x: 0, y: 0 }, { x: 300, y: 0 });
  const box = { minX: 50, minY: -50, maxX: 200, maxY: 50 };

  it('window requires the whole entity inside', () => {
    expect(elementInBox(line, box, 'window')).toBe(false);
    const inside = { minX: -10, minY: -50, maxX: 400, maxY: 50 };
    expect(elementInBox(line, inside, 'window')).toBe(true);
  });

  it('crossing accepts entities that only touch the box', () => {
    expect(elementInBox(line, box, 'crossing')).toBe(true);
  });

  it('crossing catches a line passing through with no endpoints inside', () => {
    const through = createLine('t1', P, { x: -100, y: 0 }, { x: 400, y: 0 });
    expect(through.properties).toBeDefined();
    expect(elementInBox(through, { minX: 50, minY: -50, maxX: 200, maxY: 50 }, 'crossing')).toBe(true);
    expect(elementInBox(through, { minX: 50, minY: -50, maxX: 200, maxY: 50 }, 'window')).toBe(false);
  });

  it('a rotated rect reports rotated corners', () => {
    const rect = createRectangle('r1', P, { x: 0, y: 0 }, { x: 100, y: 100 });
    const rotated = rotateElement(rect, { x: 50, y: 50 }, Math.PI / 4);
    // The rotated diamond exceeds the flat bbox vertically.
    const tall = { minX: -20, minY: -20, maxX: 120, maxY: 120 };
    expect(elementInBox(rotated, tall, 'window')).toBe(false);
    const huge = { minX: -100, minY: -100, maxX: 200, maxY: 200 };
    expect(elementInBox(rotated, huge, 'window')).toBe(true);
  });
});

describe('pickElementAt', () => {
  it('picks the nearest element within tolerance', () => {
    const near = createLine('near', P, { x: 0, y: 0 }, { x: 100, y: 0 });
    const far = createLine('far', P, { x: 0, y: 100 }, { x: 100, y: 100 });
    const hit = pickElementAt({ x: 50, y: 8 }, [near, far], 15)!;
    expect(hit.element.id).toBe('near');
    expect(pickElementAt({ x: 50, y: 40 }, [near, far], 15)).toBeNull();
  });

  it('picks circles on the circumference', () => {
    const circle = createCircle('c1', P, { x: 0, y: 0 }, 100);
    expect(pickElementAt({ x: 103, y: 0 }, [circle], 10)?.element.id).toBe('c1');
    expect(pickElementAt({ x: 50, y: 0 }, [circle], 10)).toBeNull(); // inside, far from rim
  });

  it('respects the eligibility filter (trim picks line elements only)', () => {
    const circle = createCircle('c1', P, { x: 0, y: 0 }, 50);
    const line = createLine('l1', P, { x: 0, y: 40 }, { x: 100, y: 40 });
    const linesOnly = (el: { element_type: string }) => el.element_type !== 'circle';
    const hit = pickElementAt({ x: 25, y: 42 }, [circle, line], 10, linesOnly)!;
    expect(hit.element.id).toBe('l1');
  });
});

describe('walls stay safe under edit ops', () => {
  it('translate keeps a wall T-join metadata intact', () => {
    const host = createWall('host', P, { x: 0, y: 0 }, { x: 400, y: 0 });
    const wall = createWall('w1', P, { x: 200, y: 100 }, { x: 200, y: 0 }, { join_target: 'end', join_host_id: 'host' });
    const moved = translateElement(wall, 50, 0);
    expect((moved.properties as { join_host_id?: string }).join_host_id).toBe('host');
    expect(moved.x2).toBe(250);
    expect(moved.y2).toBe(0);
    expect(host.element_type).toBe('wall');
  });
});
