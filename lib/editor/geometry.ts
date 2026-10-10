export type Point = { x: number; y: number };

export const CM_PER_M = 100;
export const DEFAULT_SNAP_PIXELS = 12;

export function metersToCm(value: number): number {
  return value * CM_PER_M;
}

export function cmToMeters(value: number): number {
  return value / CM_PER_M;
}

export function isClose(a: number, b: number, epsilon = 1e-4): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function pointsEqual(a: Point, b: Point, epsilon = 1e-4): boolean {
  return isClose(a.x, b.x, epsilon) && isClose(a.y, b.y, epsilon);
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, factor: number): Point {
  return { x: a.x * factor, y: a.y * factor };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function magnitude(a: Point): number {
  return Math.hypot(a.x, a.y);
}

export function unit(a: Point): Point {
  const m = magnitude(a);
  if (m === 0) return { x: 0, y: 0 };
  return scale(a, 1 / m);
}

export function normal(a: Point): Point {
  return { x: -a.y, y: a.x };
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function direction(start: Point, end: Point): Point {
  return unit(sub(end, start));
}

export function angleOf(a: Point): number {
  return Math.atan2(a.y, a.x);
}

export function angleFrom(start: Point, end: Point): number {
  return angleOf(sub(end, start));
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function rotate(a: Point, radians: number): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: a.x * cos - a.y * sin, y: a.x * sin + a.y * cos };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type Projection = { point: Point; t: number; distance: number };

export function projectPointOnSegment(p: Point, a: Point, b: Point): Projection {
  const ab = sub(b, a);
  const abLenSq = dot(ab, ab);
  if (abLenSq === 0) {
    return { point: { ...a }, t: 0, distance: distance(p, a) };
  }
  const t = clamp(dot(sub(p, a), ab) / abLenSq, 0, 1);
  const projected = add(a, scale(ab, t));
  return { point: projected, t, distance: distance(p, projected) };
}

export function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const a = sub(a2, a1);
  const b = sub(b2, b1);
  const denom = cross(a, b);
  if (isClose(denom, 0)) return null;
  const c = sub(b1, a1);
  const t = cross(c, b) / denom;
  const u = cross(c, a) / denom;
  if (t < -1e-9 || t > 1.00000001 || u < -1e-9 || u > 1.00000001) return null;
  return add(a1, scale(a, t));
}

export function pointOnSegment(p: Point, a: Point, b: Point, epsilon = 1e-4): boolean {
  const ap = distance(a, p);
  const pb = distance(p, b);
  const ab = distance(a, b);
  return isClose(ap + pb, ab, epsilon);
}

export const POLAR_INCREMENT = Math.PI / 4;
export const POLAR_TOLERANCE = Math.PI / 45;

export function polarSnapPoint(start: Point, point: Point, increment = POLAR_INCREMENT, tolerance = POLAR_TOLERANCE): { point: Point; locked: boolean } {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { point, locked: false };
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / increment) * increment;
  if (Math.abs(angle - snapped) > tolerance) return { point, locked: false };
  return { point: { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len }, locked: true };
}

/** Circumscribed circle through three points. Returns null when the points
 *  are (nearly) collinear, i.e. there is no finite circle through them. */
export function circleThroughPoints(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-9) return null;
  const a1 = p1.x * p1.x + p1.y * p1.y;
  const a2 = p2.x * p2.x + p2.y * p2.y;
  const a3 = p3.x * p3.x + p3.y * p3.y;
  const center = {
    x: (a1 * (p2.y - p3.y) + a2 * (p3.y - p1.y) + a3 * (p1.y - p2.y)) / d,
    y: (a1 * (p3.x - p2.x) + a2 * (p1.x - p3.x) + a3 * (p2.x - p1.x)) / d,
  };
  return { center, radius: distance(center, p1) };
}

/** Normalize an angle to [0, 2π). */
export function normalizeAngle(radians: number): number {
  const tau = Math.PI * 2;
  return ((radians % tau) + tau) % tau;
}

/** Signed sweep from ``start`` to ``end`` going counterclockwise in standard
 *  math orientation (result in [0, 2π)). */
export function ccwSweep(start: number, end: number): number {
  return normalizeAngle(end - start);
}

/** Sample an arc into polyline vertices. ``clockwise`` follows the screen
 *  convention (y-axis down): it means the sweep travels in the *decreasing*
 *  angle direction. Chord endpoints are always included. */
export function sampleArcPoints(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
  maxSegments = 64,
): Point[] {
  const sweep = clockwise ? -ccwSweep(endAngle, startAngle) : ccwSweep(startAngle, endAngle);
  const segments = Math.max(4, Math.min(maxSegments, Math.ceil((Math.abs(sweep) / Math.PI) * 32)));
  const points: Point[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = startAngle + (sweep * i) / segments;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

export function resolveTJoin(
  anchor: Point,
  hostStart: Point,
  hostEnd: Point,
  reference: Point,
  joinAngle: number,
): Point {
  const hostDir = direction(hostStart, hostEnd);
  const offset = sub(reference, anchor);
  const candidates = [rotate(hostDir, toRadians(joinAngle)), rotate(hostDir, -toRadians(joinAngle))];
  const valid = candidates.filter((c) => dot(c, offset) >= -1e-9);
  const chosen = valid.length ? valid : candidates;
  let best = chosen[0];
  let bestDot = dot(best, offset);
  for (const c of chosen) {
    const d = dot(c, offset);
    if (d > bestDot) {
      bestDot = d;
      best = c;
    }
  }
  const length = distance(reference, anchor);
  return add(anchor, scale(best, length));
}

/** The four bbox corners of a rect-mode element, rotated by ``rotation``
 *  (radians) around the bbox center. Order in the unrotated frame:
 *  min-min, max-min, max-max, min-max. */
export function rectCorners(el: { x1: number; y1: number; x2: number; y2: number; rotation: number }): Point[] {
  const cx = (el.x1 + el.x2) / 2;
  const cy = (el.y1 + el.y2) / 2;
  const corners = [
    { x: el.x1, y: el.y1 },
    { x: el.x2, y: el.y1 },
    { x: el.x2, y: el.y2 },
    { x: el.x1, y: el.y2 },
  ];
  if (!el.rotation) return corners;
  const c = { x: cx, y: cy };
  return corners.map((p) => add(c, rotate(sub(p, c), el.rotation)));
}

export function rectangleFromCenter(
  center: Point,
  width: number,
  depth: number,
  rotation: number,
): Point[] {
  const half = { x: width / 2, y: depth / 2 };
  const corners: Point[] = [
    { x: -half.x, y: -half.y },
    { x: half.x, y: -half.y },
    { x: half.x, y: half.y },
    { x: -half.x, y: half.y },
  ];
  const r = toRadians(rotation);
  return corners.map((c) => add(center, rotate(c, r)));
}
