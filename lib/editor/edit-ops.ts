import type { ArcElement, ProjectElement } from '@/types/project';
import {
  add,
  angleFrom,
  ccwSweep,
  cross,
  distance,
  dot,
  isClose,
  lineIntersection,
  midpoint,
  normal,
  normalizeAngle,
  pointOnSegment,
  projectPointOnSegment,
  rectCorners,
  rotate,
  scale,
  sub,
  unit,
  type Point,
} from '@/lib/editor/geometry';
import { arcSpecFromPoints, createArc, drawModeOf } from '@/lib/editor/elements';

export { rectCorners };

/* ------------------------------------------------------------------ */
/* Edit operations (roadmap week 9).                                    */
/*                                                                     */
/* Pure geometric transforms over ``ProjectElement``: no React, no      */
/* Konva, no I/O — everything here is unit-testable math. The editor    */
/* reducer composes these primitives into interactive sessions; the     */
/* document PUT endpoint persists the result as a normal revision.      */
/*                                                                     */
/* Conventions:                                                        */
/* - World units are centimeters, y-axis down (canvas coordinates).     */
/* - ``line``-mode elements derive ``length``/``rotation`` from their   */
/*   endpoints, so transforms only rewrite x1..y2.                     */
/* - ``rect``-mode elements keep an axis-aligned bounding box in        */
/*   x1..x2 plus ``rotation`` around the box center (rendered rotated). */
/* - Beams mirror ``properties.length`` (meters) to the segment length. */
/* ------------------------------------------------------------------ */

export type EditOp =
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'mirror'
  | 'arrayRect'
  | 'arrayPolar'
  | 'offset'
  | 'trim'
  | 'extend'
  | 'fillet';

export const TRANSFORM_OPS: ReadonlySet<EditOp> = new Set([
  'move',
  'copy',
  'rotate',
  'scale',
  'mirror',
  'arrayRect',
  'arrayPolar',
]);

/** Ops that first ask for an element click instead of a base point. */
export const PICK_FIRST_OPS: ReadonlySet<EditOp> = new Set(['offset', 'fillet']);

/** Ops that ask for a cutting/boundary edge before accepting targets. */
export const CUTTER_OPS: ReadonlySet<EditOp> = new Set(['trim', 'extend']);

const MIN_LENGTH_CM = 0.1;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function segStart(el: ProjectElement): Point {
  return { x: el.x1, y: el.y1 };
}

function segEnd(el: ProjectElement): Point {
  return { x: el.x2, y: el.y2 };
}

function rectCenter(el: ProjectElement): Point {
  return midpoint(segStart(el), segEnd(el));
}

/** Session payload shared by the reducer commit path and the canvas
 *  preview — a plain-data mirror of the editor's ``EditSession``. */
export type EditRequest = {
  op: EditOp;
  phase: 'pick' | 'base' | 'ref' | 'target' | 'apply';
  ids: string[];
  base: Point | null;
  ref: Point | null;
  cursor: Point | null;
  pickedId: string | null;
  /** Typed scalar in cm or unitless (offset gap, fillet radius, factor). */
  value: number | null;
  /** Typed rotation in radians. */
  angle: number | null;
  rows: number;
  cols: number;
  count: number;
  /** Polar fill in radians; null falls back to the cursor sweep. */
  fill: number | null;
};

export type EditOutcome = {
  /** Full elements to swap in (keyed by their existing id). */
  replaced: ProjectElement[];
  /** New elements to append (clones, fillet arcs). */
  added: ProjectElement[];
  /** Source ids being moved — the canvas dims them while the ghost floats. */
  movedIds: string[];
};

function outcomeOf(replaced: ProjectElement[], added: ProjectElement[], movedIds: string[] = []): EditOutcome {
  return { replaced, added, movedIds };
}

/** Evaluate a transform-style op against the session targets. Used both for
 *  the live ghost preview and the click/Enter commit, so both paths can
 *  never disagree about the math. */
export function applyTransform(req: EditRequest, elements: ProjectElement[]): EditOutcome | null {
  const targets = elements.filter((el) => req.ids.includes(el.id));
  if (!targets.length || !req.base) return null;
  const base = req.base;
  const cursor = req.cursor;
  switch (req.op) {
    case 'move':
    case 'copy': {
      if (!cursor) return null;
      const dx = cursor.x - base.x;
      const dy = cursor.y - base.y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
      if (req.op === 'move') {
        return outcomeOf(targets.map((el) => translateElement(el, dx, dy)), [], req.ids);
      }
      return outcomeOf([], targets.map((el) => translateElement(cloneElement(el), dx, dy)));
    }
    case 'rotate': {
      const angle = req.angle ?? (cursor ? Math.atan2(cursor.y - base.y, cursor.x - base.x) : 0);
      if (!angle) return null;
      return outcomeOf(targets.map((el) => rotateElement(el, base, angle)), [], req.ids);
    }
    case 'scale': {
      const factor = req.value ?? (cursor && req.ref ? distance(base, cursor) / Math.max(1e-9, distance(base, req.ref)) : null);
      if (!factor || !(factor > 0) || !Number.isFinite(factor)) return null;
      return outcomeOf(targets.map((el) => scaleElement(el, base, factor)), [], req.ids);
    }
    case 'mirror': {
      if (!cursor || distance(base, cursor) < 1e-6) return null;
      return outcomeOf(targets.map((el) => mirrorElement(el, base, cursor)), [], req.ids);
    }
    case 'arrayRect': {
      if (!cursor) return null;
      const rows = Math.max(1, Math.floor(req.rows));
      const cols = Math.max(1, Math.floor(req.cols));
      if (rows * cols <= 1) return null;
      const dx = cursor.x - base.x;
      const dy = cursor.y - base.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
      return outcomeOf([], targets.flatMap((el) => rectArrayCopies(el, rows, cols, dx, dy)));
    }
    case 'arrayPolar': {
      const count = Math.max(2, Math.floor(req.count));
      // Cursor-driven fill: the sweep from +x (at the center) to the cursor.
      // Typed ``fill`` overrides; default is a full ring.
      const fill = req.fill ?? (cursor ? normalizeAngle(Math.atan2(cursor.y - base.y, cursor.x - base.x)) : Math.PI * 2);
      if (!fill) return null;
      return outcomeOf([], targets.flatMap((el) => polarArrayCopies(el, base, count, fill)));
    }
    default:
      return null;
  }
}

/** Pick the trim result whose cut point sits closest to the pick — the
 *  AutoCAD behaviour when several cutting edges cross the same target. */
export function bestTrim(target: ProjectElement, cutters: ProjectElement[], pick: Point): ProjectElement | null {
  let best: ProjectElement | null = null;
  let bestDistance = Infinity;
  for (const cutter of cutters) {
    const result = trimLineEnd(target, cutter, pick);
    if (!result) continue;
    const cut = (result.x1 !== target.x1 || result.y1 !== target.y1)
      ? { x: result.x1, y: result.y1 }
      : { x: result.x2, y: result.y2 };
    const d = distance(pick, cut);
    if (d < bestDistance) {
      best = result;
      bestDistance = d;
    }
  }
  return best;
}

/** Same nearest-cut selection for extend: choose the boundary whose grown
 *  endpoint lands closest to where the user clicked. */
export function bestExtend(target: ProjectElement, boundaries: ProjectElement[], pick: Point): ProjectElement | null {
  let best: ProjectElement | null = null;
  let bestDistance = Infinity;
  for (const boundary of boundaries) {
    const result = extendLineTo(target, boundary, pick);
    if (!result) continue;
    const grown = (result.x1 !== target.x1 || result.y1 !== target.y1)
      ? { x: result.x1, y: result.y1 }
      : { x: result.x2, y: result.y2 };
    const d = distance(pick, grown);
    if (d < bestDistance) {
      best = result;
      bestDistance = d;
    }
  }
  return best;
}

/** Ghost elements for the current session — the canvas draws these dashed
 *  instead of committing anything. ``hoverId`` lets trim/extend/fillet
 *  preview the element under the cursor. */
export function previewEditOutcome(req: EditRequest, elements: ProjectElement[], hoverId: string | null): EditOutcome | null {
  if (TRANSFORM_OPS.has(req.op)) {
    return req.base ? applyTransform(req, elements) : null;
  }
  if (req.op === 'offset') {
    if (!req.pickedId || !req.cursor) return null;
    const source = elements.find((el) => el.id === req.pickedId);
    if (!source) return null;
    const copy = offsetElement(source, req.cursor, req.value ?? undefined);
    return copy ? outcomeOf([], [copy]) : null;
  }
  if ((req.op === 'trim' || req.op === 'extend') && req.phase === 'apply' && hoverId && req.cursor) {
    if (req.ids.includes(hoverId)) return null;
    const target = elements.find((el) => el.id === hoverId);
    if (!target) return null;
    const cutters = elements.filter((el) => req.ids.includes(el.id));
    const result = req.op === 'trim' ? bestTrim(target, cutters, req.cursor) : bestExtend(target, cutters, req.cursor);
    return result ? outcomeOf([result], [], [hoverId]) : null;
  }
  if (req.op === 'fillet' && req.phase === 'target' && req.pickedId && hoverId && hoverId !== req.pickedId) {
    const a = elements.find((el) => el.id === req.pickedId);
    const b = elements.find((el) => el.id === hoverId);
    if (!a || !b) return null;
    const result = filletLines(a, b, req.value ?? 0);
    if (!result) return null;
    return outcomeOf([result.a, result.b], result.arc ? [result.arc] : [], [a.id, b.id]);
  }
  return null;
}

function rebuildRect(el: ProjectElement, center: Point, width: number, depth: number, rotation: number): ProjectElement {
  const w = Math.max(1, width);
  const h = Math.max(1, depth);
  return {
    ...el,
    x1: center.x - w / 2,
    y1: center.y - h / 2,
    x2: center.x + w / 2,
    y2: center.y + h / 2,
    length: w,
    rotation,
  };
}

function retime(el: ProjectElement): ProjectElement {
  return { ...el, updated_at: new Date().toISOString() };
}

export function cloneElement(el: ProjectElement, id?: string): ProjectElement {
  const now = new Date().toISOString();
  // ``properties`` is a discriminated union keyed on ``element_type``; the
  // identity spread keeps the pairing intact, so a cast is safe here.
  return { ...el, id: id ?? crypto.randomUUID(), created_at: now, updated_at: now, properties: { ...el.properties } } as ProjectElement;
}

/* ------------------------------------------------------------------ */
/* Point-map kernel: applies ``fn`` to every stored position            */
/* ------------------------------------------------------------------ */

/** Rewrite every positional field of ``el`` through ``fn`` and recompute
 *  the derived ``length``/``rotation`` for modes where they follow the
 *  endpoints. Rect/center/point modes keep their semantic invariants. */
function mapElementPoints(el: ProjectElement, fn: (p: Point) => Point): ProjectElement {
  const mode = drawModeOf(el.element_type);
  const next = { ...el, properties: { ...el.properties } } as ProjectElement;

  if (mode === 'point') {
    const c = fn({ x: el.x1, y: el.y1 });
    next.x1 = c.x;
    next.y1 = c.y;
    next.x2 = c.x + 1;
    next.y2 = c.y;
    return next;
  }
  if (mode === 'center') {
    const c = fn({ x: el.x1, y: el.y1 });
    const radius = (el.properties as { radius?: number }).radius ?? distance(segStart(el), segEnd(el));
    next.x1 = c.x;
    next.y1 = c.y;
    next.x2 = c.x + radius;
    next.y2 = c.y;
    next.rotation = 0;
    return next;
  }
  if (mode === 'poly') {
    const points = ((el.properties as { points?: Point[] }).points ?? []).map(fn);
    if (points.length >= 2) {
      next.x1 = points[0].x;
      next.y1 = points[0].y;
      next.x2 = points[points.length - 1].x;
      next.y2 = points[points.length - 1].y;
      next.length = points.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(points[i - 1], p)), 0);
    }
    next.properties = { ...next.properties, points } as typeof next.properties;
    return next;
  }
  if (mode === 'arc') {
    const props = (el as ArcElement).properties;
    const start = fn(segStart(el));
    const end = fn(segEnd(el));
    const mid = fn(props.mid);
    const center = fn({ x: props.cx, y: props.cy });
    next.x1 = start.x;
    next.y1 = start.y;
    next.x2 = end.x;
    next.y2 = end.y;
    next.properties = {
      ...props,
      cx: center.x,
      cy: center.y,
      mid,
      start_angle: normalizeAngle(Math.atan2(start.y - center.y, start.x - center.x)),
      end_angle: normalizeAngle(Math.atan2(end.y - center.y, end.x - center.x)),
    } as typeof next.properties;
    const nextProps = next.properties as ArcElement['properties'];
    const sweep = props.clockwise
      ? ccwSweep(nextProps.end_angle, nextProps.start_angle)
      : ccwSweep(nextProps.start_angle, nextProps.end_angle);
    next.length = Math.max(1, props.radius * sweep);
    next.rotation = 0;
    return next;
  }
  // 'line' and 'rect' both store two world corners; callers fix rotation for
  // rect elements when the op changes orientation.
  const start = fn(segStart(el));
  const end = fn(segEnd(el));
  next.x1 = start.x;
  next.y1 = start.y;
  next.x2 = end.x;
  next.y2 = end.y;
  next.length = Math.max(1, distance(start, end));
  if (mode === 'line') {
    next.rotation = Math.atan2(end.y - start.y, end.x - start.x);
    if (next.element_type === 'beam') {
      next.properties = { ...next.properties, length: next.length / 100 } as typeof next.properties;
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Transforms                                                          */
/* ------------------------------------------------------------------ */

export function translateElement(el: ProjectElement, dx: number, dy: number): ProjectElement {
  return retime(mapElementPoints(el, (p) => ({ x: p.x + dx, y: p.y + dy })));
}

export function rotateElement(el: ProjectElement, pivot: Point, angle: number): ProjectElement {
  const mode = drawModeOf(el.element_type);
  const next = mapElementPoints(el, (p) => add(pivot, rotate(sub(p, pivot), angle)));
  if (mode === 'rect') {
    // The bbox stays axis-aligned; the rotation lives in `rotation` and is
    // applied around the bbox center by the renderer.
    const center = add(pivot, rotate(sub(rectCenter(el), pivot), angle));
    const w = Math.abs(el.x2 - el.x1);
    const h = Math.abs(el.y2 - el.y1);
    return retime(rebuildRect({ ...next, rotation: normalizeAngle(el.rotation + angle) }, center, w, h, normalizeAngle(el.rotation + angle)));
  }
  if (mode === 'point' && el.element_type === 'column') {
    next.rotation = normalizeAngle(el.rotation + angle);
  }
  if (el.element_type === 'hatch') {
    const props = el.properties as { angle?: number };
    next.properties = { ...next.properties, angle: normalizeAngle(((props.angle ?? 0) * Math.PI) / 180 + angle) * (180 / Math.PI) } as typeof next.properties;
  }
  return retime(next);
}

export function mirrorElement(el: ProjectElement, a: Point, b: Point): ProjectElement {
  const axisDir = unit(sub(b, a));
  if (Math.abs(axisDir.x) < 1e-9 && Math.abs(axisDir.y) < 1e-9) return el;
  const axisAngle = Math.atan2(axisDir.y, axisDir.x);
  const reflect = (p: Point): Point => {
    const along = dot(sub(p, a), axisDir);
    const proj = add(a, scale(axisDir, along));
    return { x: 2 * proj.x - p.x, y: 2 * proj.y - p.y };
  };
  const mode = drawModeOf(el.element_type);
  const next = mapElementPoints(el, reflect);
  if (mode === 'arc') {
    const props = next.properties as ArcElement['properties'];
    next.properties = { ...props, clockwise: !props.clockwise } as typeof next.properties;
  }
  if (mode === 'rect' || (mode === 'point' && el.element_type === 'column')) {
    // A mirrored rectangle keeps its shape; its orientation maps to 2θ − α.
    const mirrored = normalizeAngle(2 * axisAngle - el.rotation);
    const center = reflect(rectCenter(el));
    const w = Math.abs(el.x2 - el.x1);
    const h = Math.abs(el.y2 - el.y1);
    if (mode === 'rect') {
      return retime(rebuildRect(next, center, w, h, mirrored));
    }
    next.rotation = mirrored;
  }
  if (el.element_type === 'hatch') {
    const props = el.properties as { angle?: number };
    const deg = props.angle ?? 0;
    next.properties = { ...next.properties, angle: 2 * (axisAngle * 180) / Math.PI - deg } as typeof next.properties;
  }
  return retime(next);
}

export function scaleElement(el: ProjectElement, base: Point, factor: number): ProjectElement {
  if (!(factor > 0) || !Number.isFinite(factor)) return el;
  const mode = drawModeOf(el.element_type);
  const grow = (p: Point): Point => add(base, scale(sub(p, base), factor));

  if (mode === 'rect') {
    const center = grow(rectCenter(el));
    const w = Math.abs(el.x2 - el.x1) * factor;
    const h = Math.abs(el.y2 - el.y1) * factor;
    return retime(rebuildRect(el, center, w, h, el.rotation));
  }
  if (mode === 'center') {
    const c = grow(segStart(el));
    const radius = Math.max(1, ((el.properties as { radius?: number }).radius ?? distance(segStart(el), segEnd(el))) * factor);
    return retime({
      ...el,
      x1: c.x,
      y1: c.y,
      x2: c.x + radius,
      y2: c.y,
      length: 2 * Math.PI * radius,
      rotation: 0,
      properties: { ...el.properties, radius },
    } as ProjectElement);
  }
  if (mode === 'point') {
    const c = grow(segStart(el));
    const next: ProjectElement = { ...el, x1: c.x, y1: c.y, x2: c.x + 1, y2: c.y };
    if (el.element_type === 'column') {
      const props = el.properties as { width?: number; depth?: number; diameter?: number };
      next.properties = {
        ...el.properties,
        width: (props.width ?? 0) * factor,
        depth: (props.depth ?? 0) * factor,
        diameter: props.diameter !== undefined ? props.diameter * factor : undefined,
      } as typeof next.properties;
    }
    if (el.element_type === 'pile') {
      const props = el.properties as { diameter?: number };
      next.properties = { ...el.properties, diameter: (props.diameter ?? 0) * factor } as typeof next.properties;
    }
    return retime(next);
  }
  if (mode === 'arc') {
    const next = mapElementPoints(el, grow);
    const props = (next as ArcElement).properties;
    const radius = Math.max(1, props.radius * factor);
    next.properties = { ...props, radius } as typeof next.properties;
    const sweep = props.clockwise ? ccwSweep(props.end_angle, props.start_angle) : ccwSweep(props.start_angle, props.end_angle);
    next.length = Math.max(1, radius * sweep);
    return retime(next);
  }
  return retime(mapElementPoints(el, grow));
}

/* ------------------------------------------------------------------ */
/* Arrays (produce clones; the source element stays put)                */
/* ------------------------------------------------------------------ */

/** ``rows`` × ``cols`` grid of clones spaced ``dx``/``dy`` per cell —
 *  the (0,0) slot is skipped because the original element already sits
 *  there (same convention as AutoCAD ARRAY). */
export function rectArrayCopies(el: ProjectElement, rows: number, cols: number, dx: number, dy: number): ProjectElement[] {
  const copies: ProjectElement[] = [];
  for (let r = 0; r < Math.max(1, Math.floor(rows)); r += 1) {
    for (let c = 0; c < Math.max(1, Math.floor(cols)); c += 1) {
      if (r === 0 && c === 0) continue;
      copies.push(translateElement(cloneElement(el), c * dx, r * dy));
    }
  }
  return copies;
}

/** ``count`` total positions sweeping ``fillAngle`` around ``center``.
 *  A full 360° fill divides the circle in ``count`` equal steps; any
 *  smaller angle keeps both endpoints occupied (step = fill/(count-1)). */
export function polarArrayCopies(el: ProjectElement, center: Point, count: number, fillAngle: number): ProjectElement[] {
  const total = Math.max(2, Math.floor(count));
  const sweep = fillAngle;
  const step = isClose(Math.abs(sweep), Math.PI * 2, 1e-3) ? sweep / total : sweep / (total - 1);
  const copies: ProjectElement[] = [];
  for (let i = 1; i < total; i += 1) {
    copies.push(rotateElement(cloneElement(el), center, step * i));
  }
  return copies;
}

/* ------------------------------------------------------------------ */
/* Offset                                                              */
/* ------------------------------------------------------------------ */

function unitNormal(a: Point, b: Point): Point {
  return normal(unit(sub(b, a)));
}

/** Signed distance of ``p`` to the left of the directed segment a→b. */
export function signedSide(a: Point, b: Point, p: Point): number {
  const dir = sub(b, a);
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-9) return 0;
  return cross(dir, sub(p, a)) / len;
}

/** Offset a vertex chain by ``d`` along each segment's left normal, with
 *  miter joins at interior vertices. Open chains keep their shifted ends. */
export function offsetChain(points: Point[], d: number, closed: boolean): Point[] | null {
  if (points.length < 2) return null;
  const edges: { a: Point; b: Point; n: Point }[] = [];
  const edgeCount = closed ? points.length : points.length - 1;
  const verts = closed ? [...points, points[0]] : points;
  for (let i = 0; i < edgeCount; i += 1) {
    const a = verts[i];
    const b = verts[i + 1];
    if (distance(a, b) < 1e-6) continue;
    edges.push({ a, b, n: unitNormal(a, b) });
  }
  if (!edges.length) return null;
  const shifted = edges.map(({ a, b, n }) => ({ a: add(a, scale(n, d)), b: add(b, scale(n, d)) }));
  const out: Point[] = [];
  if (!closed) out.push(shifted[0].a);
  const jointCount = closed ? shifted.length : shifted.length - 1;
  for (let i = 0; i < jointCount; i += 1) {
    const prev = closed ? shifted[(i - 1 + shifted.length) % shifted.length] : shifted[i];
    const curr = closed ? shifted[i] : shifted[i + 1];
    // Miter join: the unclamped intersection of the two offset lines. It can
    // legitimately sit past both segment ends (growing an outside corner).
    const a = sub(prev.b, prev.a);
    const bDir = sub(curr.b, curr.a);
    const denom = cross(a, bDir);
    const join = isClose(denom, 0, 1e-9)
      ? midpoint(prev.b, curr.a)
      : add(prev.a, scale(a, cross(sub(curr.a, prev.a), bDir) / denom));
    out.push(join);
  }
  if (!closed) out.push(shifted[shifted.length - 1].b);
  return out;
}

/** Offset an element toward ``side``. When ``distanceCm`` is omitted the
 *  click itself defines the gap: its perpendicular distance to the source
 *  (AutoCAD "through point" mode). Returns a new element, or null when the
 *  element type cannot be offset or the result degenerates. */
export function offsetElement(el: ProjectElement, side: Point, distanceCm?: number): ProjectElement | null {
  const mode = drawModeOf(el.element_type);
  const gap = distanceCm ?? null;

  if (mode === 'line') {
    const sign = Math.sign(signedSide(segStart(el), segEnd(el), side)) || 1;
    const d = Math.abs(gap ?? signedSide(segStart(el), segEnd(el), side));
    if (d < MIN_LENGTH_CM) return null;
    const n = unitNormal(segStart(el), segEnd(el));
    return cloneElement(mapElementPoints(el, (p) => add(p, scale(n, d * sign))));
  }

  if (mode === 'rect') {
    // Offsetting a rectangle grows/shrinks every edge by d; the click side
    // inside the bbox means "shrink" (like offsetting toward the inside).
    const inside = side.x >= el.x1 && side.x <= el.x2 && side.y >= el.y1 && side.y <= el.y2;
    const w = Math.abs(el.x2 - el.x1);
    const h = Math.abs(el.y2 - el.y1);
    // Outside: euclidean distance to the bbox. Inside: distance to the
    // nearest edge.
    const dx = Math.max(el.x1 - side.x, 0, side.x - el.x2);
    const dy = Math.max(el.y1 - side.y, 0, side.y - el.y2);
    const outsideDist = Math.hypot(dx, dy);
    const insideDist = Math.min(
      Math.abs(side.x - el.x1),
      Math.abs(side.x - el.x2),
      Math.abs(side.y - el.y1),
      Math.abs(side.y - el.y2),
    );
    const d = gap ?? (inside ? insideDist : outsideDist);
    const signed = inside ? -d : d;
    if (w + 2 * signed < 1 || h + 2 * signed < 1) return null;
    if (el.element_type === 'hatch') return null;
    return cloneElement(rebuildRect(el, rectCenter(el), w + 2 * signed, h + 2 * signed, el.rotation));
  }

  if (mode === 'center') {
    const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
    const outside = distance(side, segStart(el)) > radius;
    const d = gap ?? Math.abs(distance(side, segStart(el)) - radius);
    const nextRadius = radius + (outside ? d : -d);
    if (nextRadius < 1) return null;
    const cloned = cloneElement(el) as ProjectElement & { properties: { radius: number } };
    cloned.properties = { ...cloned.properties, radius: nextRadius };
    cloned.x2 = cloned.x1 + nextRadius;
    cloned.length = 2 * Math.PI * nextRadius;
    return cloned;
  }

  if (mode === 'arc') {
    const props = (el as ArcElement).properties;
    const center = { x: props.cx, y: props.cy };
    const outside = distance(side, center) > props.radius;
    const d = gap ?? Math.abs(distance(side, center) - props.radius);
    const nextRadius = props.radius + (outside ? d : -d);
    if (nextRadius < 1) return null;
    const cloned = cloneElement(el) as ArcElement;
    const startAngle = props.start_angle;
    const endAngle = props.end_angle;
    cloned.properties = { ...props, radius: nextRadius } as typeof cloned.properties;
    cloned.x1 = center.x + Math.cos(startAngle) * nextRadius;
    cloned.y1 = center.y + Math.sin(startAngle) * nextRadius;
    cloned.x2 = center.x + Math.cos(endAngle) * nextRadius;
    cloned.y2 = center.y + Math.sin(endAngle) * nextRadius;
    const sweep = props.clockwise ? ccwSweep(endAngle, startAngle) : ccwSweep(startAngle, endAngle);
    cloned.length = Math.max(1, nextRadius * sweep);
    return cloned;
  }

  if (mode === 'poly') {
    const props = el.properties as { points?: Point[]; closed?: boolean };
    const points = props.points ?? [];
    if (points.length < 2) return null;
    const closed = Boolean(props.closed);
    const base = props.closed ? points.slice(0, -1) : points;
    // Sign from the click's side relative to the nearest segment.
    let best = Infinity;
    let sideSign = 1;
    for (let i = 0; i < base.length - (closed ? 0 : 1); i += 1) {
      const a = base[i];
      const b = base[(i + 1) % base.length];
      const proj = projectPointOnSegment(side, a, b);
      if (proj.distance < best) {
        best = proj.distance;
        sideSign = Math.sign(signedSide(a, b, side)) || 1;
      }
    }
    const d = Math.abs(gap ?? best);
    if (d < MIN_LENGTH_CM) return null;
    const next = offsetChain(base, d * sideSign, closed);
    if (!next || next.length < 2) return null;
    const vertices = closed ? [...next, next[0]] : next;
    const cloned = cloneElement(el);
    cloned.x1 = vertices[0].x;
    cloned.y1 = vertices[0].y;
    cloned.x2 = vertices[vertices.length - 1].x;
    cloned.y2 = vertices[vertices.length - 1].y;
    cloned.length = vertices.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(vertices[i - 1], p)), 0);
    cloned.properties = { ...cloned.properties, points: vertices } as typeof cloned.properties;
    return cloned;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Trim / extend                                                       */
/* ------------------------------------------------------------------ */

/** Intersection of the infinite line through a1–a2 with the segment
 *  b1–b2. Returns the point and its parameter along a→b (unclamped). */
function infiniteToSegment(a1: Point, a2: Point, b1: Point, b2: Point): { point: Point; t: number } | null {
  const a = sub(a2, a1);
  const b = sub(b2, b1);
  const denom = cross(a, b);
  if (isClose(denom, 0, 1e-9)) return null;
  const c = sub(b1, a1);
  const t = cross(c, b) / denom;
  const u = cross(c, a) / denom;
  if (u < -1e-9 || u > 1.00000001) return null;
  return { point: add(a1, scale(a, t)), t };
}

/** Param of ``p``'s projection along the segment a→b (unclamped). */
function paramAlong(a: Point, b: Point, p: Point): number {
  const dir = sub(b, a);
  const lenSq = dot(dir, dir);
  if (lenSq < 1e-12) return 0;
  return dot(sub(p, a), dir) / lenSq;
}

function setEndpoint(el: ProjectElement, end: 'start' | 'end', point: Point): ProjectElement {
  const next = { ...el, properties: { ...el.properties } } as ProjectElement;
  if (end === 'start') {
    next.x1 = point.x;
    next.y1 = point.y;
  } else {
    next.x2 = point.x;
    next.y2 = point.y;
  }
  next.length = distance(segStart(next), segEnd(next));
  next.rotation = Math.atan2(next.y2 - next.y1, next.x2 - next.x1);
  if (next.element_type === 'beam') {
    next.properties = { ...next.properties, length: next.length / 100 } as typeof next.properties;
  }
  return retime(next);
}

/** Trim ``target`` where it crosses ``cutter``: the clicked side (the end
 *  nearer ``pick`` past the intersection) collapses onto the cut point. */
export function trimLineEnd(target: ProjectElement, cutter: ProjectElement, pick: Point): ProjectElement | null {
  if (drawModeOf(target.element_type) !== 'line' || drawModeOf(cutter.element_type) !== 'line') return null;
  if (target.id === cutter.id) return null;
  const hit = lineIntersection(segStart(target), segEnd(target), segStart(cutter), segEnd(cutter));
  if (!hit) return null;
  const tI = paramAlong(segStart(target), segEnd(target), hit);
  const tPick = paramAlong(segStart(target), segEnd(target), pick);
  return tPick > tI ? setEndpoint(target, 'end', hit) : setEndpoint(target, 'start', hit);
}

/** Extend ``target`` along its own direction until it meets ``boundary``
 *  (the boundary counts as a segment). The clicked end grows. */
export function extendLineTo(target: ProjectElement, boundary: ProjectElement, pick: Point): ProjectElement | null {
  if (drawModeOf(target.element_type) !== 'line' || drawModeOf(boundary.element_type) !== 'line') return null;
  if (target.id === boundary.id) return null;
  const hit = infiniteToSegment(segStart(target), segEnd(target), segStart(boundary), segEnd(boundary));
  if (!hit) return null;
  const tPick = paramAlong(segStart(target), segEnd(target), pick);
  // The picked end is whichever side of the midpoint the click landed on;
  // the intersection must lie strictly beyond that end for an extension.
  const endPicked = tPick >= 0.5;
  if (endPicked && hit.t > 1) return setEndpoint(target, 'end', hit.point);
  if (!endPicked && hit.t < 0) return setEndpoint(target, 'start', hit.point);
  return null;
}

/* ------------------------------------------------------------------ */
/* Fillet                                                              */
/* ------------------------------------------------------------------ */

export type FilletResult = {
  a: ProjectElement;
  b: ProjectElement;
  arc: ArcElement | null;
};

/** Fillet two line-mode elements. Radius 0 produces a clean corner; a
 *  positive radius trims/extends both lines to the tangent points and
 *  inserts a tangent arc. Returns null for parallel lines. */
export function filletLines(
  a: ProjectElement,
  b: ProjectElement,
  radiusCm: number,
  arcId?: string,
): FilletResult | null {
  if (drawModeOf(a.element_type) !== 'line' || drawModeOf(b.element_type) !== 'line') return null;
  if (a.id === b.id) return null;
  const a1 = segStart(a);
  const a2 = segEnd(a);
  const b1 = segStart(b);
  const b2 = segEnd(b);
  const da = sub(a2, a1);
  const db = sub(b2, b1);
  const denom = cross(da, db);
  if (isClose(denom, 0, 1e-9)) return null;
  const c = sub(b1, a1);
  const tI = cross(c, db) / denom;
  const intersection = add(a1, scale(da, tI));

  const keptA = distance(intersection, a2) >= distance(intersection, a1) ? 'end' : 'start';
  const keptB = distance(intersection, b2) >= distance(intersection, b1) ? 'end' : 'start';
  const keptPointA = keptA === 'end' ? a2 : a1;
  const keptPointB = keptB === 'end' ? b2 : b1;

  const radius = Math.max(0, radiusCm);
  if (radius < MIN_LENGTH_CM) {
    const nextA = setEndpoint(a, keptA === 'end' ? 'start' : 'end', intersection);
    const nextB = setEndpoint(b, keptB === 'end' ? 'start' : 'end', intersection);
    return { a: nextA, b: nextB, arc: null };
  }

  const ua = unit(sub(keptPointA, intersection));
  const ub = unit(sub(keptPointB, intersection));
  const bisector = unit(add(ua, ub));
  if (Math.abs(bisector.x) < 1e-9 && Math.abs(bisector.y) < 1e-9) return null;
  const sinHalf = Math.abs(cross(ua, bisector));
  if (sinHalf < 1e-6) return null;
  const center = add(intersection, scale(bisector, radius / sinHalf));

  const tangentOn = (p1: Point, p2: Point): Point => {
    const dir = sub(p2, p1);
    const lenSq = dot(dir, dir);
    if (lenSq < 1e-12) return { ...p1 };
    return add(p1, scale(dir, dot(sub(center, p1), dir) / lenSq));
  };
  const tA = tangentOn(a1, a2);
  const tB = tangentOn(b1, b2);
  const nextA = setEndpoint(a, keptA === 'end' ? 'start' : 'end', tA);
  const nextB = setEndpoint(b, keptB === 'end' ? 'start' : 'end', tB);

  // Arc through-point: along the bisector pointing back toward the corner.
  const midDir = unit(sub(intersection, center));
  const midPoint = add(center, scale(midDir, radius));
  const arc = createArc(arcId ?? crypto.randomUUID(), a.project_id, tA, midPoint, tB);
  return { a: nextA, b: nextB, arc };
}

/* ------------------------------------------------------------------ */
/* Grips                                                               */
/* ------------------------------------------------------------------ */

export type GripKind =
  | 'start'
  | 'end'
  | 'mid'
  | 'vertex'
  | 'corner'
  | 'center'
  | 'radius';

export type Grip = {
  kind: GripKind;
  /** Stable key inside the element, e.g. ``corner:2`` or ``vertex:1``. */
  key: string;
  point: Point;
  index?: number;
};

/** The drag handles a selected element exposes. ``start``/``end`` reuse the
 *  existing endpoint handles (which propagate shared endpoints); the rest
 *  are routed through ``applyGrip`` + a whole-element replace. */
export function gripsFor(el: ProjectElement): Grip[] {
  const mode = drawModeOf(el.element_type);
  const grips: Grip[] = [];
  const start = segStart(el);
  const end = segEnd(el);

  if (mode === 'line') {
    grips.push(
      { kind: 'start', key: 'start', point: start },
      { kind: 'end', key: 'end', point: end },
      { kind: 'mid', key: 'mid', point: midpoint(start, end) },
    );
    return grips;
  }
  if (mode === 'point') {
    grips.push({ kind: 'center', key: 'center', point: start });
    return grips;
  }
  if (mode === 'center') {
    const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
    grips.push(
      { kind: 'center', key: 'center', point: start },
      { kind: 'radius', key: 'radius', point: { x: start.x + radius, y: start.y } },
    );
    return grips;
  }
  if (mode === 'rect') {
    const corners = rectCorners(el);
    corners.forEach((p, index) => grips.push({ kind: 'corner', key: `corner:${index}`, point: p, index }));
    grips.push({ kind: 'center', key: 'center', point: rectCenter(el) });
    return grips;
  }
  if (mode === 'poly') {
    const points = (el.properties as { points?: Point[] }).points ?? [];
    const limit = (el.properties as { closed?: boolean }).closed ? points.length - 1 : points.length;
    for (let i = 0; i < limit; i += 1) {
      grips.push({ kind: 'vertex', key: `vertex:${i}`, point: points[i], index: i });
    }
    return grips;
  }
  if (mode === 'arc') {
    const props = (el as ArcElement).properties;
    grips.push(
      { kind: 'start', key: 'start', point: start },
      { kind: 'end', key: 'end', point: end },
      { kind: 'vertex', key: 'arcMid', point: props.mid },
      { kind: 'center', key: 'center', point: { x: props.cx, y: props.cy } },
    );
  }
  return grips;
}

/** Compute the element produced by dragging ``grip`` to ``point``. */
export function applyGrip(el: ProjectElement, grip: Grip, point: Point): ProjectElement {
  const mode = drawModeOf(el.element_type);
  const next = { ...el, properties: { ...el.properties } } as ProjectElement;

  if ((grip.kind === 'start' || grip.kind === 'end') && mode === 'line') {
    return setEndpoint(el, grip.kind, point);
  }
  if ((grip.kind === 'start' || grip.kind === 'end') && mode === 'arc') {
    // Chord-end drag: re-fit the circle through (new end, stored mid, other
    // end) so the arc keeps passing through its defining points.
    const props = (el as ArcElement).properties;
    const start = grip.kind === 'start' ? point : segStart(el);
    const end = grip.kind === 'end' ? point : segEnd(el);
    const spec = arcSpecFromPoints(start, props.mid, end);
    if (!spec) return el;
    const sweep = spec.clockwise ? ccwSweep(spec.end_angle, spec.start_angle) : ccwSweep(spec.start_angle, spec.end_angle);
    return retime({
      ...next,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      length: Math.max(1, spec.radius * sweep),
      rotation: 0,
      properties: { ...props, ...spec } as typeof next.properties,
    } as ProjectElement);
  }
  if (grip.kind === 'mid' && mode === 'line') {
    const mid = midpoint(segStart(el), segEnd(el));
    return translateElement(el, point.x - mid.x, point.y - mid.y);
  }
  if (grip.kind === 'center' && (mode === 'point' || mode === 'center' || mode === 'rect' || mode === 'arc')) {
    const c = mode === 'arc'
      ? { x: (el as ArcElement).properties.cx, y: (el as ArcElement).properties.cy }
      : mode === 'rect'
        ? rectCenter(el)
        : segStart(el);
    return translateElement(el, point.x - c.x, point.y - c.y);
  }
  if (grip.kind === 'radius' && mode === 'center') {
    const radius = Math.max(1, distance(segStart(el), point));
    return retime({
      ...next,
      x2: next.x1 + radius,
      length: 2 * Math.PI * radius,
      properties: { ...next.properties, radius },
    } as ProjectElement);
  }
  if (grip.kind === 'vertex' && mode === 'poly' && grip.index !== undefined) {
    const points = ((el.properties as { points?: Point[] }).points ?? []).slice();
    if (grip.index >= points.length) return el;
    points[grip.index] = point;
    const closed = Boolean((el.properties as { closed?: boolean }).closed);
    if (closed && grip.index === 0) points[points.length - 1] = point;
    next.x1 = points[0].x;
    next.y1 = points[0].y;
    next.x2 = points[points.length - 1].x;
    next.y2 = points[points.length - 1].y;
    next.length = points.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(points[i - 1], p)), 0);
    next.properties = { ...next.properties, points } as typeof next.properties;
    return retime(next);
  }
  if (grip.kind === 'vertex' && mode === 'arc') {
    // Moving the through-point re-fits the circle through (start, mid, end).
    const spec = { ...(el as ArcElement).properties, mid: point };
    const refit = { ...next, properties: spec } as ArcElement;
    const recompute = applyGripArcMid(refit);
    return recompute ?? el;
  }
  if (grip.kind === 'corner' && mode === 'rect' && grip.index !== undefined) {
    return dragRectCorner(el, grip.index, point);
  }
  return el;
}

function applyGripArcMid(el: ArcElement): ProjectElement | null {
  const spec = el.properties;
  const circle = circleFrom3(segStart(el), spec.mid, segEnd(el));
  if (!circle) return null;
  const startAngle = Math.atan2(el.y1 - circle.center.y, el.x1 - circle.center.x);
  const midAngle = Math.atan2(spec.mid.y - circle.center.y, spec.mid.x - circle.center.x);
  const endAngle = Math.atan2(el.y2 - circle.center.y, el.x2 - circle.center.x);
  const onCcwPath = ccwSweep(startAngle, midAngle) <= ccwSweep(startAngle, endAngle);
  const startN = normalizeAngle(startAngle);
  const endN = normalizeAngle(endAngle);
  const sweep = !onCcwPath ? ccwSweep(endN, startN) : ccwSweep(startN, endN);
  return retime({
    ...el,
    length: Math.max(1, circle.radius * sweep),
    properties: { ...spec, cx: circle.center.x, cy: circle.center.y, radius: circle.radius, start_angle: startN, end_angle: endN, clockwise: !onCcwPath },
  } as ProjectElement);
}

function circleFrom3(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
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

/** Drag a rotated-aware rect corner: the opposite corner stays anchored in
 *  the element's local frame, and the bbox re-fits around the new shape. */
function dragRectCorner(el: ProjectElement, index: number, point: Point): ProjectElement {
  const angle = el.rotation || 0;
  const center = rectCenter(el);
  const corners = rectCorners(el);
  const oppositeIndex = (index + 2) % 4;
  const opposite = corners[oppositeIndex];
  if (!angle) {
    const x1 = Math.min(point.x, opposite.x);
    const y1 = Math.min(point.y, opposite.y);
    const x2 = Math.max(point.x, opposite.x);
    const y2 = Math.max(point.y, opposite.y);
    return retime({ ...el, x1, y1, x2, y2, length: Math.max(1, x2 - x1) });
  }
  // Work in the rect's local frame (unrotate about its center).
  const localPoint = add(center, rotate(sub(point, center), -angle));
  const localOpposite = add(center, rotate(sub(opposite, center), -angle));
  const lx1 = Math.min(localPoint.x, localOpposite.x);
  const ly1 = Math.min(localPoint.y, localOpposite.y);
  const lx2 = Math.max(localPoint.x, localOpposite.x);
  const ly2 = Math.max(localPoint.y, localOpposite.y);
  const w = Math.max(1, lx2 - lx1);
  const h = Math.max(1, ly2 - ly1);
  const localCenter = { x: (lx1 + lx2) / 2, y: (ly1 + ly2) / 2 };
  const newCenter = add(center, rotate(sub(localCenter, center), angle));
  return retime(rebuildRect(el, newCenter, w, h, angle));
}

/* ------------------------------------------------------------------ */
/* Picking + selection boxes                                           */
/* ------------------------------------------------------------------ */

export type PickableHit = { element: ProjectElement; distance: number };

/** Distance from ``p`` to the element's pickable curve. Elements are picked
 *  on their outline (not their fill) like CAD entities; point footprints
 *  count as filled discs. Returns Infinity for unhandled modes. */
export function pickDistance(p: Point, el: ProjectElement): number {
  const mode = drawModeOf(el.element_type);
  if (mode === 'line') {
    return projectPointOnSegment(p, segStart(el), segEnd(el)).distance;
  }
  if (mode === 'point') {
    if (el.element_type === 'column') {
      const props = el.properties as { width?: number; depth?: number; diameter?: number; shape?: string };
      const w = ((props.width ?? 0.2) * 100) / 2;
      const d = ((props.diameter ?? props.depth ?? 0.2) * 100) / 2;
      const inside = Math.abs(p.x - el.x1) <= w && Math.abs(p.y - el.y1) <= d;
      return inside ? 0 : projectPointOnSegment(p, { x: el.x1 - w, y: el.y1 }, { x: el.x1 + w, y: el.y1 }).distance;
    }
    return distance(p, segStart(el));
  }
  if (mode === 'center') {
    const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
    return Math.abs(distance(p, segStart(el)) - radius);
  }
  if (mode === 'rect') {
    const corners = rectCorners(el);
    let best = Infinity;
    let inside = true;
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      best = Math.min(best, projectPointOnSegment(p, a, b).distance);
      if (signedSide(a, b, p) < 0) inside = false;
    }
    return inside ? 0 : best;
  }
  if (mode === 'poly') {
    const points = (el.properties as { points?: Point[] }).points ?? [];
    if (points.length < 2) return distance(p, segStart(el));
    let best = Infinity;
    const count = points.length;
    for (let i = 0; i < count - 1; i += 1) {
      best = Math.min(best, projectPointOnSegment(p, points[i], points[i + 1]).distance);
    }
    return best;
  }
  if (mode === 'arc') {
    const props = (el as ArcElement).properties;
    const toCenter = distance(p, { x: props.cx, y: props.cy });
    // Within the sweep? Project onto the circle and check the angle lies on
    // the travelled arc.
    const angle = normalizeAngle(Math.atan2(p.y - props.cy, p.x - props.cx));
    const sweep = props.clockwise ? ccwSweep(props.end_angle, props.start_angle) : ccwSweep(props.start_angle, props.end_angle);
    const rel = props.clockwise ? ccwSweep(props.end_angle, angle) : ccwSweep(props.start_angle, angle);
    if (rel <= sweep + 1e-3) return Math.abs(toCenter - props.radius);
    return Math.min(distance(p, segStart(el)), distance(p, segEnd(el)));
  }
  return Infinity;
}

/** Nearest element to ``p`` whose pick distance fits inside ``tol`` —
 *  the engine behind click-picking for offset/trim/extend/fillet. */
export function pickElementAt(
  p: Point,
  elements: ProjectElement[],
  tol: number,
  filter?: (el: ProjectElement) => boolean,
): PickableHit | null {
  let best: PickableHit | null = null;
  for (const el of elements) {
    if (filter && !filter(el)) continue;
    const d = pickDistance(p, el);
    if (d <= tol && (!best || d < best.distance)) best = { element: el, distance: d };
  }
  return best;
}

/** Defining points of an element used by window/crossing tests: endpoints
 *  for lines, vertices for polylines, rotated corners for rects, center +
 *  quadrant points for circles, chord + mid for arcs. */
export function definingPoints(el: ProjectElement): Point[] {
  const mode = drawModeOf(el.element_type);
  if (mode === 'point') return [segStart(el)];
  if (mode === 'line') return [segStart(el), segEnd(el)];
  if (mode === 'rect') return rectCorners(el);
  if (mode === 'center') {
    const c = segStart(el);
    const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
    return [
      c,
      { x: c.x + radius, y: c.y },
      { x: c.x - radius, y: c.y },
      { x: c.x, y: c.y + radius },
      { x: c.x, y: c.y - radius },
    ];
  }
  if (mode === 'poly') {
    return (el.properties as { points?: Point[] }).points ?? [segStart(el), segEnd(el)];
  }
  const props = (el as ArcElement).properties;
  return [segStart(el), segEnd(el), props.mid];
}

/** Segments making up the element's visible outline (for crossing tests
 *  and edit ghosts). Point footprints emit a small cross centred on them. */
export function outlineSegments(el: ProjectElement): [Point, Point][] {
  const mode = drawModeOf(el.element_type);
  if (mode === 'point') {
    const c = segStart(el);
    if (el.element_type === 'column') {
      const props = el.properties as { width?: number; depth?: number };
      const w = Math.max(10, (props.width ?? 0.2) * 100);
      const d = Math.max(10, (props.depth ?? 0.2) * 100);
      const corners = rectCorners({ x1: c.x - w / 2, y1: c.y - d / 2, x2: c.x + w / 2, y2: c.y + d / 2, rotation: el.rotation });
      return corners.map((p, i) => [p, corners[(i + 1) % 4]] as [Point, Point]);
    }
    const arm = 15;
    return [
      [{ x: c.x - arm, y: c.y }, { x: c.x + arm, y: c.y }],
      [{ x: c.x, y: c.y - arm }, { x: c.x, y: c.y + arm }],
    ];
  }
  if (mode === 'line') return [[segStart(el), segEnd(el)]];
  if (mode === 'rect') {
    const c = rectCorners(el);
    return c.map((p, i) => [p, c[(i + 1) % 4]] as [Point, Point]);
  }
  if (mode === 'poly') {
    const points = (el.properties as { points?: Point[] }).points ?? [];
    const segs: [Point, Point][] = [];
    for (let i = 0; i < points.length - 1; i += 1) segs.push([points[i], points[i + 1]]);
    return segs;
  }
  if (mode === 'center') {
    const c = segStart(el);
    const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
    // 16-gon approximation is plenty for hit-testing.
    const segs: [Point, Point][] = [];
    let prev = { x: c.x + radius, y: c.y };
    for (let i = 1; i <= 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const p = { x: c.x + Math.cos(a) * radius, y: c.y + Math.sin(a) * radius };
      segs.push([prev, p]);
      prev = p;
    }
    return segs;
  }
  if (mode === 'arc') {
    const props = (el as ArcElement).properties;
    const sweep = props.clockwise ? -ccwSweep(props.end_angle, props.start_angle) : ccwSweep(props.start_angle, props.end_angle);
    const segments = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 8)));
    const segs: [Point, Point][] = [];
    let prev = segStart(el);
    for (let i = 1; i <= segments; i += 1) {
      const a = props.start_angle + (sweep * i) / segments;
      const p = { x: props.cx + Math.cos(a) * props.radius, y: props.cy + Math.sin(a) * props.radius };
      segs.push([prev, p]);
      prev = p;
    }
    return segs;
  }
  return [];
}

export type BoxMode = 'window' | 'crossing';

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

function pointInBox(p: Point, box: Box): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = signedSide(b1, b2, a1);
  const d2 = signedSide(b1, b2, a2);
  const d3 = signedSide(a1, a2, b1);
  const d4 = signedSide(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (isClose(d1, 0) && pointOnSegment(a1, b1, b2)) return true;
  if (isClose(d2, 0) && pointOnSegment(a2, b1, b2)) return true;
  if (isClose(d3, 0) && pointOnSegment(b1, a1, a2)) return true;
  if (isClose(d4, 0) && pointOnSegment(b2, a1, a2)) return true;
  return false;
}

function segmentIntersectsBox(a: Point, b: Point, box: Box): boolean {
  if (pointInBox(a, box) || pointInBox(b, box)) return true;
  const tl = { x: box.minX, y: box.minY };
  const tr = { x: box.maxX, y: box.minY };
  const br = { x: box.maxX, y: box.maxY };
  const bl = { x: box.minX, y: box.maxY };
  return segmentsIntersect(a, b, tl, tr)
    || segmentsIntersect(a, b, tr, br)
    || segmentsIntersect(a, b, br, bl)
    || segmentsIntersect(a, b, bl, tl);
}

/** AutoCAD selection semantics: ``window`` (drag left→right) requires the
 *  whole entity inside; ``crossing`` (drag right→left) takes anything the
 *  rectangle touches. */
export function elementInBox(el: ProjectElement, box: Box, mode: BoxMode): boolean {
  const points = definingPoints(el);
  if (mode === 'window') {
    return points.every((p) => pointInBox(p, box));
  }
  if (points.some((p) => pointInBox(p, box))) return true;
  const outline = outlineSegments(el);
  return outline.some(([a, b]) => segmentIntersectsBox(a, b, box));
}
