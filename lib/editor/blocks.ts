import type {
  BlockCreatePayload,
  BlockDefinition,
  BlockItemData,
  BlockRefElement,
  ProjectElement,
} from '@/types/project';
import { drawModeOf } from '@/lib/editor/elements';
import { paperToWorld } from '@/lib/editor/annotations';
import { mapElementPoints, mirrorElement, rotateElement } from '@/lib/editor/edit-ops';
import { add, normalizeAngle, rotate, sub, type Point } from '@/lib/editor/geometry';

/* ------------------------------------------------------------------ */
/* Reusable blocks (roadmap week 10)                                    */
/*                                                                     */
/* A ``BlockDefinition`` stores element snapshots in world coordinates   */
/* plus a base point. A ``block_ref`` element instantiates it:           */
/*                                                                     */
/*   placed = insert + S(item - base)                                     */
/*   world = R_c(theta)(M_c(placed)) when mirrored, else R_c(theta)(placed) */
/*                                                                     */
/* where the scale is derived from the ref's bbox vs the definition's    */
/* bounds — dragging a ref's corner grips stretches the block, like a    */
/* non-uniform AutoCAD INSERT. Mirror and rotation use the ref's bbox    */
/* center, matching the rect-mode edit operations.                       */
/* ------------------------------------------------------------------ */

/** Plan-space size properties that scale with a uniformly scaled instance
 *  (vertical dims like ``height``/``*_elevation`` stay untouched — a plan
 *  block never changes story heights). */
const PLAN_SIZE_KEYS = ['width', 'depth', 'diameter', 'radius', 'thickness', 'spacing', 'tread'] as const;

export function blockById(blocks: BlockDefinition[], id: string | undefined | null): BlockDefinition | undefined {
  return blocks.find((block) => block.id === id);
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function boundsOf(points: Point[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function dimensionBounds(el: { x1: number; y1: number; x2: number; y2: number; properties: Record<string, unknown> }): Bounds {
  const start = { x: el.x1, y: el.y1 };
  const end = { x: el.x2, y: el.y2 };
  const points = [start, end];
  const dimPoint = el.properties.dim_point as Point | undefined;
  const vertex = el.properties.vertex as Point | undefined;
  if (dimPoint) points.push(dimPoint);
  if (vertex) points.push(vertex);
  const kind = el.properties.kind;
  if (kind === 'radial' || kind === 'diameter') {
    const radius = (el.properties.radius as number | undefined) ?? Math.hypot(end.x - start.x, end.y - start.y);
    points.push(
      { x: start.x - radius, y: start.y - radius },
      { x: start.x + radius, y: start.y + radius },
    );
  }
  return boundsOf(points);
}

function leaderBounds(el: { x1: number; y1: number; x2: number; y2: number; properties: Record<string, unknown> }): Bounds {
  const points = [{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }];
  const extraPoints = el.properties.points as Point[] | undefined;
  if (extraPoints) points.push(...extraPoints);
  return boundsOf(points);
}

function textBounds(
  el: { x1: number; y1: number; rotation?: number; properties: Record<string, unknown> },
  annotationScale: number,
): Bounds {
  const fontSize = paperToWorld((el.properties.height as number) ?? 2.5, annotationScale);
  const text = String(el.properties.text ?? '');
  const width = Math.max(fontSize * 2, text.length * fontSize);
  const align = el.properties.align;
  const offsetX = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  const angle = el.rotation ?? 0;
  const corners = [
    { x: -offsetX, y: 0 },
    { x: width - offsetX, y: 0 },
    { x: width - offsetX, y: fontSize },
    { x: -offsetX, y: fontSize },
  ].map((point) => {
    const rotated = rotate(point, angle);
    return { x: el.x1 + rotated.x, y: el.y1 + rotated.y };
  });
  return boundsOf(corners);
}

function elementBounds(
  el: { x1: number; y1: number; x2: number; y2: number; element_type: string; properties: Record<string, unknown> },
): Bounds {
  if (el.element_type === 'dimension') return dimensionBounds(el);
  if (el.element_type === 'leader') return leaderBounds(el);
  const mode = drawModeOf(el.element_type as ProjectElement['element_type']);
  if (mode === 'point') {
    // Point elements render centered on x1,y1 with a size in properties.
    const sizeCm = Math.max(
      ((el.properties.width as number) ?? 0) * 100,
      ((el.properties.depth as number) ?? 0) * 100,
      ((el.properties.diameter as number) ?? 0) * 100,
      30,
    );
    const half = sizeCm / 2;
    return { minX: el.x1 - half, minY: el.y1 - half, maxX: el.x1 + half, maxY: el.y1 + half };
  }
  if (mode === 'center') {
    const r = (el.properties.radius as number) ?? Math.abs(el.x2 - el.x1);
    return { minX: el.x1 - r, minY: el.y1 - r, maxX: el.x1 + r, maxY: el.y1 + r };
  }
  if (mode === 'poly' || mode === 'arc') {
    const points = (el.properties.points as Point[] | undefined) ?? [];
    const xs = [el.x1, el.x2, ...points.map((p) => p.x)];
    const ys = [el.y1, el.y2, ...points.map((p) => p.y)];
    if (mode === 'arc') {
      const cx = el.properties.cx as number | undefined;
      const cy = el.properties.cy as number | undefined;
      const radius = el.properties.radius as number | undefined;
      if (cx !== undefined && cy !== undefined && radius !== undefined) {
        xs.push(cx - radius, cx + radius);
        ys.push(cy - radius, cy + radius);
      }
    }
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }
  return {
    minX: Math.min(el.x1, el.x2),
    minY: Math.min(el.y1, el.y2),
    maxX: Math.max(el.x1, el.x2),
    maxY: Math.max(el.y1, el.y2),
  };
}

export function annotationHitBounds(ghosts: ProjectElement[], annotationScale: number): Bounds | null {
  const bounds: Bounds[] = [];
  for (const ghost of ghosts) {
    if (ghost.element_type === 'text') bounds.push(textBounds(ghost, annotationScale));
    else if (ghost.element_type === 'dimension') bounds.push(dimensionBounds(ghost));
    else if (ghost.element_type === 'leader') bounds.push(leaderBounds(ghost));
  }
  if (!bounds.length) return null;
  return {
    minX: Math.min(...bounds.map((bound) => bound.minX)),
    minY: Math.min(...bounds.map((bound) => bound.minY)),
    maxX: Math.max(...bounds.map((bound) => bound.maxX)),
    maxY: Math.max(...bounds.map((bound) => bound.maxY)),
  };
}

/** Union bbox of all stored items, relative to the block's base point —
 *  i.e. the footprint an instance at scale 1 / rotation 0 occupies around
 *  its insertion point. */
export function blockBounds(def: Pick<BlockDefinition, 'base_x' | 'base_y' | 'items'>): { x: number; y: number; w: number; h: number } {
  if (!def.items.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of def.items) {
    const b = elementBounds(item);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { x: minX - def.base_x, y: minY - def.base_y, w: maxX - minX, h: maxY - minY };
}

/** Strip project-owned fields and freeze an element as a block item —
 *  identity (``id``, project, timestamps) is dropped on purpose: an
 *  exploded item always gets a fresh identity. */
function blockItemOf(element: ProjectElement): BlockItemData {
  return {
    element_type: element.element_type,
    x1: element.x1,
    y1: element.y1,
    x2: element.x2,
    y2: element.y2,
    length: element.length,
    rotation: element.rotation,
    material_id: element.material_id,
    section_id: element.section_id,
    properties: JSON.parse(JSON.stringify(element.properties)),
  };
}

/** Build a create-block payload from selected elements. The base point is
 *  the selection's bounding-box minimum corner; ``block_ref`` elements are
 *  skipped (nested blocks are out of scope for week 10). Returns ``null``
 *  when nothing usable is selected. */
export function createBlockFromSelection(
  name: string,
  elements: ProjectElement[],
  description = '',
): BlockCreatePayload | null {
  const usable = elements.filter((el) => el.element_type !== 'block_ref');
  if (!usable.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  for (const el of usable) {
    const b = elementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
  }
  return {
    name,
    description,
    base_x: minX,
    base_y: minY,
    items: usable.map(blockItemOf),
  };
}

/** Rehydrate a stored item into a full element shape so the shared
 *  ``mapElementPoints`` kernel can transform it. */
function itemAsElement(item: BlockItemData, projectId: string): ProjectElement {
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    element_type: item.element_type,
    x1: item.x1,
    y1: item.y1,
    x2: item.x2,
    y2: item.y2,
    length: item.length,
    rotation: item.rotation,
    material_id: item.material_id ?? null,
    section_id: item.section_id ?? null,
    created_at: '',
    updated_at: '',
    properties: JSON.parse(JSON.stringify(item.properties)),
  } as ProjectElement;
}

/** Uniform scale applied to plan-size properties when the instance scale
 *  is isotropic; ``null`` when the stretch is non-uniform or ~1. */
function uniformScale(sx: number, sy: number): number | null {
  if (Math.abs(sx - sy) > 1e-6) return null;
  if (Math.abs(sx - 1) < 1e-6) return null;
  return sx;
}

/** Produce the world-space ghost elements an instance renders. Ghost ids
 *  are ``ref.id:<index>`` so a ref stays one selectable object while each
 *  ghost keeps a stable React key. */
export function instantiateBlock(def: BlockDefinition, ref: BlockRefElement): ProjectElement[] {
  const bounds = blockBounds(def);
  const insert = { x: ref.x1, y: ref.y1 };
  const center = { x: (ref.x1 + ref.x2) / 2, y: (ref.y1 + ref.y2) / 2 };
  const sx = bounds.w > 1e-9 ? Math.abs(ref.x2 - ref.x1) / bounds.w : 1;
  const sy = bounds.h > 1e-9 ? Math.abs(ref.y2 - ref.y1) / bounds.h : 1;
  const theta = ref.rotation;
  const base = { x: def.base_x, y: def.base_y };
  const s = uniformScale(sx, sy);

  return def.items.map((item, index) => {
    const source = itemAsElement(item, ref.project_id);
    let ghost = mapElementPoints(source, (p) => {
      const rel = sub(p, base);
      const scaled = { x: rel.x * sx, y: rel.y * sy };
      return add(insert, scaled);
    });
    const mode = drawModeOf(item.element_type);
    if (ref.properties.mirrored) {
      ghost = mirrorElement(ghost, center, { x: center.x + 1, y: center.y });
    }
    if (theta) {
      ghost = rotateElement(ghost, center, theta);
      if (mode === 'point' && item.element_type !== 'column' && item.element_type !== 'text') {
        ghost.rotation = normalizeAngle(ghost.rotation + theta);
      }
    }
    if (s !== null) {
      const props = { ...(ghost.properties as Record<string, unknown>) };
      for (const key of PLAN_SIZE_KEYS) {
        if (typeof props[key] === 'number') props[key] = (props[key] as number) * s;
      }
      ghost.properties = props as typeof ghost.properties;
    }
    ghost.id = `${ref.id}:${index}`;
    return ghost;
  });
}

/** Convert a reference back into real elements: fresh ids, the item's own
 *  layer preserved, and the ref's layer as the fallback for layerless
 *  items. Returns ``[]`` for missing or empty definitions. */
export function explodeBlockRef(ref: BlockRefElement, def: BlockDefinition | undefined): ProjectElement[] {
  if (!def || !def.items.length) return [];
  const refLayer = (ref.properties as { layer_id?: string | null }).layer_id ?? null;
  return instantiateBlock(def, ref).map((ghost) => {
    const { project_id } = ref;
    const props = { ...(ghost.properties as Record<string, unknown>) };
    if (props.layer_id == null) props.layer_id = refLayer;
    return {
      ...ghost,
      id: crypto.randomUUID(),
      project_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      properties: props,
    } as ProjectElement;
  });
}

/** The ``block_ref`` element created by a single insertion click. */
export function createBlockRef(
  id: string,
  projectId: string,
  def: BlockDefinition,
  insert: Point,
): BlockRefElement {
  const now = new Date().toISOString();
  const bounds = blockBounds(def);
  return {
    id,
    project_id: projectId,
    element_type: 'block_ref',
    x1: insert.x,
    y1: insert.y,
    x2: insert.x + Math.max(1, bounds.w),
    y2: insert.y + Math.max(1, bounds.h),
    length: Math.max(1, bounds.w),
    rotation: 0,
    material_id: null,
    section_id: null,
    created_at: now,
    updated_at: now,
    properties: { block_id: def.id, block_name: def.name },
  };
}
