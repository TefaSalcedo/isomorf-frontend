import { useReducer, useCallback, useMemo } from 'react';
import type { Point } from '@/lib/editor/geometry';
import type { PlanLayer, Project, ProjectElement, WallElement } from '@/types/project';
import {
  createColumn,
  createWall,
  createDoor,
  createWindow,
  createBeam,
  normalizeElement,
  updateWallLength,
  recomputeWallJoin,
  updateBeamLength,
  defaultDesignSettings,
} from '@/lib/editor/elements';
import { findColumnContainingPoint, isPointInsideColumn, snapForColumn, snapForWall, snapToNearest, snapWallStart, wallCrossesColumnInterior, type SnapResult } from '@/lib/editor/snapping';
import {
  cmToMeters,
  distance,
  pointsEqual,
  resolveTJoin,
} from '@/lib/editor/geometry';
import { calculateSelectionSummary } from '@/lib/editor/calculations';
import { createLayer, defaultLayerFor, ensureLayers, isElementLocked } from '@/lib/editor/layers';

export type Tool =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'beam';

export type ActiveSection =
  | 'home'
  | 'projects'
  | 'draw'
  | 'structure'
  | 'layers'
  | 'calculations'
  | 'settings';

export type DraftState = {
  tool: Tool;
  start: Point;
  startInput: Point;
  columnAnchorId: string | null;
  end: Point;
  snap: SnapResult | null;
  host: ProjectElement | null;
  joinAt: 'start' | 'end' | null;
};

export type EditorState = {
  elements: ProjectElement[];
  tool: Tool;
  selectedIds: string[];
  draft: DraftState | null;
  viewport: { zoom: number; pan: Point };
  showGrid: boolean;
  snapEnabled: boolean;
  cleanMode: boolean;
  activeSection: ActiveSection;
  layers: PlanLayer[];
  activeLayerId: string;
  past: ProjectElement[][];
  future: ProjectElement[][];
  dirty: boolean;
  error: string;
};

export type EditorAction =
  | { type: 'load'; project: Project }
  | { type: 'setTool'; tool: Tool }
  | { type: 'setSection'; section: ActiveSection }
  | { type: 'select'; id: string; add: boolean }
  | { type: 'selectMany'; ids: string[] }
  | { type: 'selectBox'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'toggleGrid' }
  | { type: 'toggleSnap' }
  | { type: 'toggleCleanMode' }
  | { type: 'setZoom'; zoom: number }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'pan'; delta: Point }
  | { type: 'fit' }
  | { type: 'beginDraft'; point: Point }
  | { type: 'updateDraft'; point: Point }
  | { type: 'commitDraft' }
  | { type: 'cancelDraft' }
  | { type: 'updateElement'; id: string; changes: Partial<ProjectElement> }
  | { type: 'deleteSelection' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'addLayer' }
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

function applySnap(point: Point, elements: ProjectElement[], zoom: number, tool?: Tool): SnapResult | null {
  if (elements.length === 0) return null;
  if (tool === 'wall') return snapForWall(point, elements, zoom, WORLD_PER_PIXEL);
  return snapToNearest(point, elements, zoom, WORLD_PER_PIXEL);
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
  if (changes.length !== undefined) {
    if (next.element_type === 'wall') {
      next = updateWallLength(next as WallElement, cmToMeters(changes.length));
    } else if (next.element_type === 'beam') {
      next = updateBeamLength(next, cmToMeters(changes.length));
    } else {
      next = { ...next, length: changes.length };
    }
  } else if (changes.x1 !== undefined || changes.y1 !== undefined || changes.x2 !== undefined || changes.y2 !== undefined) {
    const start = { x: next.x1, y: next.y1 };
    const end = { x: next.x2, y: next.y2 };
    next.length = distance(start, end);
    next.rotation = Math.atan2(end.y - start.y, end.x - start.x);
    if (next.element_type === 'beam') {
      next.properties = { ...next.properties, length: cmToMeters(next.length) };
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

function makeElementFromDraft(draft: DraftState, projectId: string): ProjectElement | null {
  const id = crypto.randomUUID();
  let start = draft.start;
  let end = draft.end;
  if (draft.tool === 'wall' && draft.host && draft.joinAt) {
    const hostStart = { x: draft.host.x1, y: draft.host.y1 };
    const hostEnd = { x: draft.host.x2, y: draft.host.y2 };
    if (draft.joinAt === 'start') {
      end = resolveTJoin(start, hostStart, hostEnd, end, 90);
    } else if (draft.joinAt === 'end') {
      start = resolveTJoin(end, hostStart, hostEnd, start, 90);
    }
  }
  if (draft.tool !== 'column' && distance(start, end) < 0.1) return null;
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
    case 'column':
      return createColumn(id, projectId, end);
    default:
      return null;
  }
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load': {
      const elements = (action.project.elements ?? []).map(normalizeElement);
      const layers = ensureLayers(action.project.design_settings?.layers);
      return {
        ...state,
        elements,
        layers,
        activeLayerId: layers[0].id,
        selectedIds: [],
        draft: null,
        dirty: false,
        past: [],
        future: [],
      };
    }
    case 'setTool':
      return { ...state, tool: action.tool, draft: null };
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
      const layer = createLayer(state.layers.length);
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
        past: [...state.past, state.elements],
        future: [],
      };
    }
    case 'setActiveLayer':
      return { ...state, activeLayerId: action.id };
    case 'assignSelectionToLayer': {
      if (state.selectedIds.length === 0) return state;
      const elements = state.elements.map((element) =>
        state.selectedIds.includes(element.id) ? withLayer(element, action.id) : element,
      );
      return { ...state, elements, dirty: true, past: [...state.past, state.elements], future: [] };
    }
    case 'clearSelection':
      return { ...state, selectedIds: [] };
    case 'toggleGrid':
      return { ...state, showGrid: !state.showGrid };
    case 'toggleSnap':
      return { ...state, snapEnabled: !state.snapEnabled };
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
          snap,
          host: isStartT && snap ? state.elements.find((el) => 'elementId' in snap.target && el.id === snap.target.elementId) ?? null : null,
          joinAt: isStartT ? 'start' : null,
        },
      };
    }
    case 'updateDraft': {
      if (!state.draft) return state;
      const { draft } = state;
      const raw = action.point;
      const anchoredStart = draft.tool === 'wall' && draft.columnAnchorId
        ? snapWallStart(draft.startInput, raw, state.elements)
        : null;
      const start = anchoredStart?.point ?? draft.start;

      if (draft.tool === 'column') {
        let endSnap = state.snapEnabled
          ? snapForColumn(raw, state.elements, state.viewport.zoom, WORLD_PER_PIXEL)
          : null;
        if (endSnap && pointsEqual(endSnap.point, draft.start)) endSnap = null;
        const end = endSnap ? endSnap.point : raw;
        return { ...state, draft: { ...draft, end, snap: endSnap } };
      }

      let endSnap = state.snapEnabled ? applySnap(raw, state.elements, state.viewport.zoom, draft.tool) : null;
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
      return { ...state, draft: { ...draft, start, end, snap: anchoredStart ?? endSnap, host, joinAt } };
    }
    case 'commitDraft': {
      if (!state.draft) return state;
      const projectId = state.elements[0]?.project_id ?? '';
      const created = makeElementFromDraft(state.draft, projectId);
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
        past: [...state.past, state.elements],
        future: [],
      };
    }
    case 'cancelDraft':
      return { ...state, draft: null };
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
        past: [...state.past, state.elements],
        future: [],
      };
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
        past: [...state.past, state.elements],
        future: [],
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        elements: previous,
        past: state.past.slice(0, -1),
        future: [state.elements, ...state.future],
        selectedIds: [],
        draft: null,
        dirty: true,
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        elements: next,
        past: [...state.past, state.elements],
        future: state.future.slice(1),
        selectedIds: [],
        draft: null,
        dirty: true,
      };
    }
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
  viewport: { zoom: 1, pan: { x: 0, y: 0 } },
  showGrid: false,
  snapEnabled: true,
  cleanMode: false,
  activeSection: 'draw',
  layers: ensureLayers(undefined),
  activeLayerId: ensureLayers(undefined)[0].id,
  past: [],
  future: [],
  dirty: false,
  error: '',
};

export function useEditorState(project: Project) {
  const [state, dispatch] = useReducer(editorReducer, initialState, (init) =>
    editorReducer(init, { type: 'load', project }),
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
      toggleCleanMode: () => dispatch({ type: 'toggleCleanMode' }),
      setZoom: (zoom: number) => dispatch({ type: 'setZoom', zoom }),
      zoomIn: () => dispatch({ type: 'zoomIn' }),
      zoomOut: () => dispatch({ type: 'zoomOut' }),
      pan: (delta: Point) => dispatch({ type: 'pan', delta }),
      fit: () => dispatch({ type: 'fit' }),
      beginDraft: (point: Point) => dispatch({ type: 'beginDraft', point }),
      updateDraft: (point: Point) => dispatch({ type: 'updateDraft', point }),
      commitDraft: () => dispatch({ type: 'commitDraft' }),
      cancelDraft: () => dispatch({ type: 'cancelDraft' }),
      updateElement: (id: string, changes: Partial<ProjectElement>) => dispatch({ type: 'updateElement', id, changes }),
      deleteSelection: () => dispatch({ type: 'deleteSelection' }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      addLayer: () => dispatch({ type: 'addLayer' }),
      updateLayer: (id: string, changes: Partial<PlanLayer>) => dispatch({ type: 'updateLayer', id, changes }),
      removeLayer: (id: string) => dispatch({ type: 'removeLayer', id }),
      setActiveLayer: (id: string) => dispatch({ type: 'setActiveLayer', id }),
      assignSelectionToLayer: (id: string) => dispatch({ type: 'assignSelectionToLayer', id }),
      markClean: () => dispatch({ type: 'markClean' }),
      setError: (error: string) => dispatch({ type: 'setError', error }),
      clearError: () => dispatch({ type: 'clearError' }),
      loadProject: (p: Project) => dispatch({ type: 'load', project: p }),
    }),
    [],
  );

  return { state, actions, selectedElements, summary };
}
