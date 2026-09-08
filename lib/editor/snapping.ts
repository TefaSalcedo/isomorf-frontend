import type { ElementType, ProjectElement } from '@/types/project';
import {
  distance,
  midpoint,
  pointsEqual,
  lineIntersection,
  isClose,
  projectPointOnSegment,
  magnitude,
  sub,
  dot,
  DEFAULT_SNAP_PIXELS,
} from '@/lib/editor/geometry';

export const COLUMN_WALL_SNAP_PIXELS = 20;

export type SnapTarget =
  | { type: 'start'; elementId: string }
  | { type: 'end'; elementId: string }
  | { type: 'midpoint'; elementId: string }
  | { type: 'intersection'; elementIdA: string; elementIdB: string }
  | { type: 'wall'; elementId: string }
  | { type: 'center'; elementId: string }
  | { type: 'corner'; elementId: string; index: number };

export type SnapCandidate = {
  point: { x: number; y: number };
  target: SnapTarget;
};

export type SnapResult = SnapCandidate & { distance: number };

function isLineType(type: ElementType): boolean {
  return type === 'wall' || type === 'door' || type === 'window' || type === 'beam';
}

function anchorPointsFor(element: ProjectElement): SnapCandidate[] {
  const candidates: SnapCandidate[] = [
    { point: { x: element.x1, y: element.y1 }, target: { type: 'start', elementId: element.id } },
    { point: { x: element.x2, y: element.y2 }, target: { type: 'end', elementId: element.id } },
  ];
  if (isLineType(element.element_type) && !pointsEqual({ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 })) {
    candidates.push({
      point: midpoint({ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }),
      target: { type: 'midpoint', elementId: element.id },
    });
  }
  if (element.element_type === 'column') {
    const props = element.properties;
    const w = props.width ?? 20;
    const d = props.depth ?? 20;
    const center = { x: element.x1, y: element.y1 };
    candidates.push({ point: center, target: { type: 'center', elementId: element.id } });
    const half = { x: w / 2, y: d / 2 };
    const corners = [
      { x: center.x - half.x, y: center.y - half.y },
      { x: center.x + half.x, y: center.y - half.y },
      { x: center.x + half.x, y: center.y + half.y },
      { x: center.x - half.x, y: center.y + half.y },
    ];
    corners.forEach((p, index) => candidates.push({ point: p, target: { type: 'corner', elementId: element.id, index } }));
  }
  return candidates;
}

function allAnchorPoints(elements: ProjectElement[], excludeId?: string): SnapCandidate[] {
  return elements
    .filter((el) => el.id !== excludeId)
    .flatMap((el) => anchorPointsFor(el));
}

function findIntersections(elements: ProjectElement[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const a = elements[i];
    if (!isLineType(a.element_type)) continue;
    for (let j = i + 1; j < elements.length; j += 1) {
      const b = elements[j];
      if (!isLineType(b.element_type)) continue;
      const p = lineIntersection(
        { x: a.x1, y: a.y1 },
        { x: a.x2, y: a.y2 },
        { x: b.x1, y: b.y1 },
        { x: b.x2, y: b.y2 },
      );
      if (p) {
        result.push({
          point: p,
          target: { type: 'intersection', elementIdA: a.id, elementIdB: b.id },
        });
      }
    }
  }
  return result;
}

export function snapPixelsForZoom(zoom: number): number {
  return DEFAULT_SNAP_PIXELS + Math.min(2, Math.max(0, zoom - 1)) * 6;
}

export function snapCandidates(
  elements: ProjectElement[],
  excludeId?: string,
): SnapCandidate[] {
  return [...allAnchorPoints(elements, excludeId), ...findIntersections(elements)];
}

export function snapToNearest(
  cursor: { x: number; y: number },
  elements: ProjectElement[],
  zoom: number,
  worldPerPixel: number,
  excludeId?: string,
): SnapResult | null {
  const pixelTolerance = snapPixelsForZoom(zoom);
  const worldTolerance = (pixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  const candidates = snapCandidates(elements, excludeId);
  let best: SnapResult | null = null;
  for (const candidate of candidates) {
    const d = distance(cursor, candidate.point);
    if (d <= worldTolerance && (!best || d < best.distance)) {
      best = { ...candidate, distance: d };
    }
  }
  return best;
}

export function snapToSegmentMidpoint(
  cursor: { x: number; y: number },
  element: ProjectElement,
  worldPerPixel: number,
  zoom: number,
): { point: { x: number; y: number }; t: number } | null {
  const a = { x: element.x1, y: element.y1 };
  const b = { x: element.x2, y: element.y2 };
  const projected = projectPointOnSegment(cursor, a, b);
  const pixelTolerance = snapPixelsForZoom(zoom);
  const worldTolerance = (pixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  if (projected.distance <= worldTolerance && isClose(projected.t, 0.5, 0.08)) {
    return { point: midpoint(a, b), t: 0.5 };
  }
  return null;
}

function findWallIntersections(elements: ProjectElement[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  const walls = elements.filter((el) => el.element_type === 'wall');
  for (let i = 0; i < walls.length; i += 1) {
    const a = walls[i];
    for (let j = i + 1; j < walls.length; j += 1) {
      const b = walls[j];
      const p = lineIntersection(
        { x: a.x1, y: a.y1 },
        { x: a.x2, y: a.y2 },
        { x: b.x1, y: b.y1 },
        { x: b.x2, y: b.y2 },
      );
      if (p) {
        result.push({
          point: p,
          target: { type: 'intersection', elementIdA: a.id, elementIdB: b.id },
        });
      }
    }
  }
  return result;
}

function findWallProjections(
  cursor: { x: number; y: number },
  elements: ProjectElement[],
): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (const el of elements) {
    if (el.element_type !== 'wall') continue;
    const a = { x: el.x1, y: el.y1 };
    const b = { x: el.x2, y: el.y2 };
    const projected = projectPointOnSegment(cursor, a, b);
    if (projected.t >= -1e-9 && projected.t <= 1.00000001) {
      result.push({
        point: projected.point,
        target: { type: 'wall', elementId: el.id },
      });
    }
  }
  return result;
}

export function snapForColumn(
  cursor: { x: number; y: number },
  elements: ProjectElement[],
  zoom: number,
  worldPerPixel: number,
  excludeId?: string,
): SnapResult | null {
  const walls = excludeId ? elements.filter((el) => el.id !== excludeId) : elements;
  const wallIntersections = findWallIntersections(walls);
  const wallProjections = findWallProjections(cursor, walls);

  const intersectionPixelTolerance = COLUMN_WALL_SNAP_PIXELS;
  const intersectionWorldTolerance = (intersectionPixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  const projectionPixelTolerance = snapPixelsForZoom(zoom);
  const projectionWorldTolerance = (projectionPixelTolerance * worldPerPixel) / Math.max(0.1, zoom);

  let best: SnapResult | null = null;
  for (const candidate of wallIntersections) {
    const d = distance(cursor, candidate.point);
    if (d <= intersectionWorldTolerance && (!best || d < best.distance)) {
      best = { ...candidate, distance: d };
    }
  }
  if (best) return best;

  for (const candidate of wallProjections) {
    const d = distance(cursor, candidate.point);
    if (d <= projectionWorldTolerance && (!best || d < best.distance)) {
      best = { ...candidate, distance: d };
    }
  }
  return best;
}

export function isPointOnWall(
  point: { x: number; y: number },
  element: ProjectElement,
  tolerance: number,
): boolean {
  if (!isLineType(element.element_type)) return false;
  const a = { x: element.x1, y: element.y1 };
  const b = { x: element.x2, y: element.y2 };
  const ap = sub(point, a);
  const ab = sub(b, a);
  const abLen = magnitude(ab);
  if (abLen === 0) return distance(point, a) <= tolerance;
  const t = dot(ap, ab) / (abLen * abLen);
  if (t < 0 || t > 1) return false;
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return distance(point, closest) <= tolerance;
}
