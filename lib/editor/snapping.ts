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
  | { type: 'corner'; elementId: string; index: number }
  | { type: 'column-edge'; elementId: string; index: number };

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
    const w = (props.width ?? 0.2) * 100;
    const d = (props.depth ?? 0.2) * 100;
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

function columnEdges(element: ProjectElement, cursor: { x: number; y: number }): { point: { x: number; y: number }; target: SnapTarget }[] {
  if (element.element_type !== 'column') return [];
  const props = element.properties;
  const halfWidth = (props.width ?? 0.2) * 100 / 2;
  const halfDepth = (props.depth ?? 0.2) * 100 / 2;
  const center = { x: element.x1, y: element.y1 };
  const minX = center.x - halfWidth;
  const maxX = center.x + halfWidth;
  const minY = center.y - halfDepth;
  const maxY = center.y + halfDepth;
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  const edges = [
    [{ x: minX, y: minY }, { x: maxX, y: minY }],
    [{ x: maxX, y: minY }, { x: maxX, y: maxY }],
    [{ x: maxX, y: maxY }, { x: minX, y: maxY }],
    [{ x: minX, y: maxY }, { x: minX, y: minY }],
  ];
  const edgeCandidates: SnapCandidate[] = edges.map(([a, b], index) => ({
    point: projectPointOnSegment(cursor, a, b).point,
    target: { type: 'column-edge', elementId: element.id, index },
  }));
  const cornerCandidates: SnapCandidate[] = corners.map((point, index) => ({
    point,
    target: { type: 'corner', elementId: element.id, index },
  }));
  return [...edgeCandidates, ...cornerCandidates];
}

function pointInsideColumn(point: { x: number; y: number }, element: ProjectElement): boolean {
  if (element.element_type !== 'column') return false;
  const props = element.properties;
  const halfWidth = (props.width ?? 0.2) * 100 / 2;
  const halfDepth = (props.depth ?? 0.2) * 100 / 2;
  return Math.abs(point.x - element.x1) < halfWidth && Math.abs(point.y - element.y1) < halfDepth;
}

export function findColumnContainingPoint(point: { x: number; y: number }, elements: ProjectElement[]): ProjectElement | null {
  return elements.find((element) => pointInsideColumn(point, element)) ?? null;
}

export function isPointInsideColumn(point: { x: number; y: number }, elements: ProjectElement[]): boolean {
  return findColumnContainingPoint(point, elements) !== null;
}

function segmentCrossesColumnInterior(start: { x: number; y: number }, end: { x: number; y: number }, column: ProjectElement): boolean {
  if (column.element_type !== 'column') return false;
  const props = column.properties;
  const halfWidth = (props.width ?? 0.2) * 100 / 2;
  const halfDepth = (props.depth ?? 0.2) * 100 / 2;
  const minX = column.x1 - halfWidth;
  const maxX = column.x1 + halfWidth;
  const minY = column.y1 - halfDepth;
  const maxY = column.y1 + halfDepth;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [[start.x, dx, minX, maxX], [start.y, dy, minY, maxY]] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin <= min || origin >= max) return false;
      continue;
    }
    const near = (min - origin) / delta;
    const far = (max - origin) / delta;
    const nextEnter = Math.min(near, far);
    const nextExit = Math.max(near, far);
    enter = Math.max(enter, nextEnter);
    exit = Math.min(exit, nextExit);
    if (enter >= exit) return false;
  }
  return enter < exit && exit - enter > 1e-6;
}

export function wallCrossesColumnInterior(start: { x: number; y: number }, end: { x: number; y: number }, elements: ProjectElement[]): boolean {
  return elements.some((element) => segmentCrossesColumnInterior(start, end, element));
}

export function snapWallStart(
  cursor: { x: number; y: number },
  reference: { x: number; y: number },
  elements: ProjectElement[],
): SnapResult | null {
  const column = findColumnContainingPoint(cursor, elements);
  if (!column || column.element_type !== 'column') return null;
  const halfWidth = (column.properties.width ?? 0.2) * 100 / 2;
  const halfDepth = (column.properties.depth ?? 0.2) * 100 / 2;
  const offset = { x: reference.x - cursor.x, y: reference.y - cursor.y };
  let point = { x: column.x1, y: column.y1 };
  let distanceToEdge = 0;
  if (Math.abs(offset.x) >= Math.abs(offset.y) && Math.abs(offset.x) > 1e-6) {
    point = { x: column.x1 + Math.sign(offset.x) * halfWidth, y: column.y1 };
    distanceToEdge = halfWidth;
  } else if (Math.abs(offset.y) > 1e-6) {
    point = { x: column.x1, y: column.y1 + Math.sign(offset.y) * halfDepth };
    distanceToEdge = halfDepth;
  } else {
    const nearest = columnEdges(column, cursor).find((candidate) => candidate.target.type === 'column-edge');
    if (!nearest) return null;
    point = nearest.point;
    distanceToEdge = distance(cursor, point);
  }
  return { point, target: { type: 'column-edge', elementId: column.id, index: 0 }, distance: distanceToEdge };
}

export function snapForWall(
  cursor: { x: number; y: number },
  elements: ProjectElement[],
  zoom: number,
  worldPerPixel: number,
  excludeId?: string,
): SnapResult | null {
  const available = elements.filter((element) => element.id !== excludeId);
  const candidates = [
    ...snapCandidates(available).filter((candidate) => candidate.target.type !== 'center').map((candidate) => ({ ...candidate, distance: distance(cursor, candidate.point) })),
    ...available.flatMap((element) => columnEdges(element, cursor).map((candidate) => ({ ...candidate, distance: distance(cursor, candidate.point) }))),
  ];
  const pixelTolerance = snapPixelsForZoom(zoom);
  const worldTolerance = (pixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  let best: SnapResult | null = null;
  for (const candidate of candidates) {
    const inside = available.some((element) => pointInsideColumn(cursor, element) && (candidate.target.type === 'column-edge' || candidate.target.type === 'corner') && candidate.target.elementId === element.id);
    if (candidate.distance <= worldTolerance || inside) {
      if (!best || candidate.distance < best.distance) best = candidate;
    }
  }
  return best;
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
