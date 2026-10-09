import type { HatchPattern } from '@/types/project';
import { rotate, toRadians, type Point } from '@/lib/editor/geometry';

export type HatchRect = { x: number; y: number; width: number; height: number };

/** Straight hatch segments clipped to a rectangle, in world coordinates.
 *  Lines run along ``angleDegrees`` spaced ``spacingCm`` apart; ``cross`` adds
 *  the perpendicular family and ``grid`` uses axis-aligned lines. */
export function hatchSegments(
  rect: HatchRect,
  pattern: HatchPattern,
  spacingCm: number,
  angleDegrees: number,
): number[] {
  const spacing = Math.max(1, spacingCm);
  const angles = pattern === 'cross'
    ? [angleDegrees, angleDegrees + 90]
    : pattern === 'grid'
      ? [0, 90]
      : [angleDegrees];

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const out: number[] = [];

  for (const deg of angles) {
    const theta = toRadians(deg);
    // Rotate the rect's corners by -theta so hatch lines become horizontal
    // rows; coverage of the rotated bbox guarantees full fill.
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ].map((p) => rotate({ x: p.x - cx, y: p.y - cy }, -theta));
    const minX = Math.min(...corners.map((p) => p.x));
    const maxX = Math.max(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y));
    const maxY = Math.max(...corners.map((p) => p.y));
    for (let ry = minY; ry <= maxY; ry += spacing) {
      const a = rotate({ x: minX, y: ry }, theta);
      const b = rotate({ x: maxX, y: ry }, theta);
      // Clip each row against the axis-aligned rect via Liang–Barsky.
      const clipped = clipSegment({ x: a.x + cx, y: a.y + cy }, { x: b.x + cx, y: b.y + cy }, rect);
      if (clipped) out.push(clipped[0].x, clipped[0].y, clipped[1].x, clipped[1].y);
    }
  }
  return out;
}

function clipSegment(p0: Point, p1: Point, rect: HatchRect): [Point, Point] | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, p0.x - rect.x],
    [dx, rect.x + rect.width - p0.x],
    [-dy, p0.y - rect.y],
    [dy, rect.y + rect.height - p0.y],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
  ];
}
