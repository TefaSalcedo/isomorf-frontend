import type { ElementType, PlanPoint, ProjectElement } from '@/types/project';
import {
  distance,
  midpoint,
  pointsEqual,
  lineIntersection,
  isClose,
  projectPointOnSegment,
  magnitude,
  rectCorners,
  sub,
  dot,
  ccwSweep,
  normalizeAngle,
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
  | { type: 'column-edge'; elementId: string; index: number }
  | { type: 'vertex'; elementId: string; index: number }
  | { type: 'quadrant'; elementId: string; index: number }
  | { type: 'nearest'; elementId: string }
  | { type: 'perpendicular'; elementId: string };

export type SnapCandidate = {
  point: { x: number; y: number };
  target: SnapTarget;
};

export type SnapResult = SnapCandidate & { distance: number };

function isLineType(type: ElementType): boolean {
  return type === 'wall' || type === 'door' || type === 'window' || type === 'beam'
    || type === 'joist' || type === 'grade_beam' || type === 'brace' || type === 'line';
}

function isRectType(type: ElementType): boolean {
  return type === 'slab' || type === 'footing' || type === 'stair' || type === 'ramp' || type === 'opening'
    || type === 'ellipse' || type === 'rectangle' || type === 'hatch';
}

function anchorPointsFor(element: ProjectElement): SnapCandidate[] {
  // For circles ``x1,y1`` is the center and ``x2,y2`` a point on the rim —
  // reporting them as start/end would shadow the richer center/quadrant
  // anchors below. Polylines list every vertex instead of two endpoints.
  const skipEndpoints = element.element_type === 'circle' || element.element_type === 'polyline';
  const candidates: SnapCandidate[] = skipEndpoints
    ? []
    : [
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
  if (element.element_type === 'pile') {
    candidates.push({ point: { x: element.x1, y: element.y1 }, target: { type: 'center', elementId: element.id } });
  }
  if (element.element_type === 'polyline') {
    const points = element.properties.points ?? [];
    points.forEach((point, index) => candidates.push({ point, target: { type: 'vertex', elementId: element.id, index } }));
  }
  if (element.element_type === 'circle') {
    const radius = element.properties.radius ?? Math.abs(element.x2 - element.x1);
    const center = { x: element.x1, y: element.y1 };
    candidates.push({ point: center, target: { type: 'center', elementId: element.id } });
    [
      { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y + radius },
      { x: center.x - radius, y: center.y },
      { x: center.x, y: center.y - radius },
    ].forEach((point, index) => candidates.push({ point, target: { type: 'quadrant', elementId: element.id, index } }));
  }
  if (element.element_type === 'arc') {
    candidates.push({ point: { x: element.properties.cx, y: element.properties.cy }, target: { type: 'center', elementId: element.id } });
    candidates.push({ point: element.properties.mid, target: { type: 'vertex', elementId: element.id, index: -1 } });
  }
  if (isRectType(element.element_type)) {
    // Rotation-aware corners: the bbox stays axis-aligned but the rendered
    // shape rotates around its center, so anchors must too.
    const corners = rectCorners(element);
    corners.forEach((p, index) => candidates.push({ point: p, target: { type: 'corner', elementId: element.id, index } }));
    candidates.push({ point: midpoint({ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }), target: { type: 'center', elementId: element.id } });
  }
  return candidates;
}

function allAnchorPoints(elements: ProjectElement[], excludeId?: string): SnapCandidate[] {
  return elements
    .filter((el) => el.id !== excludeId)
    .flatMap((el) => anchorPointsFor(el));
}

/** Straight segments owned by an element, used for intersections, nearest
 *  and perpendicular snaps. Curves (arc/circle) are handled point-wise. */
function linearSegments(element: ProjectElement): { a: PlanPoint; b: PlanPoint; elementId: string }[] {
  if (isLineType(element.element_type)) {
    return [{ a: { x: element.x1, y: element.y1 }, b: { x: element.x2, y: element.y2 }, elementId: element.id }];
  }
  if (element.element_type === 'polyline') {
    const points = element.properties.points ?? [];
    const segments: { a: PlanPoint; b: PlanPoint; elementId: string }[] = [];
    for (let i = 1; i < points.length; i += 1) {
      segments.push({ a: points[i - 1], b: points[i], elementId: element.id });
    }
    return segments;
  }
  return [];
}

function findIntersections(elements: ProjectElement[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  const segments = elements.flatMap((el) => linearSegments(el));
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i];
      const b = segments[j];
      if (a.elementId === b.elementId) continue;
      const p = lineIntersection(a.a, a.b, b.a, b.b);
      if (p) {
        result.push({
          point: p,
          target: { type: 'intersection', elementIdA: a.elementId, elementIdB: b.elementId },
        });
      }
    }
  }
  return result;
}

/** Closest point on each entity to the cursor: segment projections for linear
 *  geometry, radial projection for circles, and sweep-clamped projection for
 *  arcs. This is the AutoCAD "nearest" object snap. */
function nearestCandidates(cursor: PlanPoint, elements: ProjectElement[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (const el of elements) {
    for (const { a, b } of linearSegments(el)) {
      const projected = projectPointOnSegment(cursor, a, b);
      result.push({ point: projected.point, target: { type: 'nearest', elementId: el.id } });
    }
    if (el.element_type === 'circle') {
      const radius = el.properties.radius ?? Math.abs(el.x2 - el.x1);
      const center = { x: el.x1, y: el.y1 };
      const angle = Math.atan2(cursor.y - center.y, cursor.x - center.x);
      result.push({
        point: { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
        target: { type: 'nearest', elementId: el.id },
      });
    }
    if (el.element_type === 'arc') {
      const { cx, cy, radius, start_angle, end_angle, clockwise } = el.properties;
      const center = { x: cx, y: cy };
      const angle = Math.atan2(cursor.y - cy, cursor.x - cx);
      const onArc = clockwise
        ? ccwSweep(angle, start_angle) <= ccwSweep(end_angle, start_angle)
        : ccwSweep(start_angle, angle) <= ccwSweep(start_angle, end_angle);
      if (onArc) {
        result.push({
          point: { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius },
          target: { type: 'nearest', elementId: el.id },
        });
      }
    }
    if (isRectType(el.element_type)) {
      const corners = rectCorners(el);
      for (let i = 0; i < 4; i += 1) {
        const projected = projectPointOnSegment(cursor, corners[i], corners[(i + 1) % 4]);
        result.push({ point: projected.point, target: { type: 'nearest', elementId: el.id } });
      }
    }
  }
  return result;
}

/** Foot of the perpendicular from ``origin`` onto each linear segment — the
 *  AutoCAD perpendicular snap, only meaningful while a draft has an anchor. */
function perpendicularCandidates(origin: PlanPoint, elements: ProjectElement[]): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (const el of elements) {
    for (const { a, b } of linearSegments(el)) {
      const projected = projectPointOnSegment(origin, a, b);
      if (projected.t > 1e-9 && projected.t < 1 - 1e-9 && projected.distance > 1e-6) {
        result.push({ point: projected.point, target: { type: 'perpendicular', elementId: el.id } });
      }
    }
  }
  return result;
}

export function snapPixelsForZoom(zoom: number): number {
  return DEFAULT_SNAP_PIXELS + Math.min(2, Math.max(0, zoom - 1)) * 6;
}

/** AutoCAD-style snap priority: explicit object snaps (endpoints, centers,
 *  quadrants, vertices, intersections) always beat projected snaps
 *  (perpendicular, nearest) when both sit inside the aperture. */
export function snapPriority(target: SnapTarget): number {
  if (target.type === 'nearest') return 2;
  if (target.type === 'perpendicular') return 1;
  return 0;
}

export function snapCandidates(
  elements: ProjectElement[],
  excludeId?: string,
  cursor?: PlanPoint,
  fromPoint?: PlanPoint,
): SnapCandidate[] {
  const available = excludeId ? elements.filter((el) => el.id !== excludeId) : elements;
  const anchors = [...allAnchorPoints(available), ...findIntersections(available)];
  const perpendicular = fromPoint ? perpendicularCandidates(fromPoint, available) : [];
  const nearest = cursor ? nearestCandidates(cursor, available) : [];
  return [...anchors, ...perpendicular, ...nearest];
}

/** Lowest ``(priority, distance)`` pair wins, limited by the aperture. */
function pickSnap(candidates: SnapCandidate[], cursor: PlanPoint, worldTolerance: number): SnapResult | null {
  let best: SnapResult | null = null;
  for (const candidate of candidates) {
    const d = distance(cursor, candidate.point);
    if (d > worldTolerance) continue;
    const better = !best
      || snapPriority(candidate.target) < snapPriority(best.target)
      || (snapPriority(candidate.target) === snapPriority(best.target) && d < best.distance);
    if (better) best = { ...candidate, distance: d };
  }
  return best;
}

export function snapToNearest(
  cursor: { x: number; y: number },
  elements: ProjectElement[],
  zoom: number,
  worldPerPixel: number,
  excludeId?: string,
  fromPoint?: PlanPoint,
): SnapResult | null {
  const pixelTolerance = snapPixelsForZoom(zoom);
  const worldTolerance = (pixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  return pickSnap(snapCandidates(elements, excludeId, cursor, fromPoint), cursor, worldTolerance);
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
  fromPoint?: PlanPoint,
): SnapResult | null {
  const available = elements.filter((element) => element.id !== excludeId);
  const candidates = [
    ...snapCandidates(available, undefined, cursor, fromPoint).filter((candidate) => candidate.target.type !== 'center').map((candidate) => ({ ...candidate, distance: distance(cursor, candidate.point) })),
    ...available.flatMap((element) => columnEdges(element, cursor).map((candidate) => ({ ...candidate, distance: distance(cursor, candidate.point) }))),
  ];
  const pixelTolerance = snapPixelsForZoom(zoom);
  const worldTolerance = (pixelTolerance * worldPerPixel) / Math.max(0.1, zoom);
  let best: SnapResult | null = null;
  let bestTier = Infinity;
  for (const candidate of candidates) {
    const inside = available.some((element) => pointInsideColumn(cursor, element) && (candidate.target.type === 'column-edge' || candidate.target.type === 'corner') && candidate.target.elementId === element.id);
    if (candidate.distance > worldTolerance && !inside) continue;
    const tier = inside ? 0 : snapPriority(candidate.target);
    if (tier < bestTier || (tier === bestTier && candidate.distance < (best?.distance ?? Infinity))) {
      best = candidate;
      bestTier = tier;
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
