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
