import { useReducer, useCallback, useMemo } from 'react';
import type { Point } from '@/lib/editor/geometry';
import type { ArcElement, ElementType, PlanLayer, Project, ProjectElement, WallElement } from '@/types/project';
import {
  createArc,
  createBeam,
  createBrace,
  createCircle,
  createColumn,
  createDoor,
  createEllipse,
  createFooting,
  createGradeBeam,
  createHatch,
  createJoist,
  createLine,
  createOpening,
  createPile,
  createPolyline,
  createRamp,
  createRectangle,
  createSlab,
  createStair,
  createWall,
  createWindow,
  drawModeOf,
  normalizeElement,
  updateRectSize,
  updateWallLength,
  recomputeWallJoin,
  updateBeamLength,
  defaultDesignSettings,
  arcSpecFromPoints,
} from '@/lib/editor/elements';
import { findColumnContainingPoint, isPointInsideColumn, snapForColumn, snapForWall, snapToNearest, snapWallStart, wallCrossesColumnInterior, type SnapResult } from '@/lib/editor/snapping';
import {
  ccwSweep,
  cmToMeters,
  distance,
  isClose,
  metersToCm,
  pointsEqual,
  polarSnapPoint,
  resolveTJoin,
  toRadians,
} from '@/lib/editor/geometry';
import { calculateSelectionSummary } from '@/lib/editor/calculations';
import {
  applyTransform,
  bestExtend,
  bestTrim,
  CUTTER_OPS,
  filletLines,
  offsetElement,
  PICK_FIRST_OPS,
  type EditOp,
  type EditRequest,
} from '@/lib/editor/edit-ops';
import { parsePointInput, resolvePoint } from '@/lib/editor/coords';
import { displayToCm, type DisplayUnit } from '@/lib/editor/units';
import { createLayer, defaultLayerFor, ensureLayers, isElementLocked } from '@/lib/editor/layers';
import { useLocale } from '@/lib/i18n/locale-context';
import type { Locale } from '@/lib/i18n/messages';

export type Tool = 'select' | ElementType;

export type ActiveSection =
  | 'home'
  | 'projects'
  | 'draw'
  | 'structure'
  | 'layers'
  | 'catalog'
  | 'calculations'
  | 'history'
  | 'settings';

export type DraftState = {
  tool: Tool;
  start: Point;
  startInput: Point;
  columnAnchorId: string | null;
  end: Point;
  /** Confirmed vertices for multi-click tools: ``polyline`` holds every
   *  clicked point (the first one included); ``arc`` holds the start point
   *  and the through-point once the second click lands. */
  vertices: Point[];
  snap: SnapResult | null;
  host: ProjectElement | null;
  joinAt: 'start' | 'end' | null;
  polar: boolean;
};

/** Interactive edit session (roadmap week 9): a small state machine on top
 *  of the element list — pick targets → base point → target point → commit.
 *  The pure math lives in ``lib/editor/edit-ops.ts``; this state only holds
 *  where the user is inside that flow. */
export type EditSession = EditRequest & {
  /** Live snap marker under the cursor, like the draft's snap ring. */
  snap: SnapResult | null;
};

export type EditorState = {
  elements: ProjectElement[];
  tool: Tool;
  selectedIds: string[];
  draft: DraftState | null;
  edit: EditSession | null;
  viewport: { zoom: number; pan: Point };
  showGrid: boolean;
  snapEnabled: boolean;
  polarEnabled: boolean;
  cleanMode: boolean;
  activeSection: ActiveSection;
  layers: PlanLayer[];
  activeLayerId: string;
  revision: number;
  headRevision: number;
  historyBusy: boolean;
  dirty: boolean;
  readOnly: boolean;
  error: string;
};

export type EditorAction =
  | { type: 'load'; project: Project; locale?: Locale }
  | { type: 'setTool'; tool: Tool }
  | { type: 'setSection'; section: ActiveSection }
  | { type: 'select'; id: string; add: boolean }
  | { type: 'selectMany'; ids: string[] }
  | { type: 'selectBox'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'toggleGrid' }
  | { type: 'toggleSnap' }
  | { type: 'togglePolar' }
  | { type: 'toggleCleanMode' }
  | { type: 'setZoom'; zoom: number }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'pan'; delta: Point }
  | { type: 'fit' }
  | { type: 'beginDraft'; point: Point }
  | { type: 'updateDraft'; point: Point; exact?: boolean }
  | { type: 'extendDraft' }
  | { type: 'commitDraft'; close?: boolean }
  | { type: 'cancelDraft' }
  | { type: 'armEdit'; op: EditOp }
  | { type: 'editCursor'; point: Point }
  | { type: 'editPick'; point: Point; elementId?: string | null; exact?: boolean }
  | { type: 'editPickMany'; ids: string[] }
  | { type: 'editDone' }
  | { type: 'editValue'; text: string; unit: DisplayUnit }
  | { type: 'cancelEdit' }
  | { type: 'replaceElement'; element: ProjectElement }
  | { type: 'updateElement'; id: string; changes: Partial<ProjectElement> }
  | { type: 'updateMany'; ids: string[]; changes: Partial<ProjectElement> }
  | { type: 'deleteSelection' }
  | { type: 'applyDocument'; elements: ProjectElement[]; designSettings: Project['design_settings']; revision: number; headRevision: number; locale?: Locale }
  | { type: 'markSaved'; revision: number; headRevision: number; keepDirty?: boolean }
  | { type: 'setHistoryBusy'; busy: boolean }
  | { type: 'addLayer'; locale?: Locale }
  | { type: 'updateLayer'; id: string; changes: Partial<PlanLayer> }
  | { type: 'removeLayer'; id: string }
  | { type: 'setActiveLayer'; id: string }
  | { type: 'assignSelectionToLayer'; id: string }
  | { type: 'markClean' }
  | { type: 'setError'; error: string }
  | { type: 'clearError' };

const WORLD_PER_PIXEL = 1;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function boundZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function replaceInArray<T extends ProjectElement>(arr: T[], id: string, next: T): T[] {
  return arr.map((el) => (el.id === id ? next : el));
}

function propagateEndpointChange(
  elements: ProjectElement[],
  changedId: string,
  oldStart: Point,
  oldEnd: Point,
  newStart: Point,
  newEnd: Point,
): ProjectElement[] {
  return elements.map((el) => {
    if (el.id === changedId) return el;
    // Elements whose x1..x2 are derived geometry (polyline bbox, arc chord,
    // circle radius point) must not participate in shared-endpoint propagation.
    const mode = drawModeOf(el.element_type);
    if (mode === 'poly' || mode === 'arc' || mode === 'center') return el;
    let next = { ...el };
    if (pointsEqual({ x: el.x1, y: el.y1 }, oldStart)) {
      next.x1 = newStart.x;
      next.y1 = newStart.y;
    } else if (pointsEqual({ x: el.x1, y: el.y1 }, oldEnd)) {
      next.x1 = newEnd.x;
      next.y1 = newEnd.y;
    }
    if (pointsEqual({ x: el.x2, y: el.y2 }, oldStart)) {
      next.x2 = newStart.x;
      next.y2 = newStart.y;
    } else if (pointsEqual({ x: el.x2, y: el.y2 }, oldEnd)) {
      next.x2 = newEnd.x;
      next.y2 = newEnd.y;
    }
    if (next.x1 !== el.x1 || next.y1 !== el.y1 || next.x2 !== el.x2 || next.y2 !== el.y2) {
      next.length = distance({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 });
      next.rotation = Math.atan2(next.y2 - next.y1, next.x2 - next.x1);
    }
    return next;
  });
}

function applySnap(point: Point, elements: ProjectElement[], zoom: number, tool?: Tool, fromPoint?: Point): SnapResult | null {
  if (elements.length === 0) return null;
  if (tool === 'wall') return snapForWall(point, elements, zoom, WORLD_PER_PIXEL, undefined, fromPoint);
  return snapToNearest(point, elements, zoom, WORLD_PER_PIXEL, undefined, fromPoint);
}

function normalizeRectCorners<T extends ProjectElement>(el: T): T {
  const minX = Math.min(el.x1, el.x2);
  const minY = Math.min(el.y1, el.y2);
  const maxX = Math.max(el.x1, el.x2);
  const maxY = Math.max(el.y1, el.y2);
  // ``rotation`` lives on the bbox center and must survive corner swaps.
  if (el.x1 === minX && el.y1 === minY && el.x2 === maxX && el.y2 === maxY) return el;
  return { ...el, x1: minX, y1: minY, x2: maxX, y2: maxY, length: Math.max(1, maxX - minX) };
}

function wallNeedsJoinRecompute(
  wall: WallElement,
  changes: Partial<ProjectElement>,
): boolean {
  if (!wall.properties.join_host_id) return false;
  if (changes.x1 !== undefined || changes.y1 !== undefined || changes.x2 !== undefined || changes.y2 !== undefined) return true;
  if (changes.length !== undefined) return true;
  if (changes.properties && ('join_angle' in changes.properties || 'join_mode' in changes.properties)) return true;
  return false;
}

function applyElementChanges(
  el: ProjectElement,
  changes: Partial<ProjectElement>,
  allElements: ProjectElement[],
): ProjectElement {
  let next = { ...el } as ProjectElement;
  if ('properties' in changes && changes.properties) {
    next.properties = { ...next.properties, ...changes.properties } as typeof next.properties;
  }
  if (changes.x1 !== undefined) next.x1 = changes.x1;
  if (changes.y1 !== undefined) next.y1 = changes.y1;
  if (changes.x2 !== undefined) next.x2 = changes.x2;
  if (changes.y2 !== undefined) next.y2 = changes.y2;
  if (changes.rotation !== undefined) next.rotation = changes.rotation;
  if (changes.material_id !== undefined) next.material_id = changes.material_id;
  if (changes.section_id !== undefined) next.section_id = changes.section_id;
  const mode = drawModeOf(next.element_type);
  if (mode === 'center') {
    // Circle: ``x1,y1`` is the center and ``properties.radius`` is
    // authoritative; ``x2`` always mirrors the point at (cx + r, cy).
    let radius = (next.properties as { radius?: number }).radius ?? Math.abs(next.x2 - next.x1);
    if (changes.length !== undefined) radius = Math.max(1, changes.length / (2 * Math.PI));
    const propRadius = (changes.properties as { radius?: number } | undefined)?.radius;
    if (typeof propRadius === 'number') radius = Math.max(1, propRadius);
    const centerMoved = changes.x1 !== undefined || changes.y1 !== undefined;
    if (!centerMoved && (changes.x2 !== undefined || changes.y2 !== undefined)) {
      radius = Math.max(1, distance({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }));
    }
    next.x2 = next.x1 + radius;
    next.y2 = next.y1;
    next.length = 2 * Math.PI * radius;
    next.rotation = 0;
    next.properties = { ...next.properties, radius } as typeof next.properties;
    return next;
  }
  if (mode === 'poly') {
    // Translate the whole vertex chain when the stored bbox corners move.
    const dx = (changes.x1 ?? el.x1) - el.x1 || (changes.x2 ?? el.x2) - el.x2;
    const dy = (changes.y1 ?? el.y1) - el.y1 || (changes.y2 ?? el.y2) - el.y2;
    if (!dx && !dy) {
      if (changes.properties) next.properties = { ...next.properties } as typeof next.properties;
      return next;
    }
    const points = ((next.properties as { points?: Point[] }).points ?? []).map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return {
      ...next,
      x1: el.x1 + dx,
      y1: el.y1 + dy,
      x2: el.x2 + dx,
      y2: el.y2 + dy,
      properties: { ...next.properties, points },
    } as ProjectElement;
  }
  if (mode === 'arc' && (changes.x1 !== undefined || changes.y1 !== undefined || changes.x2 !== undefined || changes.y2 !== undefined)) {
    const arc = next as ArcElement;
    const start = { x: next.x1, y: next.y1 };
    const end = { x: next.x2, y: next.y2 };
    const isTranslate =
      changes.x1 !== undefined && changes.x2 !== undefined &&
      isClose(changes.x1 - el.x1, changes.x2 - el.x2) && isClose((changes.y1 ?? el.y1) - el.y1, (changes.y2 ?? el.y2) - el.y2);
    if (isTranslate) {
      const dx = changes.x1! - el.x1;
      const dy = (changes.y1 ?? el.y1) - el.y1;
      const props = arc.properties;
      next.properties = { ...props, cx: props.cx + dx, cy: props.cy + dy, mid: { x: props.mid.x + dx, y: props.mid.y + dy } } as typeof next.properties;
      return next;
    }
    const spec = arcSpecFromPoints(start, arc.properties.mid, end);
    if (!spec) return el;
    const sweep = spec.clockwise ? ccwSweep(spec.end_angle, spec.start_angle) : ccwSweep(spec.start_angle, spec.end_angle);
    next.length = Math.max(1, spec.radius * sweep);
    next.rotation = 0;
    next.properties = { ...next.properties, ...spec } as typeof next.properties;
    return next;
  }
  if (changes.length !== undefined) {
    if (next.element_type === 'wall') {
      next = updateWallLength(next as WallElement, cmToMeters(changes.length));
    } else if (next.element_type === 'beam') {
      next = updateBeamLength(next, cmToMeters(changes.length));
    } else if (mode === 'rect') {
      next = updateRectSize(next, changes.length, Math.abs(next.y2 - next.y1));
    } else if (mode === 'line') {
      const dir = { x: Math.cos(next.rotation), y: Math.sin(next.rotation) };
      next = { ...next, length: changes.length, x2: next.x1 + dir.x * changes.length, y2: next.y1 + dir.y * changes.length };
    } else {
      next = { ...next, length: changes.length };
    }
  } else if (mode === 'line' && changes.rotation !== undefined) {
    const length = distance({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 });
    next = {
      ...next,
      x2: next.x1 + Math.cos(changes.rotation) * length,
      y2: next.y1 + Math.sin(changes.rotation) * length,
      length,
    };
    if (next.element_type === 'beam') {
      next.properties = { ...next.properties, length: cmToMeters(next.length) };
    }
  } else if (changes.x1 !== undefined || changes.y1 !== undefined || changes.x2 !== undefined || changes.y2 !== undefined) {
    if (mode === 'rect') {
      next = normalizeRectCorners(next);
    } else {
      const start = { x: next.x1, y: next.y1 };
      const end = { x: next.x2, y: next.y2 };
      next.length = distance(start, end);
      next.rotation = Math.atan2(end.y - start.y, end.x - start.x);
      if (next.element_type === 'beam') {
        next.properties = { ...next.properties, length: cmToMeters(next.length) };
      }
    }
  }
  if (mode === 'rect' && changes.properties) {
    const widthM = (changes.properties as Record<string, unknown>).width;
    const depthM = (changes.properties as Record<string, unknown>).depth;
    if (typeof widthM === 'number' || typeof depthM === 'number') {
      const size = Math.abs(next.x2 - next.x1);
      const depth = Math.abs(next.y2 - next.y1);
      next = updateRectSize(next, typeof widthM === 'number' ? metersToCm(widthM) : size, typeof depthM === 'number' ? metersToCm(depthM) : depth);
    }
  }
  if (next.element_type === 'wall' && wallNeedsJoinRecompute(next as WallElement, changes)) {
    next = recomputeWallJoin(next as WallElement, allElements);
  }
  return next;
}

function withLayer(element: ProjectElement, layerId: string): ProjectElement {
  return { ...element, properties: { ...element.properties, layer_id: layerId } } as ProjectElement;
}

/* ------------------------------------------------------------------ */
/* Edit sessions (week 9)                                               */
/* ------------------------------------------------------------------ */

function editableSelection(state: EditorState): string[] {
  const wanted = new Set(state.selectedIds);
  return state.elements
    .filter((el) => wanted.has(el.id) && !isElementLocked(el, state.layers))
    .map((el) => el.id);
}

function newEditSession(op: EditOp): EditSession {
  return {
    op,
    phase: 'pick',
    ids: [],
    base: null,
    ref: null,
    cursor: null,
    pickedId: null,
    value: null,
    angle: null,
    rows: 2,
    cols: 2,
    count: 6,
    fill: null,
    snap: null,
  };
}

/** Swap edited elements in and append clones — one document change, one
 *  dirty flag; persistence rides the existing PUT + revision flow. */
function commitEdits(state: EditorState, replaced: ProjectElement[], added: ProjectElement[]): EditorState {
  const byId = new Map(replaced.map((el) => [el.id, el]));
  const elements = state.elements.map((el) => byId.get(el.id) ?? el).concat(added);
  return { ...state, elements, dirty: true };
}

/** Cursor point with object snapping applied (edit sessions share the draw
 *  tools' snap behaviour). ``exact`` bypasses snapping for typed input. */
function editSnapPoint(state: EditorState, point: Point, exact?: boolean): { point: Point; snap: SnapResult | null } {
  if (exact || !state.snapEnabled) return { point, snap: null };
  const snap = snapToNearest(point, state.elements, state.viewport.zoom, WORLD_PER_PIXEL);
  return { point: snap?.point ?? point, snap };
}

function dedupePoints(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || !pointsEqual(p, points[i - 1]));
}

function makeElementFromDraft(draft: DraftState, projectId: string, close = false): ProjectElement | null {
  const id = crypto.randomUUID();
  let start = draft.start;
  let end = draft.end;
  const mode = draft.tool === 'select' ? null : drawModeOf(draft.tool);
  if (draft.tool === 'wall' && draft.host && draft.joinAt) {
    const hostStart = { x: draft.host.x1, y: draft.host.y1 };
    const hostEnd = { x: draft.host.x2, y: draft.host.y2 };
    if (draft.joinAt === 'start') {
      end = resolveTJoin(start, hostStart, hostEnd, end, 90);
    } else if (draft.joinAt === 'end') {
      start = resolveTJoin(end, hostStart, hostEnd, start, 90);
    }
  }
  if (mode === 'rect') {
    if (Math.abs(end.x - start.x) < 5 || Math.abs(end.y - start.y) < 5) return null;
  } else if (mode === 'line' && distance(start, end) < 0.1) {
    return null;
  } else if (mode === 'center' && distance(start, end) < 0.1) {
    return null;
  }
  switch (draft.tool) {
    case 'wall': {
      const props = draft.host
        ? { join_target: draft.joinAt, join_host_id: draft.host.id, join_mode: 'perpendicular' as const, join_angle: 90 }
        : {};
      return createWall(id, projectId, start, end, props);
    }
    case 'door':
      return createDoor(id, projectId, start, end);
    case 'window':
      return createWindow(id, projectId, start, end);
    case 'beam':
      return createBeam(id, projectId, start, end);
    case 'joist':
      return createJoist(id, projectId, start, end);
    case 'grade_beam':
      return createGradeBeam(id, projectId, start, end);
    case 'brace':
      return createBrace(id, projectId, start, end);
    case 'column':
      return createColumn(id, projectId, end);
    case 'pile':
      return createPile(id, projectId, end);
    case 'slab':
      return createSlab(id, projectId, start, end);
    case 'footing':
      return createFooting(id, projectId, start, end);
    case 'stair':
      return createStair(id, projectId, start, end);
    case 'ramp':
      return createRamp(id, projectId, start, end);
    case 'opening':
      return createOpening(id, projectId, start, end);
    case 'line':
      return createLine(id, projectId, start, end);
    case 'polyline': {
      const points = dedupePoints(draft.vertices);
      if (points.length < 2) return null;
      return createPolyline(id, projectId, points, close);
    }
    case 'arc': {
      if (draft.vertices.length < 2 || distance(draft.vertices[0], end) < 0.1) return null;
      return createArc(id, projectId, draft.vertices[0], draft.vertices[1], end);
    }
    case 'circle':
      return createCircle(id, projectId, start, distance(start, end));
    case 'ellipse':
      return createEllipse(id, projectId, start, end);
    case 'rectangle':
      return createRectangle(id, projectId, start, end);
    case 'hatch':
      return createHatch(id, projectId, start, end);
    default:
      return null;
  }
}

const MUTATING_ACTIONS: ReadonlySet<EditorAction['type']> = new Set([
  'beginDraft',
  'updateDraft',
  'extendDraft',
  'commitDraft',
  'cancelDraft',
  'armEdit',
  'editPick',
  'editPickMany',
  'editDone',
  'editValue',
  'cancelEdit',
  'replaceElement',
  'updateElement',
  'updateMany',
  'deleteSelection',
  'addLayer',
  'updateLayer',
  'removeLayer',
  'assignSelectionToLayer',
]);

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (state.readOnly && MUTATING_ACTIONS.has(action.type)) return state;
  switch (action.type) {
    case 'load': {
      const elements = (action.project.elements ?? []).map(normalizeElement);
      const layers = ensureLayers(action.project.design_settings?.layers, action.locale);
      return {
        ...state,
        elements,
        layers,
        activeLayerId: layers[0].id,
        selectedIds: [],
        draft: null,
        edit: null,
        dirty: false,
        readOnly: action.project.access_role === 'viewer',
        revision: action.project.current_revision ?? 0,
        headRevision: action.project.head_revision ?? 0,
        historyBusy: false,
      };
    }
    case 'setTool':
      if (state.readOnly && action.tool !== 'select') return state;
      return { ...state, tool: action.tool, draft: null, edit: null };
    case 'setSection':
      return { ...state, activeSection: action.section };
    case 'select': {
      if (action.add) {
        const has = state.selectedIds.includes(action.id);
        return {
          ...state,
          tool: 'select',
          selectedIds: has ? state.selectedIds.filter((id) => id !== action.id) : [...state.selectedIds, action.id],
        };
      }
      return { ...state, tool: 'select', selectedIds: [action.id] };
    }
    case 'selectMany':
      return { ...state, selectedIds: action.ids };
    case 'selectBox':
      return { ...state, selectedIds: action.ids };
    case 'addLayer': {
      const layer = createLayer(state.layers.length, action.locale);
      return { ...state, layers: [...state.layers, layer], activeLayerId: layer.id, dirty: true };
    }
    case 'updateLayer':
      return {
        ...state,
        layers: state.layers.map((layer) => (layer.id === action.id ? { ...layer, ...action.changes } : layer)),
        dirty: true,
      };
    case 'removeLayer': {
      if (state.layers.length <= 1) return state;
      const remaining = state.layers.filter((layer) => layer.id !== action.id);
      const fallbackId = remaining[0].id;
      const elements = state.elements.map((element) =>
        (element.properties.layer_id ?? defaultLayerFor(element.element_type)) === action.id
          ? withLayer(element, fallbackId)
          : element,
      );
      return {
        ...state,
        layers: remaining,
        elements,
        activeLayerId: state.activeLayerId === action.id ? fallbackId : state.activeLayerId,
        dirty: true,
      };
    }
    case 'setActiveLayer':
      return { ...state, activeLayerId: action.id };
    case 'assignSelectionToLayer': {
      if (state.selectedIds.length === 0) return state;
      const elements = state.elements.map((element) =>
        state.selectedIds.includes(element.id) ? withLayer(element, action.id) : element,
      );
      return { ...state, elements, dirty: true };
    }
    case 'clearSelection':
      return { ...state, selectedIds: [] };
    case 'toggleGrid':
      return { ...state, showGrid: !state.showGrid };
    case 'toggleSnap':
      return { ...state, snapEnabled: !state.snapEnabled };
    case 'togglePolar':
      return { ...state, polarEnabled: !state.polarEnabled };
    case 'toggleCleanMode':
      return { ...state, cleanMode: !state.cleanMode };
    case 'setZoom':
      return { ...state, viewport: { ...state.viewport, zoom: boundZoom(action.zoom) } };
    case 'zoomIn':
      return { ...state, viewport: { ...state.viewport, zoom: boundZoom(state.viewport.zoom * 1.1) } };
    case 'zoomOut':
      return { ...state, viewport: { ...state.viewport, zoom: boundZoom(state.viewport.zoom / 1.1) } };
    case 'pan':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          pan: { x: state.viewport.pan.x + action.delta.x, y: state.viewport.pan.y + action.delta.y },
        },
      };
    case 'fit':
      return { ...state, viewport: { zoom: 1, pan: { x: 0, y: 0 } } };
    case 'beginDraft': {
      if (state.tool === 'select') return state;
      const columnAnchor = state.tool === 'wall' ? findColumnContainingPoint(action.point, state.elements) : null;
      const wallStart = columnAnchor ? snapWallStart(action.point, action.point, state.elements) : null;
      const snap = wallStart ?? (state.snapEnabled
        ? (state.tool === 'column'
            ? snapForColumn(action.point, state.elements, state.viewport.zoom, WORLD_PER_PIXEL)
            : applySnap(action.point, state.elements, state.viewport.zoom, state.tool))
        : null);
      const start = snap ? snap.point : action.point;
      const isStartT = snap?.target.type === 'midpoint';
      return {
        ...state,
        draft: {
          tool: state.tool,
          start,
          startInput: action.point,
          columnAnchorId: columnAnchor?.id ?? null,
          end: start,
          vertices: [start],
          snap,
          host: isStartT && snap ? state.elements.find((el) => 'elementId' in snap.target && el.id === snap.target.elementId) ?? null : null,
          joinAt: isStartT ? 'start' : null,
          polar: false,
        },
      };
    }
    case 'updateDraft': {
      if (!state.draft) return state;
      const { draft } = state;
      const raw = action.point;
      // Typed coordinates are exact: bypass snapping, joins and polar tracking.
      if (action.exact) {
        return { ...state, draft: { ...draft, end: raw, snap: null, polar: false } };
      }
      const anchoredStart = draft.tool === 'wall' && draft.columnAnchorId
        ? snapWallStart(draft.startInput, raw, state.elements)
        : null;
      const start = anchoredStart?.point ?? draft.start;

      const mode = draft.tool === 'select' ? 'line' : drawModeOf(draft.tool);
      if (mode === 'point') {
        let endSnap = state.snapEnabled
          ? (draft.tool === 'column'
              ? snapForColumn(raw, state.elements, state.viewport.zoom, WORLD_PER_PIXEL)
              : snapToNearest(raw, state.elements, state.viewport.zoom, WORLD_PER_PIXEL))
          : null;
        if (endSnap && pointsEqual(endSnap.point, draft.start)) endSnap = null;
        const end = endSnap ? endSnap.point : raw;
        return { ...state, draft: { ...draft, end, snap: endSnap } };
      }

      if (mode === 'rect') {
        let endSnap = state.snapEnabled ? snapToNearest(raw, state.elements, state.viewport.zoom, WORLD_PER_PIXEL) : null;
        if (endSnap && pointsEqual(endSnap.point, draft.start)) endSnap = null;
        const end = endSnap ? endSnap.point : raw;
        return { ...state, draft: { ...draft, end, snap: endSnap } };
      }

      let endSnap = state.snapEnabled ? applySnap(raw, state.elements, state.viewport.zoom, draft.tool, draft.start) : null;
      if (endSnap && pointsEqual(endSnap.point, draft.start)) endSnap = null;
      let end = raw;
      let host = draft.host;
      let joinAt = draft.joinAt;
      if (joinAt === 'start' && host) {
        const hostStart = { x: host.x1, y: host.y1 };
        const hostEnd = { x: host.x2, y: host.y2 };
        const ref = endSnap && endSnap.target.type !== 'midpoint' ? endSnap.point : raw;
        end = resolveTJoin(start, hostStart, hostEnd, ref, 90);
      } else if (endSnap?.target.type === 'midpoint') {
        end = endSnap.point;
        const endSnapTarget = endSnap.target;
        const hostEl = 'elementId' in endSnapTarget ? state.elements.find((el) => el.id === endSnapTarget.elementId) : undefined;
        if (hostEl) {
          host = hostEl;
          joinAt = 'end';
          const hostStart = { x: hostEl.x1, y: hostEl.y1 };
          const hostEnd = { x: hostEl.x2, y: hostEl.y2 };
          const newStart = resolveTJoin(end, hostStart, hostEnd, draft.start, 90);
          return {
            ...state,
            draft: { ...draft, start: newStart, end, snap: endSnap, host, joinAt },
          };
        }
      } else if (endSnap) {
        end = endSnap.point;
      }
      let polar = false;
      if (!endSnap && !host && state.polarEnabled) {
        const polarResult = polarSnapPoint(start, end);
        end = polarResult.point;
        polar = polarResult.locked;
      }
      return { ...state, draft: { ...draft, start, end, snap: anchoredStart ?? endSnap, host, joinAt, polar } };
    }
    case 'extendDraft': {
      if (!state.draft) return state;
      const { draft } = state;
      const mode = draft.tool === 'select' ? null : drawModeOf(draft.tool);
      if (mode !== 'poly' && mode !== 'arc') return state;
      const point = draft.end;
      if (pointsEqual(point, draft.vertices[draft.vertices.length - 1])) return state;
      return {
        ...state,
        draft: {
          ...draft,
          vertices: [...draft.vertices, point],
          // Polylines chain segments: the last vertex anchors the next one.
          start: mode === 'poly' ? point : draft.start,
          polar: false,
        },
      };
    }
    case 'commitDraft': {
      if (!state.draft) return state;
      const projectId = state.elements[0]?.project_id ?? '';
      const created = makeElementFromDraft(state.draft, projectId, action.close);
      if (!created) return { ...state, draft: null };
      if (created.element_type === 'wall') {
        const elementsWithCreated = state.elements.concat(created);
        if (isPointInsideColumn({ x: created.x1, y: created.y1 }, elementsWithCreated) || isPointInsideColumn({ x: created.x2, y: created.y2 }, elementsWithCreated) || wallCrossesColumnInterior({ x: created.x1, y: created.y1 }, { x: created.x2, y: created.y2 }, elementsWithCreated)) {
          return { ...state, draft: null };
        }
      }
      const placed = withLayer(created, state.activeLayerId);
      return {
        ...state,
        elements: [...state.elements, placed],
        selectedIds: [placed.id],
        draft: null,
        tool: 'select',
        dirty: true,
      };
    }
    case 'cancelDraft':
      return { ...state, draft: null };
    case 'armEdit': {
      const session = newEditSession(action.op);
      if (CUTTER_OPS.has(action.op)) {
        const cutters = editableSelection(state);
        return {
          ...state,
          draft: null,
          tool: 'select',
          edit: { ...session, ids: cutters, phase: cutters.length ? 'apply' : 'pick' },
        };
      }
      if (PICK_FIRST_OPS.has(action.op)) {
        return { ...state, draft: null, tool: 'select', edit: { ...session, phase: 'base' } };
      }
      const targets = editableSelection(state);
      return {
        ...state,
        draft: null,
        tool: 'select',
        edit: { ...session, ids: targets, phase: targets.length ? 'base' : 'pick' },
      };
    }
    case 'editCursor': {
      const edit = state.edit;
      if (!edit) return state;
      const { point, snap } = editSnapPoint(state, action.point);
      return { ...state, edit: { ...edit, cursor: point, snap } };
    }
    case 'editPick': {
      const edit = state.edit;
      if (!edit) return state;
      const { point, snap } = editSnapPoint(state, action.point, action.exact);
      const clicked = action.elementId
        ? state.elements.find((el) => el.id === action.elementId) ?? null
        : null;
      if (clicked && isElementLocked(clicked, state.layers)) return state;
      const touched: EditSession = { ...edit, cursor: point, snap };

      switch (edit.phase) {
        case 'pick': {
          if (!clicked) return { ...state, edit: touched };
          const has = edit.ids.includes(clicked.id);
          const ids = has ? edit.ids.filter((id) => id !== clicked.id) : [...edit.ids, clicked.id];
          return { ...state, edit: { ...touched, ids } };
        }
        case 'base': {
          if (edit.op === 'offset' || edit.op === 'fillet') {
            if (!clicked || (edit.op === 'fillet' && drawModeOf(clicked.element_type) !== 'line')) {
              return { ...state, edit: touched };
            }
            return { ...state, edit: { ...touched, pickedId: clicked.id, phase: 'target' } };
          }
          return { ...state, edit: { ...touched, base: point, phase: edit.op === 'scale' ? 'ref' : 'target' } };
        }
        case 'ref': {
          if (edit.base && distance(point, edit.base) < 1e-6) return { ...state, edit: touched };
          return { ...state, edit: { ...touched, ref: point, phase: 'target' } };
        }
        case 'target': {
          if (edit.op === 'fillet') {
            if (!clicked || clicked.id === edit.pickedId || drawModeOf(clicked.element_type) !== 'line') {
              return { ...state, edit: touched };
            }
            const first = state.elements.find((el) => el.id === edit.pickedId);
            if (!first) return { ...state, edit: null };
            const result = filletLines(first, clicked, edit.value ?? 0);
            if (!result) return { ...state, edit: { ...touched, phase: 'base', pickedId: null } };
            const sourceLayer = (first.properties as { layer_id?: string | null }).layer_id;
            const additions = result.arc ? [withLayer(result.arc, sourceLayer ?? state.activeLayerId)] : [];
            const committed = commitEdits(state, [result.a, result.b], additions);
            return { ...committed, edit: { ...touched, phase: 'base', pickedId: null } };
          }
          if (edit.op === 'offset') {
            const source = state.elements.find((el) => el.id === edit.pickedId);
            if (!source) return { ...state, edit: null };
            const copy = offsetElement(source, point, edit.value ?? undefined);
            if (!copy) return { ...state, edit: touched };
            const committed = commitEdits(state, [], [copy]);
            return { ...committed, edit: touched };
          }
          const outcome = applyTransform(touched, state.elements);
          if (!outcome || (!outcome.replaced.length && !outcome.added.length)) {
            return { ...state, edit: touched };
          }
          const committed = commitEdits(state, outcome.replaced, outcome.added);
          // COPY stays armed for repeated placements, like AutoCAD.
          if (edit.op === 'copy') return { ...committed, edit: touched };
          return { ...committed, edit: null };
        }
        case 'apply': {
          if (!clicked || edit.ids.includes(clicked.id)) return { ...state, edit: touched };
          const partners = state.elements.filter((el) => edit.ids.includes(el.id));
          const result = edit.op === 'trim' ? bestTrim(clicked, partners, point) : bestExtend(clicked, partners, point);
          if (!result) return { ...state, edit: touched };
          return { ...state, elements: replaceInArray(state.elements, clicked.id, result), dirty: true, edit: touched };
        }
        default:
          return state;
      }
    }
    case 'editPickMany': {
      const edit = state.edit;
      if (!edit || edit.phase !== 'pick') return state;
      const allowed = new Set(
        state.elements.filter((el) => !isElementLocked(el, state.layers)).map((el) => el.id),
      );
      const ids = [...edit.ids];
      for (const id of action.ids) {
        if (allowed.has(id) && !ids.includes(id)) ids.push(id);
      }
      return { ...state, edit: { ...edit, ids } };
    }
    case 'editDone': {
      const edit = state.edit;
      if (!edit) return state;
      if (edit.phase === 'pick') {
        if (!edit.ids.length) return { ...state, edit: null };
        return { ...state, edit: { ...edit, phase: CUTTER_OPS.has(edit.op) ? 'apply' : 'base' } };
      }
      return { ...state, edit: null };
    }
    case 'editValue': {
      const edit = state.edit;
      if (!edit) return state;
      const text = action.text.trim().replace(/\s+/g, '');
      if (!text) return state;
      const sizeMatch = text.match(/^(-?\d+(?:\.\d+)?)[x×](-?\d+(?:\.\d+)?)$/i);
      const numberMatch = /^-?\d+(?:\.\d+)?$/.test(text);

      // Arrays take grid/fill parameters typed before the point clicks.
      if (edit.op === 'arrayRect' && sizeMatch) {
        return {
          ...state,
          edit: {
            ...edit,
            rows: Math.max(1, Math.round(Number(sizeMatch[1]))),
            cols: Math.max(1, Math.round(Number(sizeMatch[2]))),
          },
        };
      }
      if (edit.op === 'arrayPolar') {
        // Both ``NxD`` and ``N<D`` carry count + fill angle for a polar array.
        const countAngle = sizeMatch ?? text.match(/^(\d+(?:\.\d+)?)<(-?\d+(?:\.\d+)?)$/);
        if (countAngle) {
          return {
            ...state,
            edit: {
              ...edit,
              count: Math.max(2, Math.round(Number(countAngle[1]))),
              fill: toRadians(Number(countAngle[2])),
            },
          };
        }
        if (numberMatch) {
          return { ...state, edit: { ...edit, count: Math.max(2, Math.round(Number(text))) } };
        }
      }
      if (numberMatch) {
        const numeric = Number(text);
        if (edit.op === 'rotate' && edit.base) {
          const outcome = applyTransform({ ...edit, angle: toRadians(numeric) }, state.elements);
          if (outcome && outcome.replaced.length) {
            return { ...commitEdits(state, outcome.replaced, outcome.added), edit: null };
          }
          return state;
        }
        if (edit.op === 'scale' && edit.base && numeric > 0) {
          const outcome = applyTransform({ ...edit, value: numeric }, state.elements);
          if (outcome && outcome.replaced.length) {
            return { ...commitEdits(state, outcome.replaced, outcome.added), edit: null };
          }
          return state;
        }
        if (edit.op === 'offset' || edit.op === 'fillet') {
          return { ...state, edit: { ...edit, value: displayToCm(numeric, action.unit) } };
        }
        if ((edit.op === 'move' || edit.op === 'copy') && edit.base && edit.cursor) {
          // Direct-distance entry: a bare number displaces along the cursor.
          const d = distance(edit.base, edit.cursor);
          if (d < 1e-6) return state;
          const gap = displayToCm(numeric, action.unit);
          const point = {
            x: edit.base.x + ((edit.cursor.x - edit.base.x) / d) * gap,
            y: edit.base.y + ((edit.cursor.y - edit.base.y) / d) * gap,
          };
          const outcome = applyTransform({ ...edit, cursor: point }, state.elements);
          if (!outcome || (!outcome.replaced.length && !outcome.added.length)) return state;
          const committed = commitEdits(state, outcome.replaced, outcome.added);
          if (edit.op === 'copy') return { ...committed, edit };
          return { ...committed, edit: null };
        }
      }
      // Coordinate input resolves to a pick at an exact (unsnapped) point.
      const command = parsePointInput(text);
      if (command && (command.kind === 'absolute' || command.kind === 'relative' || command.kind === 'polar')) {
        const origin = edit.base ?? edit.cursor ?? { x: 0, y: 0 };
        const point = resolvePoint(command, origin, action.unit);
        return editorReducer(state, { type: 'editPick', point, elementId: null, exact: true });
      }
      return state;
    }
    case 'cancelEdit':
      return { ...state, edit: null };
    case 'replaceElement': {
      const previous = state.elements.find((el) => el.id === action.element.id);
      if (!previous || isElementLocked(previous, state.layers)) return state;
      const oldStart = { x: previous.x1, y: previous.y1 };
      const oldEnd = { x: previous.x2, y: previous.y2 };
      let elements = replaceInArray(state.elements, previous.id, action.element);
      // Line-mode endpoint grips keep the shared-endpoint propagation the
      // old circular handles provided.
      if (drawModeOf(previous.element_type) === 'line') {
        const newStart = { x: action.element.x1, y: action.element.y1 };
        const newEnd = { x: action.element.x2, y: action.element.y2 };
        if (!pointsEqual(oldStart, newStart) || !pointsEqual(oldEnd, newEnd)) {
          elements = propagateEndpointChange(elements, previous.id, oldStart, oldEnd, newStart, newEnd);
        }
      }
      return { ...state, elements, dirty: true };
    }
    case 'updateElement': {
      const el = state.elements.find((e) => e.id === action.id);
      if (!el) return state;
      const layerChange = action.changes.properties && 'layer_id' in action.changes.properties;
      if (!layerChange && isElementLocked(el, state.layers)) return state;
      const oldStart = { x: el.x1, y: el.y1 };
      const oldEnd = { x: el.x2, y: el.y2 };
      const proposedStart = {
        x: action.changes.x1 ?? el.x1,
        y: action.changes.y1 ?? el.y1,
      };
      const proposedEnd = {
        x: action.changes.x2 ?? el.x2,
        y: action.changes.y2 ?? el.y2,
      };
      if (el.element_type === 'wall' && (isPointInsideColumn(proposedStart, state.elements) || isPointInsideColumn(proposedEnd, state.elements) || wallCrossesColumnInterior(proposedStart, proposedEnd, state.elements))) {
        return state;
      }
      const next = applyElementChanges(el, action.changes, state.elements);
      const newStart = { x: next.x1, y: next.y1 };
      const newEnd = { x: next.x2, y: next.y2 };
      let nextElements = replaceInArray(state.elements, action.id, next);
      nextElements = propagateEndpointChange(nextElements, action.id, oldStart, oldEnd, newStart, newEnd);
      return {
        ...state,
        elements: nextElements,
        dirty: true,
      };
    }
    case 'updateMany': {
      const ids = new Set(action.ids);
      const geometryKeys = ['x1', 'y1', 'x2', 'y2', 'length', 'rotation'] as const;
      const hasGeometryChange = geometryKeys.some((key) => action.changes[key] !== undefined);
      let changed = false;
      const elements = state.elements.map((el) => {
        if (!ids.has(el.id) || isElementLocked(el, state.layers)) return el;
        // Shared-endpoint propagation is ambiguous across a bulk edit, so it is
        // skipped here; geometry edits through updateMany affect each element
        // individually.
        if (hasGeometryChange && drawModeOf(el.element_type) === 'point') return el;
        changed = true;
        return applyElementChanges(el, action.changes, state.elements);
      });
      if (!changed) return state;
      return { ...state, elements, dirty: true };
    }
    case 'deleteSelection': {
      const removable = new Set(
        state.elements
          .filter((el) => state.selectedIds.includes(el.id) && !isElementLocked(el, state.layers))
          .map((el) => el.id),
      );
      if (removable.size === 0) return state;
      const remaining = state.elements.filter((el) => !removable.has(el.id));
      return {
        ...state,
        elements: remaining,
        selectedIds: [],
        dirty: true,
      };
    }
    case 'applyDocument': {
      const layers = ensureLayers(action.designSettings?.layers, action.locale);
      const activeLayerStillExists = layers.some((layer) => layer.id === state.activeLayerId);
      return {
        ...state,
        elements: action.elements.map(normalizeElement),
        layers,
        activeLayerId: activeLayerStillExists ? state.activeLayerId : layers[0].id,
        selectedIds: [],
        draft: null,
        edit: null,
        revision: action.revision,
        headRevision: action.headRevision,
        historyBusy: false,
        dirty: false,
      };
    }
    case 'markSaved':
      return {
        ...state,
        dirty: action.keepDirty ? state.dirty : false,
        revision: action.revision,
        headRevision: action.headRevision,
      };
    case 'setHistoryBusy':
      return { ...state, historyBusy: action.busy };
    case 'markClean':
      return { ...state, dirty: false };
    case 'setError':
      return { ...state, error: action.error };
    case 'clearError':
      return { ...state, error: '' };
    default:
      return state;
  }
}

const initialState: EditorState = {
  elements: [],
  tool: 'select',
  selectedIds: [],
  draft: null,
  edit: null,
  viewport: { zoom: 1, pan: { x: 0, y: 0 } },
  showGrid: false,
  snapEnabled: true,
  polarEnabled: true,
  cleanMode: false,
  activeSection: 'draw',
  layers: ensureLayers(undefined),
  activeLayerId: ensureLayers(undefined)[0].id,
  revision: 0,
  headRevision: 0,
  historyBusy: false,
  dirty: false,
  readOnly: false,
  error: '',
};

export function useEditorState(project: Project) {
  const { locale } = useLocale();
  const [state, dispatch] = useReducer(editorReducer, initialState, (init) =>
    editorReducer(init, { type: 'load', project, locale }),
  );

  const selectedElements = useMemo(
    () => state.elements.filter((el) => state.selectedIds.includes(el.id)),
    [state.elements, state.selectedIds],
  );

  const summary = useMemo(() => calculateSelectionSummary(selectedElements), [selectedElements]);

  const actions = useMemo(
    () => ({
      setTool: (tool: Tool) => dispatch({ type: 'setTool', tool }),
      setSection: (section: ActiveSection) => dispatch({ type: 'setSection', section }),
      select: (id: string, add: boolean) => dispatch({ type: 'select', id, add }),
      selectMany: (ids: string[]) => dispatch({ type: 'selectMany', ids }),
      selectBox: (ids: string[]) => dispatch({ type: 'selectBox', ids }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      toggleGrid: () => dispatch({ type: 'toggleGrid' }),
      toggleSnap: () => dispatch({ type: 'toggleSnap' }),
      togglePolar: () => dispatch({ type: 'togglePolar' }),
      toggleCleanMode: () => dispatch({ type: 'toggleCleanMode' }),
      setZoom: (zoom: number) => dispatch({ type: 'setZoom', zoom }),
      zoomIn: () => dispatch({ type: 'zoomIn' }),
      zoomOut: () => dispatch({ type: 'zoomOut' }),
      pan: (delta: Point) => dispatch({ type: 'pan', delta }),
      fit: () => dispatch({ type: 'fit' }),
      beginDraft: (point: Point) => dispatch({ type: 'beginDraft', point }),
      updateDraft: (point: Point, exact?: boolean) => dispatch({ type: 'updateDraft', point, exact }),
      extendDraft: () => dispatch({ type: 'extendDraft' }),
      commitDraft: (close?: boolean) => dispatch({ type: 'commitDraft', close }),
      cancelDraft: () => dispatch({ type: 'cancelDraft' }),
      armEdit: (op: EditOp) => dispatch({ type: 'armEdit', op }),
      editCursor: (point: Point) => dispatch({ type: 'editCursor', point }),
      editPick: (point: Point, elementId?: string | null, exact?: boolean) =>
        dispatch({ type: 'editPick', point, elementId, exact }),
      editPickMany: (ids: string[]) => dispatch({ type: 'editPickMany', ids }),
      editDone: () => dispatch({ type: 'editDone' }),
      editValue: (text: string, unit: DisplayUnit) => dispatch({ type: 'editValue', text, unit }),
      cancelEdit: () => dispatch({ type: 'cancelEdit' }),
      replaceElement: (element: ProjectElement) => dispatch({ type: 'replaceElement', element }),
      updateElement: (id: string, changes: Partial<ProjectElement>) => dispatch({ type: 'updateElement', id, changes }),
      updateMany: (ids: string[], changes: Partial<ProjectElement>) => dispatch({ type: 'updateMany', ids, changes }),
      deleteSelection: () => dispatch({ type: 'deleteSelection' }),
      applyDocument: (elements: ProjectElement[], designSettings: Project['design_settings'], revision: number, headRevision: number) =>
        dispatch({ type: 'applyDocument', elements, designSettings, revision, headRevision, locale }),
      markSaved: (revision: number, headRevision: number, keepDirty = false) => dispatch({ type: 'markSaved', revision, headRevision, keepDirty }),
      setHistoryBusy: (busy: boolean) => dispatch({ type: 'setHistoryBusy', busy }),
      addLayer: () => dispatch({ type: 'addLayer', locale }),
      updateLayer: (id: string, changes: Partial<PlanLayer>) => dispatch({ type: 'updateLayer', id, changes }),
      removeLayer: (id: string) => dispatch({ type: 'removeLayer', id }),
      setActiveLayer: (id: string) => dispatch({ type: 'setActiveLayer', id }),
      assignSelectionToLayer: (id: string) => dispatch({ type: 'assignSelectionToLayer', id }),
      markClean: () => dispatch({ type: 'markClean' }),
      setError: (error: string) => dispatch({ type: 'setError', error }),
      clearError: () => dispatch({ type: 'clearError' }),
      loadProject: (p: Project) => dispatch({ type: 'load', project: p, locale }),
    }),
    [locale],
  );

  return { state, actions, selectedElements, summary };
}
