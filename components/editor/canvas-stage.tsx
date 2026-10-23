'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Stage, Layer, Line, Circle, Rect, Ellipse, Text, Label, Tag, Group } from 'react-konva';
import type Konva from 'konva';
import type { EditorState } from '@/hooks/use-editor-state';
import type { Point } from '@/lib/editor/geometry';
import { ccwSweep, distance, lineIntersection, sampleArcPoints, toRadians } from '@/lib/editor/geometry';
import { cmToDisplay, displayToCm, formatAngle, formatDisplayValue } from '@/lib/editor/units';
import type { ArcElement, CircleElement, DimKind, DimStyle, DrawMode, DimensionElement, PlanPoint, ProjectElement, TableElement } from '@/types/project';
import type { DisplayUnit } from '@/lib/editor/units';
import { parsePointInput, resolvePoint } from '@/lib/editor/coords';
import { hatchSegments } from '@/lib/editor/hatch';
import {
  COLUMN_DEFAULT_DEPTH,
  COLUMN_DEFAULT_WIDTH,
  PILE_DEFAULT_DIAMETER,
  arcSpecFromPoints,
  drawModeOf,
} from '@/lib/editor/elements';
import { snapForWall, snapPixelsForZoom, snapToNearest } from '@/lib/editor/snapping';
import { isElementLocked, isElementVisible, layerOf, resolveLineStyle } from '@/lib/editor/layers';
import { blockById, createBlockRef, instantiateBlock } from '@/lib/editor/blocks';
import type { PlanLayer } from '@/types/project';
import {
  applyGrip,
  elementInBox,
  gripsFor,
  outlineSegments,
  pickElementAt,
  previewEditOutcome,
  type BoxMode,
  type Grip,
} from '@/lib/editor/edit-ops';
import type { EditSession } from '@/hooks/use-editor-state';
import { activeDimStyle, dimensionGeometry, leaderGeometry, linearOrientation, paperToWorld, resolveDimStyle } from '@/lib/editor/annotations';

const GRID_STEP = 100;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

const COLORS = {
  canvas: '#0b1120',
  grid: '#1e293b',
  select: '#22d3ee',
  hover: '#67e8f9',
  intersection: '#475569',
  vertex: '#64748b',
  handleFill: '#0b1120',
};

function boundZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function drawMode(element: ProjectElement): DrawMode {
  return drawModeOf(element.element_type);
}

function isLineType(element: ProjectElement): boolean {
  return drawMode(element) === 'line';
}

function typeColor(element: ProjectElement): string {
  switch (element.element_type) {
    case 'wall': return '#e2e8f0';
    case 'door': return '#fbbf24';
    case 'window': return '#38bdf8';
    case 'column': return '#a78bfa';
    case 'beam': return '#94a3b8';
    case 'joist': return '#7dd3fc';
    case 'grade_beam': return '#c4b5fd';
    case 'brace': return '#fb7185';
    case 'pile': return '#f97316';
    case 'slab': return '#334155';
    case 'footing': return '#b45309';
    case 'stair': return '#34d399';
    case 'ramp': return '#f472b6';
    case 'opening': return '#94a3b8';
    case 'line': return '#cbd5e1';
    case 'polyline': return '#4ade80';
    case 'arc': return '#fb923c';
    case 'circle': return '#38bdf8';
    case 'ellipse': return '#a78bfa';
    case 'rectangle': return '#94a3b8';
    case 'hatch': return '#64748b';
    default: return '#cbd5e1';
  }
}

function relativeLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const channels = [0, 2, 4].map((index) => Number.parseInt(match[1].slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function resolveCanvasColor(color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  const backgroundLuminance = relativeLuminance(COLORS.canvas);
  if (!match || backgroundLuminance === null) return color;

  const channels = [0, 2, 4].map((index) => Number.parseInt(match[1].slice(index, index + 2), 16));
  const contrast = (rgb: number[]) => {
    const hex = `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
    const luminance = relativeLuminance(hex);
    if (luminance === null) return 1;
    return (Math.max(luminance, backgroundLuminance) + 0.05) / (Math.min(luminance, backgroundLuminance) + 0.05);
  };
  if (contrast(channels) >= 4.5) return color;

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const amount = (low + high) / 2;
    const candidate = channels.map((channel) => channel + (255 - channel) * amount);
    if (contrast(candidate) >= 4.5) high = amount;
    else low = amount;
  }
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * high).toString(16).padStart(2, '0')).join('')}`;
}

function fillFor(element: ProjectElement): string | null {
  switch (element.element_type) {
    case 'slab': return 'rgba(51, 65, 85, 0.45)';
    case 'footing': return 'rgba(180, 83, 9, 0.30)';
    case 'stair': return 'rgba(52, 211, 153, 0.12)';
    case 'ramp': return 'rgba(244, 114, 182, 0.12)';
    case 'opening': return 'rgba(11, 17, 32, 0.6)';
    default: return null;
  }
}

function colorFor(element: ProjectElement, selected: boolean, hovered: boolean, layers: PlanLayer[]): string {
  if (selected) return COLORS.select;
  if (hovered) return COLORS.hover;
  return resolveCanvasColor(layerOf(element, layers)?.color ?? typeColor(element));
}

function lineStyle(element: ProjectElement): { width: number; dash?: number[] } {
  switch (element.element_type) {
    case 'wall': return { width: (element.properties.thickness ?? 0.15) * 100 };
    case 'beam': return { width: Math.max(6, (element.properties.width ?? 0.2) * 100) };
    case 'joist': return { width: 3 };
    case 'grade_beam': return { width: Math.max(5, (element.properties.width ?? 0.3) * 100), dash: [14, 6] };
    case 'brace': return { width: 4, dash: [12, 4, 3, 4] };
    case 'door': return { width: 4, dash: [10, 4] };
    case 'window': return { width: 4, dash: [6, 4] };
    case 'line': return { width: 2 };
    default: return { width: 4 };
  }
}

/** Line-mode types whose stroke encodes a real plan dimension (wall
 *  thickness, beam width). ByLayer lineweight never overrides geometry —
 *  only style strokes adopt it. */
const GEOMETRY_WIDTH_TYPES: ReadonlySet<string> = new Set(['wall', 'beam', 'grade_beam']);

function worldFromScreen(screen: Point, pan: Point, zoom: number): Point {
  return { x: (screen.x - pan.x) / zoom, y: (screen.y - pan.y) / zoom };
}

function rectOf(element: ProjectElement): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(element.x1, element.x2),
    y: Math.min(element.y1, element.y2),
    w: Math.abs(element.x2 - element.x1),
    h: Math.abs(element.y2 - element.y1),
  };
}

function gridPoints(
  show: boolean,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
): number[] {
  if (!show || width === 0 || height === 0) return [];
  const left = (-pan.x) / zoom;
  const right = (width - pan.x) / zoom;
  const top = (-pan.y) / zoom;
  const bottom = (height - pan.y) / zoom;
  const startX = Math.floor(left / GRID_STEP) * GRID_STEP;
  const endX = Math.ceil(right / GRID_STEP) * GRID_STEP;
  const startY = Math.floor(top / GRID_STEP) * GRID_STEP;
  const endY = Math.ceil(bottom / GRID_STEP) * GRID_STEP;
  const points: number[] = [];
  for (let x = startX; x <= endX; x += GRID_STEP) {
    points.push(x, top, x, bottom);
  }
  for (let y = startY; y <= endY; y += GRID_STEP) {
    points.push(left, y, right, y);
  }
  return points;
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

type CanvasStageProps = {
  state: EditorState;
  displayUnit: DisplayUnit;
  annotationScale: number;
  dimStyles: DimStyle[];
  activeDimStyleId?: string | null;
  actions: {
    beginDraft: (point: Point, dimensionTarget?: ProjectElement) => void;
    updateDraft: (point: Point, exact?: boolean) => void;
    extendDraft: () => void;
    commitDraft: (close?: boolean, annotationScale?: number) => void;
    cancelDraft: () => void;
    select: (id: string, add: boolean) => void;
    selectMany: (ids: string[]) => void;
    clearSelection: () => void;
    updateElement: (id: string, changes: Partial<ProjectElement>) => void;
    setZoom: (zoom: number) => void;
    pan: (delta: Point) => void;
    setTool: (tool: EditorState['tool']) => void;
    editCursor: (point: Point) => void;
    editPick: (point: Point, elementId?: string | null, exact?: boolean) => void;
    editPickMany: (ids: string[]) => void;
    editDone: () => void;
    editValue: (text: string, unit: DisplayUnit) => void;
    cancelEdit: () => void;
    replaceElement: (element: ProjectElement) => void;
    armDimension: (kind: DimKind) => void;
    setAnnotationEditing: (id: string | null) => void;
    cancelAnnotationEditing: () => void;
  };
  stageRef: MutableRefObject<Konva.Stage | null>;
};

/** Which prompt line the HUD shows for the current edit phase. */
function editPromptKey(edit: EditSession): string {
  if (edit.phase === 'pick') return 'selectObjects';
  if (edit.phase === 'apply') return edit.op === 'trim' ? 'clickToTrim' : 'clickToExtend';
  switch (edit.op) {
    case 'offset': return edit.phase === 'base' ? 'pickFirst' : 'offsetSide';
    case 'fillet': return edit.phase === 'base' ? 'filletFirst' : 'filletSecond';
    case 'scale': return edit.phase === 'base' ? 'basePoint' : edit.phase === 'ref' ? 'referencePoint' : 'scaleFactor';
    case 'rotate': return edit.phase === 'base' ? 'basePoint' : 'rotateAngle';
    case 'mirror': return edit.phase === 'base' ? 'basePoint' : 'mirrorAxis';
    case 'arrayRect': return edit.phase === 'base' ? 'basePoint' : 'arrayCell';
    case 'arrayPolar': return edit.phase === 'base' ? 'arrayCenter' : 'arraySweep';
    default: return edit.phase === 'base' ? 'basePoint' : 'destination';
  }
}

export function CanvasStage({ state, displayUnit, annotationScale, dimStyles, activeDimStyleId, actions, stageRef }: CanvasStageProps) {
  const t = useTranslations('editor.canvas');
  const te = useTranslations('editor.edit');
  const { ref, size } = useContainerSize();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lengthInput, setLengthInput] = useState('');
  // Mirror of lengthInput for the keydown handler: React state updates are
  // async, so a fast Enter could otherwise parse a stale buffer.
  const lengthInputRef = useRef('');
  const pinchRef = useRef<{ distance: number; center: Point } | null>(null);
  const { zoom, pan } = state.viewport;
  const dimStyle = activeDimStyle(dimStyles, activeDimStyleId);
  const [editingCell, setEditingCell] = useState<{ id: string; row: number; col: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationAnchor, setAnnotationAnchor] = useState<Point | null>(null);
  const annotationInputRef = useRef<HTMLTextAreaElement | null>(null);
  const annotationEditingElement = state.elements.find((element) => element.id === state.annotationEditingId);
  const annotationEditorAnchor = annotationAnchor ?? (
    state.annotationEditingNew && (annotationEditingElement?.element_type === 'text' || annotationEditingElement?.element_type === 'leader')
      ? annotationEditingElement.element_type === 'leader'
        ? { x: annotationEditingElement.x2, y: annotationEditingElement.y2 }
        : { x: annotationEditingElement.x1, y: annotationEditingElement.y1 }
      : null
  );

  // Mirror of ``state`` for the persistent keydown listener: React batches
  // reducer updates, so a fast second keystroke could otherwise hit a stale
  // closure (e.g. re-running ``beginDraft`` instead of committing). The layout
  // effect refreshes the ref synchronously at commit — before the next event.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (!state.annotationEditingId || !state.annotationEditingNew) return;
    const element = state.elements.find((candidate) => candidate.id === state.annotationEditingId);
    if (!element || (element.element_type !== 'text' && element.element_type !== 'leader')) return;
    requestAnimationFrame(() => annotationInputRef.current?.focus());
  }, [state.annotationEditingId, state.annotationEditingNew, state.elements]);

  function openAnnotationEditor(element: ProjectElement, cell?: { row: number; col: number }) {
    if (state.readOnly) return;
    if (element.element_type === 'text' || element.element_type === 'leader') {
      setEditingCell(null);
      setAnnotationText(element.properties.text);
      setAnnotationAnchor(element.element_type === 'leader' ? { x: element.x2, y: element.y2 } : { x: element.x1, y: element.y1 });
    } else if (element.element_type === 'table' && cell) {
      const cellWidth = Math.abs(element.x2 - element.x1) / element.properties.cols;
      const cellHeight = Math.abs(element.y2 - element.y1) / element.properties.rows;
      setEditingCell({ id: element.id, ...cell });
      setAnnotationText(element.properties.cells[cell.row]?.[cell.col] ?? '');
      setAnnotationAnchor({ x: element.x1 + cell.col * cellWidth, y: element.y1 + cell.row * cellHeight });
    } else {
      return;
    }
    actions.select(element.id, false);
    actions.setAnnotationEditing(element.id);
    requestAnimationFrame(() => annotationInputRef.current?.focus());
  }

  function finishAnnotationEditor(cancel = false) {
    const id = state.annotationEditingId;
    if (!id) return;
    const editedText = annotationInputRef.current?.value ?? annotationText;
    const element = state.elements.find((candidate) => candidate.id === id);
    if (cancel) {
      actions.cancelAnnotationEditing();
    } else if (element?.element_type === 'table' && editingCell) {
      const cells = element.properties.cells.map((row) => [...row]);
      while (cells.length <= editingCell.row) cells.push([]);
      while (cells[editingCell.row].length <= editingCell.col) cells[editingCell.row].push('');
      cells[editingCell.row][editingCell.col] = editedText;
      actions.updateElement(id, { properties: { cells } } as Partial<ProjectElement>);
      actions.setAnnotationEditing(null);
    } else if (element?.element_type === 'text' || element?.element_type === 'leader') {
      if (state.annotationEditingNew && !editedText.trim()) {
        actions.cancelAnnotationEditing();
      } else {
        actions.updateElement(id, { properties: { text: editedText } } as Partial<ProjectElement>);
        actions.setAnnotationEditing(null);
      }
    } else {
      actions.setAnnotationEditing(null);
    }
    setEditingCell(null);
    setAnnotationAnchor(null);
  }

  /** Drop any half-typed numeric text — a click consumes or abandons it. */
  const clearLengthBuffer = () => {
    lengthInputRef.current = '';
    setLengthInput('');
  };

  const activeToolMode = state.tool === 'select' ? null : drawModeOf(state.tool);

  useEffect(() => {
    function handleLengthKeyDown(event: KeyboardEvent) {
      const current = stateRef.current;
      const draft = current.draft;
      const draftMode = draft && draft.tool !== 'select' ? drawModeOf(draft.tool) : null;
      const activeDraft = draft && draftMode && draftMode !== 'point' ? draft : null;
      const toolArmed = current.tool !== 'select';
      const editing = current.edit;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const buffer = lengthInputRef.current;
      const setBuffer = (value: string) => {
        lengthInputRef.current = value;
        setLengthInput(value);
      };
      // An armed edit session owns the keyboard: numbers and point syntax go
      // to its parameter slot, bare Enter advances the phase, Esc cancels.
      if (editing) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setBuffer('');
          actions.cancelEdit();
          return;
        }
        if (/^[0-9.<>x@-]$/.test(event.key) || event.key === ',') {
          event.preventDefault();
          setBuffer(`${buffer}${event.key}`);
          return;
        }
        if (event.key === 'Backspace') {
          if (buffer) {
            event.preventDefault();
            setBuffer(buffer.slice(0, -1));
          }
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (buffer) {
            setBuffer('');
            actions.editValue(buffer, displayUnit);
          } else {
            actions.editDone();
          }
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setBuffer('');
        if (draft) actions.cancelDraft();
        actions.clearSelection();
        actions.setTool('select');
        return;
      }
      // While a draft is running every coordinate key is captured; with a tool
      // merely armed (no draft yet) only number-ish characters are captured so
      // an absolute/relative first point can be typed. Letters stay free for
      // the command palette.
      const capture = activeDraft
        ? /^[0-9.<>x@-]$/.test(event.key) || event.key === ','
        : toolArmed && !draft && /^[0-9@.,-]$/.test(event.key);
      if (capture) {
        event.preventDefault();
        setBuffer(`${buffer}${event.key}`);
        return;
      }
      if (event.key === 'Backspace') {
        if (!buffer) return;
        event.preventDefault();
        setBuffer(buffer.slice(0, -1));
        return;
      }
      // "c" closes a polyline draft (only when no numeric text is pending).
      if ((event.key === 'c' || event.key === 'C') && activeDraft && draftMode === 'poly' && !buffer) {
        event.preventDefault();
        actions.commitDraft(true);
        return;
      }
      if (event.key !== 'Enter') return;
      if (!buffer) {
        // Bare Enter finishes an open polyline draft.
        if (activeDraft && draftMode === 'poly') {
          event.preventDefault();
          actions.commitDraft();
        } else if (activeDraft && draftMode === 'dim') {
          event.preventDefault();
          const needed = current.dimKind === 'angular' ? 3 : current.dimKind === 'radial' || current.dimKind === 'diameter' ? 1 : 2;
          if (activeDraft.vertices.length < needed) actions.extendDraft();
          else actions.commitDraft(false, annotationScale);
        }
        return;
      }
      event.preventDefault();
      const command = parsePointInput(buffer);
      setBuffer('');
      if (!command) return;

      // Advance the draft to an exact (typed, unsnapped) point: extends a
      // polyline, records the arc through-point, or commits the element.
      const advance = (point: Point) => {
        if (!activeDraft) {
          if (!toolArmed || current.tool === 'select') return;
          if (current.tool === 'dimension' && (current.dimKind === 'radial' || current.dimKind === 'diameter')) {
            const hit = pickElementAt(
              point,
              current.elements.filter((element) => isElementVisible(element, current.layers)),
              8 / Math.max(0.1, current.viewport.zoom),
              (element) => element.element_type === 'circle' || element.element_type === 'arc',
            );
            if (hit) actions.beginDraft(point, hit.element);
            return;
          }
          actions.beginDraft(point);
          if (drawModeOf(current.tool) === 'point') actions.commitDraft();
          else if (current.tool === 'table') actions.commitDraft(false, annotationScale);
          return;
        }
        actions.updateDraft(point, true);
        if (draftMode === 'dim') {
          const needed = current.dimKind === 'angular' ? 3 : current.dimKind === 'radial' || current.dimKind === 'diameter' ? 1 : 2;
          if (activeDraft.vertices.length < needed) actions.extendDraft();
          else actions.commitDraft(false, annotationScale);
          return;
        }
        if (draftMode === 'poly') actions.extendDraft();
        else if (draftMode === 'arc' && activeDraft.vertices.length < 2) actions.extendDraft();
        else actions.commitDraft();
      };

      switch (command.kind) {
        case 'absolute':
          advance(resolvePoint(command, { x: 0, y: 0 }, displayUnit));
          return;
        case 'relative': {
          if (!activeDraft) return;
          advance(resolvePoint(command, activeDraft.start, displayUnit));
          return;
        }
        case 'polar': {
          if (!activeDraft || draftMode === 'rect') return;
          const currentLength = distance(activeDraft.start, activeDraft.end);
          const length = command.length !== undefined && command.length > 0
            ? displayToCm(command.length, displayUnit)
            : currentLength;
          if (length <= 0) return;
          const angle = command.angle !== undefined
            ? toRadians(command.angle)
            : currentLength > 0.001
              ? Math.atan2(activeDraft.end.y - activeDraft.start.y, activeDraft.end.x - activeDraft.start.x)
              : 0;
          advance({
            x: activeDraft.start.x + Math.cos(angle) * length,
            y: activeDraft.start.y + Math.sin(angle) * length,
          });
          return;
        }
        case 'radius': {
          if (!activeDraft || draftMode === 'rect') return;
          const radius = displayToCm(command.radius, displayUnit);
          if (radius <= 0) return;
          if (draftMode === 'center') {
            advance({ x: activeDraft.start.x + radius, y: activeDraft.start.y });
            return;
          }
          // Bare number on a line/poly/arc draft: length along the current
          // direction, like AutoCAD's dynamic distance input.
          const currentLength = distance(activeDraft.start, activeDraft.end);
          const angle = currentLength > 0.001
            ? Math.atan2(activeDraft.end.y - activeDraft.start.y, activeDraft.end.x - activeDraft.start.x)
            : 0;
          advance({
            x: activeDraft.start.x + Math.cos(angle) * radius,
            y: activeDraft.start.y + Math.sin(angle) * radius,
          });
          return;
        }
        case 'size': {
          if (!activeDraft || draftMode !== 'rect') return;
          advance({
            x: activeDraft.start.x + displayToCm(command.width, displayUnit),
            y: activeDraft.start.y + displayToCm(command.height, displayUnit),
          });
          return;
        }
        case 'close':
          if (activeDraft && draftMode === 'poly') actions.commitDraft(true);
          return;
      }
    }

    window.addEventListener('keydown', handleLengthKeyDown);
    return () => window.removeEventListener('keydown', handleLengthKeyDown);
  }, [actions, annotationScale, displayUnit]);

  const visibleElements = useMemo(
    () => state.elements.filter((el) => isElementVisible(el, state.layers)),
    [state.elements, state.layers],
  );

  const intersections = useMemo(() => {
    const lineElements = visibleElements.filter((el) => isLineType(el));
    const result: Point[] = [];
    for (let i = 0; i < lineElements.length; i += 1) {
      for (let j = i + 1; j < lineElements.length; j += 1) {
        const a = lineElements[i];
        const b = lineElements[j];
        const p = lineIntersection(
          { x: a.x1, y: a.y1 },
          { x: a.x2, y: a.y2 },
          { x: b.x1, y: b.y1 },
          { x: b.x2, y: b.y2 },
        );
        if (p) result.push(p);
      }
    }
    return result;
  }, [visibleElements]);

  const grid = useMemo(
    () => gridPoints(state.showGrid, size.width, size.height, pan, zoom),
    [state.showGrid, size.width, size.height, pan, zoom],
  );

  /** Click while a draw tool is armed: starts the draft, extends a polyline /
 *  arc chain, or commits the element depending on the draw mode. */
  function advanceDraftClick(world: Point) {
    const draft = state.draft;
    if (state.tool === 'dimension') {
      const kind = state.dimKind;
      if (!draft) {
        if (kind === 'radial' || kind === 'diameter') {
          const hit = pickElementAt(world, visibleElements, 8 / Math.max(0.1, zoom), (element) => element.element_type === 'circle' || element.element_type === 'arc');
          if (hit) actions.beginDraft(world, hit.element);
        } else {
          actions.beginDraft(world);
        }
        return;
      }
      actions.updateDraft(world);
      const confirmed = draft.vertices.length;
      const needed = kind === 'angular' ? 3 : kind === 'radial' || kind === 'diameter' ? 1 : 2;
      if (confirmed < needed) actions.extendDraft();
      else actions.commitDraft(false, annotationScale);
      return;
    }
    if (!draft) {
      actions.beginDraft(world);
      return;
    }
    const mode = draft.tool === 'select' ? null : drawModeOf(draft.tool);
    if (mode === 'poly') {
      actions.updateDraft(world);
      const first = draft.vertices[0];
      const closing = first !== undefined
        && draft.vertices.length >= 3
        && distance(world, first) <= snapPixelsForZoom(zoom) / Math.max(0.1, zoom);
      if (closing) actions.commitDraft(true);
      else actions.extendDraft();
      return;
    }
    actions.updateDraft(world);
    if (mode === 'arc' && draft.vertices.length < 2) {
      actions.extendDraft();
      return;
    }
    actions.commitDraft();
  }

  function handleStageMouseDown(e: any) {
    if (e.target !== e.currentTarget) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition() as Point;
    const world = worldFromScreen(pos, pan, zoom);
    if (state.edit) {
      // Pick phase accepts a window/crossing drag on empty canvas; every
      // other phase treats the click as a point pick with no element.
      if (state.edit.phase === 'pick') {
        setDragStart(world);
        setDragEnd(world);
        setDragging(true);
        return;
      }
      clearLengthBuffer();
      actions.editPick(world, null);
      return;
    }
    if (state.tool === 'select') {
      actions.clearSelection();
      setDragStart(world);
      setDragEnd(world);
      setDragging(true);
      return;
    }
    if (state.tool === 'block_ref') {
      // Single-click insert: the draft exists only to feed the snapped
      // insertion point into ``commitDraft``.
      clearLengthBuffer();
      actions.beginDraft(world);
      actions.commitDraft();
      return;
    }
    if (state.tool === 'table' && !state.draft) {
      clearLengthBuffer();
      actions.beginDraft(world);
      actions.commitDraft(false, annotationScale);
      return;
    }
    if (!state.draft && activeToolMode === 'point') {
      actions.beginDraft(world);
      actions.commitDraft();
      return;
    }
    advanceDraftClick(world);
  }

  function handleContextMenu(e: any) {
    e.evt.preventDefault();
    // Right-click confirms like Enter in AutoCAD.
    if (state.edit) {
      clearLengthBuffer();
      actions.editDone();
    }
  }

  function handleStageDoubleClick() {
    const draft = state.draft;
    if (draft && draft.tool !== 'select' && drawModeOf(draft.tool) === 'poly') {
      actions.commitDraft();
    }
  }

  function handleStageMouseMove(e: any) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition() as Point;
    const world = worldFromScreen(pos, pan, zoom);
    if (dragging) {
      setDragEnd(world);
      return;
    }
    if (state.edit) {
      actions.editCursor(world);
      return;
    }
    if (!state.draft) {
      if (activeToolMode === 'point' || state.tool === 'block_ref') {
        actions.beginDraft(world);
      }
      return;
    }
    actions.updateDraft(world);
  }

  function handleStageMouseUp() {
    if (!dragging || !dragStart || !dragEnd) return;
    setDragging(false);
    const dx = dragEnd.x - dragStart.x;
    const dy = dragEnd.y - dragStart.y;
    if (Math.hypot(dx, dy) > 5) {
      const box = {
        minX: Math.min(dragStart.x, dragEnd.x),
        minY: Math.min(dragStart.y, dragEnd.y),
        maxX: Math.max(dragStart.x, dragEnd.x),
        maxY: Math.max(dragStart.y, dragEnd.y),
      };
      // AutoCAD convention: dragging left→right is a window (full
      // containment), right→left is a crossing (anything touched).
      const mode: BoxMode = dragEnd.x >= dragStart.x ? 'window' : 'crossing';
      const ids = visibleElements
        .filter((el) => !isElementLocked(el, state.layers) && elementInBox(el, box, mode))
        .map((el) => el.id);
      if (state.edit && state.edit.phase === 'pick') {
        if (ids.length) actions.editPickMany(ids);
      } else if (ids.length) {
        actions.selectMany(ids);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }

  function touchPoints(event: TouchEvent): Point[] {
    return Array.from(event.touches).map((touch) => ({ x: touch.clientX, y: touch.clientY }));
  }

  function applyZoomAt(screen: Point, nextZoom: number) {
    const world = worldFromScreen(screen, pan, zoom);
    const bounded = boundZoom(nextZoom);
    const newPan = { x: screen.x - world.x * bounded, y: screen.y - world.y * bounded };
    actions.setZoom(bounded);
    actions.pan({ x: newPan.x - pan.x, y: newPan.y - pan.y });
  }

  function handleStageTouchStart(e: any) {
    const event = e.evt as TouchEvent;
    if (event.touches.length >= 2) {
      pinchRef.current = null;
      actions.cancelDraft();
      setDragging(false);
      return;
    }
    handleStageMouseDown(e);
  }

  function handleStageTouchMove(e: any) {
    const event = e.evt as TouchEvent;
    event.preventDefault();
    if (event.touches.length >= 2) {
      const [first, second] = touchPoints(event);
      const currentDistance = Math.hypot(second.x - first.x, second.y - first.y);
      const stageBox = (e.target.getStage().container() as HTMLDivElement).getBoundingClientRect();
      const center = {
        x: (first.x + second.x) / 2 - stageBox.left,
        y: (first.y + second.y) / 2 - stageBox.top,
      };
      const previous = pinchRef.current;
      if (previous && previous.distance > 0) {
        applyZoomAt(center, zoom * (currentDistance / previous.distance));
        actions.pan({ x: center.x - previous.center.x, y: center.y - previous.center.y });
      }
      pinchRef.current = { distance: currentDistance, center };
      return;
    }
    handleStageMouseMove(e);
  }

  function handleStageTouchEnd(e: any) {
    const event = e.evt as TouchEvent;
    if (event.touches.length === 0) pinchRef.current = null;
    handleStageMouseUp();
  }

  function handleStageWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition() as Point;
    const world = worldFromScreen(pos, pan, zoom);
    const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = boundZoom(zoom * factor);
    const newPan = { x: pos.x - world.x * newZoom, y: pos.y - world.y * newZoom };
    actions.setZoom(newZoom);
    actions.pan({ x: newPan.x - pan.x, y: newPan.y - pan.y });
  }

  function handleShapeClick(e: any, element: ProjectElement) {
    if (isElementLocked(element, state.layers)) return;
    const id = element.id;
    e.cancelBubble = true;
    // Inside an edit session every element click is a pick — targets for
    // move/copy, the source for offset, or the victim for trim/extend.
    if (state.edit) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition() as Point;
      clearLengthBuffer();
      actions.editPick(worldFromScreen(pos, pan, zoom), element.id);
      return;
    }
    // With a multi-point tool armed, clicking on an existing element feeds its
    // snap targets into the draft (e.g. end a wall on another wall's face).
    if (activeToolMode && activeToolMode !== 'point' && activeToolMode !== 'rect') {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition() as Point;
      advanceDraftClick(worldFromScreen(pos, pan, zoom));
      return;
    }
    actions.select(id, Boolean(e.evt.ctrlKey || e.evt.metaKey));
    if (state.tool !== 'select') actions.setTool('select');
  }

  /** Konva reports the dragged node's absolute position, so the real
   *  displacement is ``position - anchor`` where ``anchor`` is whatever the
   *  node was rendered at (``0,0`` for Line nodes with world-space points,
   *  the center for Rect/Ellipse/Circle). */
  function handleElementDragEnd(e: any, element: ProjectElement, anchor: Point) {
    const position = e.target.position() as Point;
    const dx = position.x - anchor.x;
    const dy = position.y - anchor.y;
    e.target.position(anchor);
    if (!dx && !dy) return;
    actions.updateElement(element.id, {
      x1: element.x1 + dx,
      y1: element.y1 + dy,
      x2: element.x2 + dx,
      y2: element.y2 + dy,
    });
  }

  function handleGripDragEnd(e: any, element: ProjectElement, grip: Grip) {
    const rawPoint = e.target.position() as Point;
    const snap = element.element_type === 'wall'
      ? snapForWall(rawPoint, state.elements, zoom, 1, element.id)
      : snapToNearest(rawPoint, state.elements, zoom, 1, element.id);
    const next = applyGrip(element, grip, snap?.point ?? rawPoint);
    if (next !== element) actions.replaceElement(next);
    e.target.position({ x: grip.point.x, y: grip.point.y });
  }

  const draftMeasurement = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool === 'select') return null;
    const draftMode = drawModeOf(draft.tool);
    if (draftMode === 'point') return null;
    if (draftMode === 'rect') {
      const w = Math.abs(draft.end.x - draft.start.x);
      const h = Math.abs(draft.end.y - draft.start.y);
      const displayValue = lengthInput || `${formatDisplayValue(cmToDisplay(w, displayUnit), displayUnit)} × ${formatDisplayValue(cmToDisplay(h, displayUnit), displayUnit)}`;
      return { text: displayValue, end: draft.end };
    }
    if (draftMode === 'center') {
      const radius = distance(draft.start, draft.end);
      const displayValue = lengthInput || `R ${formatDisplayValue(cmToDisplay(radius, displayUnit), displayUnit)}`;
      return { text: displayValue, end: draft.end };
    }
    if (draftMode === 'arc' && draft.vertices.length >= 2) {
      const spec = arcSpecFromPoints(draft.vertices[0], draft.vertices[1], draft.end);
      const displayValue = lengthInput || (spec ? `R ${formatDisplayValue(cmToDisplay(spec.radius, displayUnit), displayUnit)}` : '');
      return { text: displayValue, end: draft.end };
    }
    const length = distance(draft.start, draft.end);
    const angle = Math.atan2(draft.end.y - draft.start.y, draft.end.x - draft.start.x);
    const displayValue = lengthInput || formatDisplayValue(cmToDisplay(length, displayUnit), displayUnit);
    const suffix = lengthInput && !lengthInput.includes('<') && !lengthInput.includes(',') ? ` ${displayUnit}` : '';
    return { text: `${displayValue}${suffix}\n${formatAngle(angle)}`, end: draft.end };
  }, [state.draft, displayUnit, lengthInput]);

  const polarGuide = useMemo(() => {
    const draft = state.draft;
    if (!draft?.polar || draft.tool === 'select' || drawModeOf(draft.tool) !== 'line') return null;
    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const ext = Math.max(len * 3, 600);
    return {
      x1: draft.start.x - (dx / len) * ext * 0.25,
      y1: draft.start.y - (dy / len) * ext * 0.25,
      x2: draft.start.x + (dx / len) * ext,
      y2: draft.start.y + (dy / len) * ext,
    };
  }, [state.draft]);

  const pointPreview = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool === 'select' || drawModeOf(draft.tool) !== 'point') return null;
    return { tool: draft.tool, point: draft.end, snap: draft.snap };
  }, [state.draft]);

  /** Armed block preview: the library definition instantiated at the
   *  cursor so the user sees exactly what lands on click. */
  const blockInsertPreview = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool !== 'block_ref') return null;
    const def = blockById(state.blocks, state.armedBlockId);
    if (!def) return null;
    const previewRef = createBlockRef('block-preview', state.elements[0]?.project_id ?? '', def, draft.end);
    return instantiateBlock(def, previewRef);
  }, [state.draft, state.blocks, state.armedBlockId, state.elements]);

  const dimensionDraftPreview = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool !== 'dimension') return null;
    const kind = draft.dimKind;
    let p1: PlanPoint = draft.vertices[0] ?? draft.start;
    let p2: PlanPoint = draft.vertices[1] ?? draft.end;
    let vertex: PlanPoint | undefined;
    let radius: number | undefined;
    if (kind === 'angular') {
      vertex = draft.vertices[0];
      p1 = draft.vertices[1] ?? draft.end;
      p2 = draft.vertices[2] ?? draft.end;
    } else if ((kind === 'radial' || kind === 'diameter') && draft.dimensionTarget) {
      const target = draft.dimensionTarget;
      if (target.element_type !== 'circle' && target.element_type !== 'arc') return null;
      const targetProperties = target.properties as { cx?: number; cy?: number; radius?: number };
      radius = targetProperties.radius;
      if (radius === undefined) return null;
      p1 = target.element_type === 'circle'
        ? { x: target.x1, y: target.y1 }
        : { x: targetProperties.cx ?? target.x1, y: targetProperties.cy ?? target.y1 };
      const click = draft.dimensionTargetPoint ?? p1;
      const angle = Math.atan2(click.y - p1.y, click.x - p1.x);
      p2 = { x: p1.x + Math.cos(angle) * radius, y: p1.y + Math.sin(angle) * radius };
    }
    const preview = {
      id: 'dimension-preview',
      project_id: '',
      element_type: 'dimension',
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, length: Math.max(1, distance(p1, p2)), rotation: 0,
      material_id: null, section_id: null, created_at: '', updated_at: '',
      properties: {
        kind,
        dim_point: draft.end,
        ...(vertex ? { vertex } : {}),
        ...(kind === 'linear' ? { orientation: linearOrientation(p1, p2, draft.end) } : {}),
        ...(radius !== undefined ? { radius } : {}),
      },
    } as DimensionElement;
    return dimensionGeometry(preview, dimStyle, annotationScale);
  }, [state.draft, dimStyle, annotationScale]);

  // Ghost preview for the armed edit session: replaced elements render
  // dashed cyan at their new geometry, clones dashed green, and the
  // originals being transformed are dimmed underneath.
  const editPreview = useMemo(
    () => (state.edit ? previewEditOutcome(state.edit, visibleElements, hoverId) : null),
    [state.edit, visibleElements, hoverId],
  );
  const dimmedIds = useMemo(() => new Set(editPreview?.movedIds ?? []), [editPreview]);
  const pickedIds = useMemo(() => {
    const edit = state.edit;
    if (!edit) return new Set<string>();
    const ids = edit.phase === 'pick' ? edit.ids : [];
    return new Set(edit.pickedId ? [...ids, edit.pickedId] : ids);
  }, [state.edit]);

  const selectedGrips = useMemo(() => {
    if (state.edit || state.readOnly || state.tool !== 'select') return [];
    return visibleElements
      .filter((el) => state.selectedIds.includes(el.id) && !isElementLocked(el, state.layers))
      .flatMap((el) => gripsFor(el).map((grip) => ({ element: el, grip })));
  }, [state.edit, state.readOnly, state.tool, state.selectedIds, state.layers, visibleElements]);

  const dragBoxMode: BoxMode | null = dragging && dragStart && dragEnd
    ? (dragEnd.x >= dragStart.x ? 'window' : 'crossing')
    : null;

  // The numeric buffer belongs to the active session/draft — it is wiped at
  // every session click/key so stale digits never leak into the next flow.

  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none cursor-crosshair"
      style={{ background: COLORS.canvas }}
      role="application"
      aria-label={t('label2d')}
      aria-describedby="canvas-2d-help"
    >
      <p id="canvas-2d-help" className="sr-only">{t('help2d')}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {t('status', { elements: state.elements.length, selected: state.selectedIds.length })}
      </p>
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={pan.x}
          y={pan.y}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={handleStageMouseDown}
          onDblClick={handleStageDoubleClick}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageTouchStart}
          onTouchMove={handleStageTouchMove}
          onTouchEnd={handleStageTouchEnd}
          onWheel={handleStageWheel}
          onContextMenu={handleContextMenu}
          style={{ background: COLORS.canvas }}
        >
          <Layer>
            <Rect
              x={-pan.x / zoom}
              y={-pan.y / zoom}
              width={size.width / zoom}
              height={size.height / zoom}
              fill={COLORS.canvas}
              listening={false}
            />
            {state.showGrid && <Line points={grid} stroke={COLORS.grid} strokeWidth={1 / zoom} listening={false} />}
          </Layer>
          <Layer>
            {visibleElements.map((el) => {
              const selected = state.selectedIds.includes(el.id) || pickedIds.has(el.id);
              const hovered = hoverId === el.id;
              const locked = isElementLocked(el, state.layers);
              const stroke = colorFor(el, selected, hovered, state.layers);
              const mode = drawMode(el);
              const ghostDim = dimmedIds.has(el.id) ? 0.28 : 1;
              const resolved = resolveLineStyle(el, state.layers);
    const interactive = {
                onMouseDown: (e: any) => handleShapeClick(e, el),
                onTouchStart: (e: any) => handleShapeClick(e, el),
                onMouseEnter: () => setHoverId(el.id),
      onMouseLeave: () => setHoverId(null),
      onDblClick: (e: any) => {
        e.cancelBubble = true;
        openAnnotationEditor(el);
      },
      onDblTap: (e: any) => {
        e.cancelBubble = true;
        openAnnotationEditor(el);
      },
    };
              const draggable = !state.edit && state.tool === 'select' && selected && !locked && !state.readOnly;

              if (el.element_type === 'dimension') {
                const style = resolveDimStyle(dimStyles, el.properties.dim_style_id, activeDimStyleId);
                const geometry = dimensionGeometry(el, style, annotationScale);
                const arcLines = geometry.arcs.flatMap((arc) => {
                  const points = sampleArcPoints(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, false);
                  return points.slice(1).map((point, index) => [points[index].x, points[index].y, point.x, point.y]);
                });
                return (
                  <Group key={el.id} opacity={(locked ? 0.45 : 1) * ghostDim} {...interactive}>
                    {geometry.lines.map((line, index) => (
                      <Line key={`dim-line-${index}`} points={[line.start.x, line.start.y, line.end.x, line.end.y]} stroke={stroke} strokeWidth={1.4 / zoom} hitStrokeWidth={12 / zoom} />
                    ))}
                    {arcLines.map((points, index) => (
                      <Line key={`dim-arc-${index}`} points={points} stroke={stroke} strokeWidth={1.4 / zoom} hitStrokeWidth={12 / zoom} />
                    ))}
                    {geometry.arrows.map((arrow, index) => (
                      <AnnotationArrow key={`dim-arrow-${index}`} arrow={arrow} color={stroke} zoom={zoom} />
                    ))}
                    <Text
                      x={geometry.text.point.x}
                      y={geometry.text.point.y}
                      text={geometry.text.value}
                      fontSize={paperToWorld(style.text_height, annotationScale)}
                      fill={stroke}
                      rotation={(geometry.text.angle * 180) / Math.PI}
                      offsetX={geometry.text.value.length * paperToWorld(style.text_height, annotationScale) * 0.25}
                      offsetY={paperToWorld(style.text_height, annotationScale) / 2}
                    />
                  </Group>
                );
              }

              if (el.element_type === 'leader') {
                const style = resolveDimStyle(dimStyles, el.properties.dim_style_id, activeDimStyleId);
                const geometry = leaderGeometry(el, style, annotationScale)!;
                return (
                  <Group key={el.id} opacity={(locked ? 0.45 : 1) * ghostDim} {...interactive}>
                    {geometry.lines.map((line, index) => (
                      <Line key={`leader-line-${index}`} points={[line.start.x, line.start.y, line.end.x, line.end.y]} stroke={stroke} strokeWidth={1.5 / zoom} hitStrokeWidth={12 / zoom} />
                    ))}
                    {geometry.arrows.map((arrow, index) => (
                      <AnnotationArrow key={`leader-arrow-${index}`} arrow={arrow} color={stroke} zoom={zoom} />
                    ))}
                    {el.properties.text && (
                      <Text x={geometry.text.point.x} y={geometry.text.point.y - paperToWorld(style.text_height, annotationScale) / 2} text={geometry.text.value} fontSize={paperToWorld(style.text_height, annotationScale)} fill={stroke} />
                    )}
                  </Group>
                );
              }

              if (el.element_type === 'text') {
                const fontSize = paperToWorld(el.properties.height, annotationScale);
                const textWidth = Math.max(fontSize * 2, el.properties.text.length * fontSize);
                return (
                  <Text
                    key={el.id}
                    x={el.x1}
                    y={el.y1}
                    text={el.properties.text || ' '}
                    width={textWidth}
                    fontSize={fontSize}
                    fontStyle={`${el.properties.bold ? 'bold' : ''}${el.properties.italic ? ' italic' : ''}`.trim()}
                    textDecoration={el.properties.underline ? 'underline' : undefined}
                    align={el.properties.align ?? 'left'}
                    offsetX={el.properties.align === 'center' ? textWidth / 2 : el.properties.align === 'right' ? textWidth : 0}
                    rotation={(el.rotation * 180) / Math.PI}
                    fill={stroke}
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    hitStrokeWidth={12 / zoom}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'table') {
                const table = el as TableElement;
                const rect = rectOf(table);
                const cellWidth = rect.w / Math.max(1, table.properties.cols);
                const cellHeight = rect.h / Math.max(1, table.properties.rows);
                const tableFontSize = Math.min(paperToWorld(table.properties.text_height, annotationScale), cellHeight * 0.7);
                const tableTextPadding = tableFontSize * 0.25;
                const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
                return (
                  <Group
                    key={el.id}
                    x={center.x}
                    y={center.y}
                    offsetX={center.x}
                    offsetY={center.y}
                    rotation={(el.rotation * 180) / Math.PI}
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, center)}
                    {...interactive}
                  >
                    {Array.from({ length: table.properties.rows }, (_, row) =>
                      Array.from({ length: table.properties.cols }, (_, col) => (
                        <Fragment key={`cell-${row}-${col}`}>
                          <Rect
                            x={rect.x + col * cellWidth}
                            y={rect.y + row * cellHeight}
                            width={cellWidth}
                            height={cellHeight}
                            fill={row === 0 && table.properties.header ? 'rgba(148, 163, 184, 0.18)' : 'transparent'}
                            stroke={stroke}
                            strokeWidth={1 / zoom}
                            onDblClick={(event) => { event.cancelBubble = true; openAnnotationEditor(table, { row, col }); }}
                            onDblTap={(event) => { event.cancelBubble = true; openAnnotationEditor(table, { row, col }); }}
                          />
                          <Text
                            x={rect.x + col * cellWidth + tableTextPadding}
                            y={rect.y + row * cellHeight}
                            text={table.properties.cells[row]?.[col] ?? ''}
                            width={Math.max(0, cellWidth - tableTextPadding * 2)}
                            height={cellHeight}
                            fontSize={tableFontSize}
                            fontStyle={row === 0 && table.properties.header ? 'bold' : 'normal'}
                            verticalAlign="middle"
                            wrap="none"
                            ellipsis
                            fill={stroke}
                            onDblClick={(event) => { event.cancelBubble = true; openAnnotationEditor(table, { row, col }); }}
                            onDblTap={(event) => { event.cancelBubble = true; openAnnotationEditor(table, { row, col }); }}
                          />
                        </Fragment>
                      )),
                    )}
                  </Group>
                );
              }

              if (el.element_type === 'column') {
                const props = el.properties as { width: number; depth: number; diameter?: number; shape?: string };
                if (props.shape === 'circular' && props.diameter) {
                  const r = (props.diameter * 100) / 2;
                  return (
                    <Circle
                      key={el.id}
                      x={el.x1}
                      y={el.y1}
                      radius={r}
                      fill={stroke}
                      opacity={(locked ? 0.45 : 0.9) * ghostDim}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el, { x: el.x1, y: el.y1 })}
                      {...interactive}
                    />
                  );
                }
                const w = props.width * 100;
                const h = props.depth * 100;
                return (
                  <Rect
                    key={el.id}
                    x={el.x1}
                    y={el.y1}
                    width={w}
                    height={h}
                    offsetX={w / 2}
                    offsetY={h / 2}
                    rotation={(el.rotation * 180) / Math.PI}
                    fill={stroke}
                    opacity={(locked ? 0.45 : 0.9) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, { x: el.x1, y: el.y1 })}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'pile') {
                const r = ((el.properties.diameter ?? PILE_DEFAULT_DIAMETER) * 100) / 2;
                const arm = r * 0.75;
                return (
                  <Fragment key={el.id}>
                    <Circle
                      x={el.x1}
                      y={el.y1}
                      radius={r}
                      stroke={stroke}
                      strokeWidth={resolved.width ?? 2.5}
                      fill={selected ? 'rgba(34, 211, 238, 0.15)' : 'rgba(249, 115, 22, 0.12)'}
                      dash={resolved.dash ?? [6, 3]}
                      opacity={(locked ? 0.45 : 1) * ghostDim}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el, { x: el.x1, y: el.y1 })}
                      {...interactive}
                    />
                    <Line points={[el.x1 - arm, el.y1 - arm, el.x1 + arm, el.y1 + arm]} stroke={stroke} strokeWidth={1.5} listening={false} />
                    <Line points={[el.x1 - arm, el.y1 + arm, el.x1 + arm, el.y1 - arm]} stroke={stroke} strokeWidth={1.5} listening={false} />
                  </Fragment>
                );
              }

              if (el.element_type === 'circle') {
                const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
                return (
                  <Circle
                    key={el.id}
                    x={el.x1}
                    y={el.y1}
                    radius={radius}
                    stroke={stroke}
                    strokeWidth={resolved.width ?? 2}
                    dash={resolved.dash}
                    fill={selected ? 'rgba(34, 211, 238, 0.10)' : undefined}
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, { x: el.x1, y: el.y1 })}
                    hitStrokeWidth={12}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'polyline') {
                const points = (el.properties as { points?: Point[] }).points ?? [];
                const flat = points.length >= 2
                  ? points.flatMap((p) => [p.x, p.y])
                  : [el.x1, el.y1, el.x2, el.y2];
                return (
                  <Line
                    key={el.id}
                    points={flat}
                    stroke={stroke}
                    strokeWidth={resolved.width ?? 2}
                    dash={resolved.dash}
                    lineCap="round"
                    lineJoin="round"
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, { x: 0, y: 0 })}
                    hitStrokeWidth={12}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'arc') {
                const props = (el as ArcElement).properties;
                const flat = sampleArcPoints(props.cx, props.cy, props.radius, props.start_angle, props.end_angle, props.clockwise)
                  .flatMap((p) => [p.x, p.y]);
                return (
                  <Line
                    key={el.id}
                    points={flat}
                    stroke={stroke}
                    strokeWidth={resolved.width ?? 2}
                    dash={resolved.dash}
                    lineCap="round"
                    lineJoin="round"
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, { x: 0, y: 0 })}
                    hitStrokeWidth={12}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'ellipse') {
                const r = rectOf(el);
                return (
                  <Ellipse
                    key={el.id}
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2}
                    rotation={(el.rotation * 180) / Math.PI}
                    radiusX={r.w / 2}
                    radiusY={r.h / 2}
                    stroke={stroke}
                    strokeWidth={resolved.width ?? 2}
                    dash={resolved.dash}
                    fill={selected ? 'rgba(34, 211, 238, 0.10)' : undefined}
                    opacity={(locked ? 0.45 : 1) * ghostDim}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el, { x: r.x + r.w / 2, y: r.y + r.h / 2 })}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'hatch') {
                const r = rectOf(el);
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                const deg = (el.rotation * 180) / Math.PI;
                const hatch = el.properties as { pattern?: 'ansi31' | 'cross' | 'grid'; spacing?: number; angle?: number };
                const segments = hatchSegments({ x: r.x, y: r.y, width: r.w, height: r.h }, hatch.pattern ?? 'ansi31', hatch.spacing ?? 35, hatch.angle ?? 45)
                  .map((v, i) => (i % 2 === 0 ? v - cx : v - cy));
                return (
                  <Fragment key={el.id}>
                    <Rect
                      x={cx}
                      y={cy}
                      width={r.w}
                      height={r.h}
                      offsetX={r.w / 2}
                      offsetY={r.h / 2}
                      rotation={deg}
                      stroke={stroke}
                      strokeWidth={resolved.width ?? 1.5}
                      dash={resolved.dash}
                      fill={selected ? 'rgba(34, 211, 238, 0.08)' : 'rgba(100, 116, 139, 0.08)'}
                      opacity={(locked ? 0.45 : 1) * ghostDim}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el, { x: cx, y: cy })}
                      {...interactive}
                    />
                    <Group x={cx} y={cy} rotation={deg} listening={false}>
                      <Line
                        points={segments}
                        stroke={stroke}
                        strokeWidth={0.8}
                        opacity={(locked ? 0.3 : 0.85) * ghostDim}
                        listening={false}
                      />
                    </Group>
                  </Fragment>
                );
              }

              if (el.element_type === 'block_ref') {
                const def = blockById(state.blocks, (el.properties as { block_id?: string }).block_id);
                const ghosts = def ? instantiateBlock(def, el) : [];
                const r = rectOf(el);
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                const name = (el.properties as { block_name?: string }).block_name ?? def?.name ?? '';
                return (
                  <Fragment key={el.id}>
                    {/* Ghost contents render non-listening: the instance is a
                        single object — the transparent hit rect below owns
                        the pointer interaction. */}
                    {ghosts.map((ghost) => (
                      <GhostItem key={ghost.id} element={ghost} layers={state.layers} />
                    ))}
                    <Rect
                      x={cx}
                      y={cy}
                      width={r.w}
                      height={r.h}
                      offsetX={r.w / 2}
                      offsetY={r.h / 2}
                      rotation={(el.rotation * 180) / Math.PI}
                      stroke={stroke}
                      strokeWidth={1.5}
                      dash={[6, 4]}
                      fill={selected ? 'rgba(34, 211, 238, 0.10)' : undefined}
                      opacity={(locked ? 0.45 : selected || hovered ? 0.9 : 0.35) * ghostDim}
                      listening={false}
                    />
                    <Rect
                      x={cx}
                      y={cy}
                      width={r.w}
                      height={r.h}
                      offsetX={r.w / 2}
                      offsetY={r.h / 2}
                      rotation={(el.rotation * 180) / Math.PI}
                      fill="transparent"
                      opacity={ghostDim}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el, { x: cx, y: cy })}
                      {...interactive}
                    />
                    {name && (
                      <Text
                        x={r.x + 3}
                        y={r.y + 3}
                        text={name}
                        fontSize={Math.max(10, 12 / Math.max(zoom, 0.5))}
                        fill={stroke}
                        opacity={0.85 * ghostDim}
                        listening={false}
                      />
                    )}
                  </Fragment>
                );
              }

              if (mode === 'rect') {
                const r = rectOf(el);
                const fill = fillFor(el);
                const isOpening = el.element_type === 'opening';
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                const deg = (el.rotation * 180) / Math.PI;
                return (
                  <Fragment key={el.id}>
                    <Rect
                      x={cx}
                      y={cy}
                      width={r.w}
                      height={r.h}
                      offsetX={r.w / 2}
                      offsetY={r.h / 2}
                      rotation={deg}
                      fill={selected ? 'rgba(34, 211, 238, 0.14)' : fill ?? 'rgba(148, 163, 184, 0.12)'}
                      stroke={stroke}
                      strokeWidth={resolved.width ?? (isOpening ? 1.5 : 2)}
                      dash={resolved.dash ?? (isOpening || el.element_type === 'footing' ? [8, 4] : undefined)}
                      opacity={(locked ? 0.45 : 1) * ghostDim}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el, { x: cx, y: cy })}
                      {...interactive}
                    />
                    {/* Inner details live in the rect's local frame: the group
                        rotation reuses the element's ``rotation`` so steps,
                        arrows and crosses follow the rotated outline. */}
                    <Group x={cx} y={cy} rotation={deg} listening={false}>
                      {el.element_type === 'stair' && <StairDetails element={el} stroke={stroke} zoom={zoom} origin={{ x: cx, y: cy }} />}
                      {el.element_type === 'ramp' && <RampArrow element={el} stroke={stroke} zoom={zoom} origin={{ x: cx, y: cy }} />}
                      {isOpening && (
                        <>
                          <Line points={[-r.w / 2, -r.h / 2, r.w / 2, r.h / 2]} stroke={stroke} strokeWidth={1} opacity={0.6} listening={false} />
                          <Line points={[-r.w / 2, r.h / 2, r.w / 2, -r.h / 2]} stroke={stroke} strokeWidth={1} opacity={0.6} listening={false} />
                        </>
                      )}
                      {el.element_type === 'footing' && (
                        <>
                          <Line points={[-r.w / 2, -r.h / 2, r.w / 2, r.h / 2]} stroke={stroke} strokeWidth={1} dash={[4, 4]} opacity={0.5} listening={false} />
                          <Line points={[-r.w / 2, r.h / 2, r.w / 2, -r.h / 2]} stroke={stroke} strokeWidth={1} dash={[4, 4]} opacity={0.5} listening={false} />
                        </>
                      )}
                    </Group>
                  </Fragment>
                );
              }

              const style = lineStyle(el);
              return (
                <Line
                  key={el.id}
                  points={[el.x1, el.y1, el.x2, el.y2]}
                  stroke={stroke}
                  strokeWidth={GEOMETRY_WIDTH_TYPES.has(el.element_type) ? style.width : (resolved.width ?? style.width)}
                  dash={resolved.dash ?? style.dash}
                  lineCap="butt"
                  lineJoin="miter"
                  opacity={(locked ? 0.45 : 1) * ghostDim}
                  draggable={draggable}
                  onDragEnd={(e) => handleElementDragEnd(e, el, { x: 0, y: 0 })}
                  hitStrokeWidth={Math.max(12, style.width)}
                  {...interactive}
                />
              );
            })}
            {intersections.map((p, index) => (
              <Circle
                key={`intersection-${index}`}
                x={p.x}
                y={p.y}
                radius={3 / zoom}
                fill={COLORS.intersection}
                listening={false}
              />
            ))}
            {visibleElements.filter((el) => drawMode(el) !== 'point' && drawMode(el) !== 'center').map((el) => (
              <Circle
                key={`start-${el.id}`}
                x={el.x1}
                y={el.y1}
                radius={4 / zoom}
                fill={state.selectedIds.includes(el.id) ? COLORS.select : COLORS.vertex}
                listening={false}
              />
            ))}
            {visibleElements.filter((el) => drawMode(el) !== 'point' && drawMode(el) !== 'center').map((el) => (
              <Circle
                key={`end-${el.id}`}
                x={el.x2}
                y={el.y2}
                radius={4 / zoom}
                fill={state.selectedIds.includes(el.id) ? COLORS.select : COLORS.vertex}
                listening={false}
              />
            ))}
            {visibleElements.filter((el) => el.element_type === 'polyline').flatMap((el) => {
              const points = (el.properties as { points?: Point[] }).points ?? [];
              const selected = state.selectedIds.includes(el.id);
              return points.slice(1, -1).map((p, index) => (
                <Circle
                  key={`vertex-${el.id}-${index}`}
                  x={p.x}
                  y={p.y}
                  radius={4 / zoom}
                  fill={selected ? COLORS.select : COLORS.vertex}
                  listening={false}
                />
              ));
            })}
            {visibleElements.filter((el) => el.element_type === 'arc').map((el) => {
              const mid = (el as ArcElement).properties.mid;
              return (
                <Circle
                  key={`mid-${el.id}`}
                  x={mid.x}
                  y={mid.y}
                  radius={4 / zoom}
                  fill={state.selectedIds.includes(el.id) ? COLORS.select : COLORS.vertex}
                  listening={false}
                />
              );
            })}
            {visibleElements.filter((el) => el.element_type === 'circle').map((el) => (
              <Circle
                key={`center-${el.id}`}
                x={el.x1}
                y={el.y1}
                radius={4 / zoom}
                fill={state.selectedIds.includes(el.id) ? COLORS.select : COLORS.vertex}
                listening={false}
              />
            ))}
            {/* AutoCAD-style grips: one square per defining point of each
                selected element. Dragging a grip re-fits the element through
                ``applyGrip`` (endpoints stretch, arc mids re-fit the circle,
                rect corners reshape with the opposite corner anchored). */}
            {selectedGrips.map(({ element, grip }) => (
              <Rect
                key={`grip-${element.id}-${grip.key}`}
                x={grip.point.x}
                y={grip.point.y}
                width={10 / zoom}
                height={10 / zoom}
                offsetX={5 / zoom}
                offsetY={5 / zoom}
                fill={COLORS.handleFill}
                stroke={COLORS.select}
                strokeWidth={1.5 / zoom}
                draggable
                onMouseDown={(e) => { e.cancelBubble = true; }}
                onDragEnd={(e) => handleGripDragEnd(e, element, grip)}
              />
            ))}
            {state.draft && state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'line' && (
              <>
                <Line
                  points={[state.draft.start.x, state.draft.start.y, state.draft.end.x, state.draft.end.y]}
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  listening={false}
                />
                <Circle x={state.draft.start.x} y={state.draft.start.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                <Circle x={state.draft.end.x} y={state.draft.end.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {state.draft && state.draft.tool !== 'select' && state.draft.tool !== 'block_ref' && drawModeOf(state.draft.tool) === 'rect' && (
              <>
                <Rect
                  x={Math.min(state.draft.start.x, state.draft.end.x)}
                  y={Math.min(state.draft.start.y, state.draft.end.y)}
                  width={Math.abs(state.draft.end.x - state.draft.start.x)}
                  height={Math.abs(state.draft.end.y - state.draft.start.y)}
                  fill="rgba(34, 211, 238, 0.10)"
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  listening={false}
                />
                <Circle x={state.draft.start.x} y={state.draft.start.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {state.draft && state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'poly' && (
              <>
                {state.draft.vertices.length > 1 && (
                  <Line
                    points={state.draft.vertices.flatMap((p) => [p.x, p.y])}
                    stroke={COLORS.select}
                    strokeWidth={2 / zoom}
                    lineJoin="round"
                    listening={false}
                  />
                )}
                <Line
                  points={[state.draft.start.x, state.draft.start.y, state.draft.end.x, state.draft.end.y]}
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  listening={false}
                />
                {state.draft.vertices.map((p, index) => (
                  <Circle key={`draft-v-${index}`} x={p.x} y={p.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                ))}
                <Circle x={state.draft.end.x} y={state.draft.end.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {state.draft && state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'arc' && (() => {
              const vertices = state.draft.vertices;
              const spec = vertices.length >= 2
                ? arcSpecFromPoints(vertices[0], vertices[1], state.draft.end)
                : null;
              const preview = spec
                ? sampleArcPoints(spec.cx, spec.cy, spec.radius, spec.start_angle, spec.end_angle, spec.clockwise).flatMap((p) => [p.x, p.y])
                : null;
              return (
                <>
                  {preview ? (
                    <Line
                      points={preview}
                      stroke={COLORS.select}
                      strokeWidth={2 / zoom}
                      dash={[8 / zoom, 4 / zoom]}
                      lineCap="round"
                      listening={false}
                    />
                  ) : (
                    <Line
                      points={[state.draft.start.x, state.draft.start.y, state.draft.end.x, state.draft.end.y]}
                      stroke={COLORS.select}
                      strokeWidth={2 / zoom}
                      dash={[8 / zoom, 4 / zoom]}
                      listening={false}
                    />
                  )}
                  {vertices.map((p, index) => (
                    <Circle key={`draft-arc-v-${index}`} x={p.x} y={p.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                  ))}
                  <Circle x={state.draft.end.x} y={state.draft.end.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                </>
              );
            })()}
            {state.draft && state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'center' && (
              <>
                <Circle
                  x={state.draft.start.x}
                  y={state.draft.start.y}
                  radius={distance(state.draft.start, state.draft.end)}
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  listening={false}
                />
                <Circle x={state.draft.start.x} y={state.draft.start.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                <Circle x={state.draft.end.x} y={state.draft.end.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {pointPreview && pointPreview.tool === 'column' && (
              <>
                <Rect
                  x={pointPreview.point.x}
                  y={pointPreview.point.y}
                  width={COLUMN_DEFAULT_WIDTH * 100}
                  height={COLUMN_DEFAULT_DEPTH * 100}
                  offsetX={(COLUMN_DEFAULT_WIDTH * 100) / 2}
                  offsetY={(COLUMN_DEFAULT_DEPTH * 100) / 2}
                  fill="rgba(34, 211, 238, 0.15)"
                  stroke={pointPreview.snap ? '#06b6d4' : COLORS.select}
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Circle x={pointPreview.point.x} y={pointPreview.point.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {pointPreview && pointPreview.tool === 'pile' && (
              <>
                <Circle
                  x={pointPreview.point.x}
                  y={pointPreview.point.y}
                  radius={(PILE_DEFAULT_DIAMETER * 100) / 2}
                  fill="rgba(34, 211, 238, 0.12)"
                  stroke={pointPreview.snap ? '#06b6d4' : COLORS.select}
                  strokeWidth={2 / zoom}
                  dash={[6 / zoom, 3 / zoom]}
                  listening={false}
                />
                <Circle x={pointPreview.point.x} y={pointPreview.point.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
              </>
            )}
            {blockInsertPreview && (
              <>
                {blockInsertPreview.map((ghost) => (
                  <GhostItem key={ghost.id} element={ghost} layers={state.layers} />
                ))}
                {state.draft && (
                  <Circle x={state.draft.end.x} y={state.draft.end.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
                )}
              </>
            )}
            {dimensionDraftPreview && (
              <>
                {dimensionDraftPreview.lines.map((line, index) => (
                  <Line
                    key={`dimension-draft-line-${index}`}
                    points={[line.start.x, line.start.y, line.end.x, line.end.y]}
                    stroke={COLORS.select}
                    strokeWidth={2 / zoom}
                    dash={[8 / zoom, 4 / zoom]}
                    listening={false}
                  />
                ))}
                {dimensionDraftPreview.arcs.map((arc, index) => (
                  <Line
                    key={`dimension-draft-arc-${index}`}
                    points={sampleArcPoints(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, false).flatMap((point) => [point.x, point.y])}
                    stroke={COLORS.select}
                    strokeWidth={2 / zoom}
                    dash={[8 / zoom, 4 / zoom]}
                    listening={false}
                  />
                ))}
                <Text
                  x={dimensionDraftPreview.text.point.x}
                  y={dimensionDraftPreview.text.point.y}
                  text={dimensionDraftPreview.text.value}
                  fontSize={paperToWorld(dimStyle.text_height, annotationScale)}
                  fill={COLORS.select}
                  listening={false}
                />
              </>
            )}
            {state.draft?.snap && (
              <Circle
                x={state.draft.snap.point.x}
                y={state.draft.snap.point.y}
                radius={state.draft.snap.target.type === 'intersection' ? 12 / zoom : 8 / zoom}
                fill="transparent"
                stroke={state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'point' ? '#06b6d4' : COLORS.select}
                strokeWidth={2 / zoom}
                listening={false}
              />
            )}
            {polarGuide && (
              <Line
                points={[polarGuide.x1, polarGuide.y1, polarGuide.x2, polarGuide.y2]}
                stroke="#06b6d4"
                strokeWidth={1 / zoom}
                dash={[4 / zoom, 6 / zoom]}
                opacity={0.5}
                listening={false}
              />
            )}
            {draftMeasurement && (
              <Label
                x={draftMeasurement.end.x + 14 / zoom}
                y={draftMeasurement.end.y - 18 / zoom}
                scaleX={1 / zoom}
                scaleY={1 / zoom}
                listening={false}
              >
                <Tag fill="#0f172a" cornerRadius={4} opacity={0.9} />
                <Text text={draftMeasurement.text} fontSize={12} fill="#f8fafc" padding={6} />
              </Label>
            )}
            {/* Edit-session ghosts: transformed elements in cyan, new clones
                (copy / offset / array / fillet arc) in green. */}
            {editPreview?.replaced.map((ghost, index) =>
              outlineSegments(ghost).map(([a, b], seg) => (
                <Line
                  key={`ghost-edit-${index}-${seg}`}
                  points={[a.x, a.y, b.x, b.y]}
                  stroke={COLORS.select}
                  strokeWidth={1.5 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  opacity={0.85}
                  listening={false}
                />
              )),
            )}
            {editPreview?.added.map((ghost, index) =>
              outlineSegments(ghost).map(([a, b], seg) => (
                <Line
                  key={`ghost-add-${index}-${seg}`}
                  points={[a.x, a.y, b.x, b.y]}
                  stroke="#4ade80"
                  strokeWidth={1.5 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  opacity={0.85}
                  listening={false}
                />
              )),
            )}
            {/* Session markers: base point anchor, rubber line to the cursor
                and the shared snap ring. */}
            {state.edit?.base && (
              <Circle x={state.edit.base.x} y={state.edit.base.y} radius={5 / zoom} fill={COLORS.select} listening={false} />
            )}
            {state.edit?.ref && state.edit.phase === 'target' && (
              <Circle x={state.edit.ref.x} y={state.edit.ref.y} radius={4 / zoom} fill="none" stroke={COLORS.select} strokeWidth={1.5 / zoom} listening={false} />
            )}
            {state.edit?.base && state.edit.cursor && (
              <Line
                points={[state.edit.base.x, state.edit.base.y, state.edit.cursor.x, state.edit.cursor.y]}
                stroke={COLORS.select}
                strokeWidth={1 / zoom}
                dash={[4 / zoom, 4 / zoom]}
                opacity={0.6}
                listening={false}
              />
            )}
            {state.edit?.snap && (
              <Circle
                x={state.edit.snap.point.x}
                y={state.edit.snap.point.y}
                radius={8 / zoom}
                fill="transparent"
                stroke={COLORS.select}
                strokeWidth={2 / zoom}
                listening={false}
              />
            )}
            {dragging && dragStart && dragEnd && (
              <Rect
                x={Math.min(dragStart.x, dragEnd.x)}
                y={Math.min(dragStart.y, dragEnd.y)}
                width={Math.abs(dragEnd.x - dragStart.x)}
                height={Math.abs(dragEnd.y - dragStart.y)}
                fill={dragBoxMode === 'crossing' ? 'rgba(74, 222, 128, 0.10)' : 'rgba(34, 211, 238, 0.08)'}
                stroke={dragBoxMode === 'crossing' ? '#4ade80' : COLORS.select}
                strokeWidth={1 / zoom}
                dash={dragBoxMode === 'crossing' ? [6 / zoom, 4 / zoom] : undefined}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      )}
      {state.edit && (
        <div
          data-testid="edit-prompt"
          className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs shadow-lg"
        >
          <span className="font-semibold uppercase tracking-wide text-cyan-300">
            {te(`ops.${state.edit.op}`)}
          </span>
          <span className="text-slate-400">{te(`prompt.${editPromptKey(state.edit)}`)}</span>
          {lengthInput && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-200">{lengthInput}</span>
          )}
          {state.edit.phase === 'pick' && state.edit.ids.length > 0 && (
            <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-cyan-300">{state.edit.ids.length}</span>
          )}
        </div>
      )}
      {state.annotationEditingId && annotationEditorAnchor && (
        <textarea
          ref={annotationInputRef}
          key={`${state.annotationEditingId}:${editingCell?.row ?? ''}:${editingCell?.col ?? ''}:${state.annotationEditingNew ? 'new' : 'existing'}`}
          data-testid="annotation-editor"
          aria-label={t('annotationEditor')}
          defaultValue={state.annotationEditingNew ? '' : annotationText}
          onChange={(event) => setAnnotationText(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              finishAnnotationEditor(true);
            } else if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              finishAnnotationEditor();
            }
          }}
          style={{
            left: pan.x + annotationEditorAnchor.x * zoom,
            top: pan.y + annotationEditorAnchor.y * zoom,
            fontSize: Math.max(12, paperToWorld(dimStyle.text_height, annotationScale) * zoom),
          }}
          className="absolute z-30 min-h-8 min-w-40 resize border border-cyan-500 bg-slate-950/95 px-2 py-1 text-slate-100 outline-none"
        />
      )}
    </div>
  );
}

function AnnotationArrow({
  arrow,
  color,
  zoom,
}: {
  arrow: { tip: Point; angle: number; kind: DimStyle['arrow']; size: number };
  color: string;
  zoom: number;
}) {
  if (arrow.kind === 'dot') {
    return <Circle x={arrow.tip.x} y={arrow.tip.y} radius={Math.max(2 / zoom, arrow.size / 2)} fill={color} listening={false} />;
  }
  if (arrow.kind === 'tick') {
    const angle = arrow.angle + Math.PI / 4;
    const dx = Math.cos(angle) * arrow.size * 0.6;
    const dy = Math.sin(angle) * arrow.size * 0.6;
    return <Line points={[arrow.tip.x - dx, arrow.tip.y - dy, arrow.tip.x + dx, arrow.tip.y + dy]} stroke={color} strokeWidth={1.5 / zoom} listening={false} />;
  }
  const back = { x: arrow.tip.x - Math.cos(arrow.angle) * arrow.size, y: arrow.tip.y - Math.sin(arrow.angle) * arrow.size };
  const half = arrow.size * 0.35;
  const px = Math.cos(arrow.angle + Math.PI / 2) * half;
  const py = Math.sin(arrow.angle + Math.PI / 2) * half;
  return <Line points={[arrow.tip.x, arrow.tip.y, back.x + px, back.y + py, back.x - px, back.y - py]} closed fill={color} stroke={color} strokeWidth={1 / zoom} listening={false} />;
}

/** Renders one ghost element of a block instance — a simplified outline
 *  per draw mode, non-listening, colored by the item's own layer. */
function GhostItem({ element, layers }: { element: ProjectElement; layers: PlanLayer[] }) {
  const stroke = colorFor(element, false, false, layers);
  const resolved = resolveLineStyle(element, layers);
  const mode = drawMode(element);

  if (mode === 'point') {
    const props = element.properties as { width?: number; depth?: number; diameter?: number; shape?: string };
    if (props.shape === 'circular' && props.diameter) {
      return <Circle x={element.x1} y={element.y1} radius={(props.diameter * 100) / 2} fill={stroke} opacity={0.9} listening={false} />;
    }
    const w = (props.width ?? 0.3) * 100;
    const h = (props.depth ?? props.diameter ?? 0.3) * 100;
    return (
      <Rect
        x={element.x1}
        y={element.y1}
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={(element.rotation * 180) / Math.PI}
        fill={stroke}
        opacity={0.9}
        listening={false}
      />
    );
  }
  if (mode === 'center') {
    const radius = (element.properties as { radius?: number }).radius ?? Math.abs(element.x2 - element.x1);
    return <Circle x={element.x1} y={element.y1} radius={radius} stroke={stroke} strokeWidth={resolved.width ?? 2} dash={resolved.dash} listening={false} />;
  }
  if (mode === 'poly') {
    const points = ((element.properties as { points?: Point[] }).points ?? []).flatMap((p) => [p.x, p.y]);
    if (points.length < 4) return null;
    return <Line points={points} stroke={stroke} strokeWidth={resolved.width ?? 2} dash={resolved.dash} lineCap="round" lineJoin="round" listening={false} />;
  }
  if (mode === 'arc') {
    const props = (element as ArcElement).properties;
    const flat = sampleArcPoints(props.cx, props.cy, props.radius, props.start_angle, props.end_angle, props.clockwise).flatMap((p) => [p.x, p.y]);
    return <Line points={flat} stroke={stroke} strokeWidth={resolved.width ?? 2} dash={resolved.dash} lineCap="round" lineJoin="round" listening={false} />;
  }
  if (mode === 'rect') {
    const r = rectOf(element);
    return (
      <Rect
        x={r.x + r.w / 2}
        y={r.y + r.h / 2}
        width={r.w}
        height={r.h}
        offsetX={r.w / 2}
        offsetY={r.h / 2}
        rotation={(element.rotation * 180) / Math.PI}
        stroke={stroke}
        strokeWidth={resolved.width ?? 2}
        dash={resolved.dash}
        fill={fillFor(element) ?? 'rgba(148, 163, 184, 0.08)'}
        listening={false}
      />
    );
  }
  const style = lineStyle(element);
  return (
    <Line
      points={[element.x1, element.y1, element.x2, element.y2]}
      stroke={stroke}
      strokeWidth={GEOMETRY_WIDTH_TYPES.has(element.element_type) ? style.width : (resolved.width ?? style.width)}
      dash={resolved.dash ?? style.dash}
      lineCap="butt"
      listening={false}
    />
  );
}

function StairDetails({ element, stroke, zoom, origin }: { element: ProjectElement; stroke: string; zoom: number; origin: Point }) {
  const r = rectOf(element);
  const ox = origin.x;
  const oy = origin.y;
  const props = element.properties as { run_axis?: 'x' | 'y'; step_count?: number };
  const runAxis = props.run_axis ?? (r.w >= r.h ? 'x' : 'y');
  const steps = Math.max(2, Math.min(30, props.step_count ?? 10));
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < steps; i += 1) {
    const f = i / steps;
    if (runAxis === 'x') {
      const x = r.x + r.w * f - ox;
      lines.push(<Line key={i} points={[x, r.y - oy, x, r.y + r.h - oy]} stroke={stroke} strokeWidth={1 / Math.max(zoom, 0.5)} opacity={0.7} listening={false} />);
    } else {
      const y = r.y + r.h * f - oy;
      lines.push(<Line key={i} points={[r.x - ox, y, r.x + r.w - ox, y]} stroke={stroke} strokeWidth={1 / Math.max(zoom, 0.5)} opacity={0.7} listening={false} />);
    }
  }
  // Direction arrow along the run axis.
  const cx = r.x + r.w / 2 - ox;
  const cy = r.y + r.h / 2 - oy;
  const arrow = runAxis === 'x'
    ? [r.x + r.w * 0.15 - ox, cy, r.x + r.w * 0.85 - ox, cy]
    : [cx, r.y + r.h * 0.15 - oy, cx, r.y + r.h * 0.85 - oy];
  return (
    <>
      {lines}
      <Line points={arrow} stroke={stroke} strokeWidth={1.5} dash={[6, 3]} listening={false} />
    </>
  );
}

function RampArrow({ element, stroke, zoom, origin }: { element: ProjectElement; stroke: string; zoom: number; origin: Point }) {
  const r = rectOf(element);
  const ox = origin.x;
  const oy = origin.y;
  const cx = r.x + r.w / 2 - ox;
  const cy = r.y + r.h / 2 - oy;
  const alongX = r.w >= r.h;
  const line = alongX
    ? [r.x + r.w * 0.15 - ox, cy, r.x + r.w * 0.8 - ox, cy]
    : [cx, r.y + r.h * 0.15 - oy, cx, r.y + r.h * 0.8 - oy];
  const tip = alongX ? { x: r.x + r.w * 0.8 - ox, y: cy } : { x: cx, y: r.y + r.h * 0.8 - oy };
  const headSize = Math.min(14, r.w * 0.08);
  const head = alongX
    ? [tip.x - headSize, tip.y - headSize * 0.6, tip.x, tip.y, tip.x - headSize, tip.y + headSize * 0.6]
    : [tip.x - headSize * 0.6, tip.y - headSize, tip.x, tip.y, tip.x + headSize * 0.6, tip.y - headSize];
  return (
    <>
      <Line points={line} stroke={stroke} strokeWidth={1.5} listening={false} />
      <Line points={head} stroke={stroke} strokeWidth={1.5} listening={false} />
      <Text
        text={`${(element.properties as { slope_percent?: number }).slope_percent ?? 0}%`}
        x={alongX ? r.x + r.w * 0.15 - ox : r.x + 6 - ox}
        y={alongX ? r.y + 6 - oy : r.y + r.h * 0.15 - oy}
        fontSize={Math.max(10, 12 / Math.max(zoom, 0.5))}
        fill={stroke}
        listening={false}
      />
    </>
  );
}
