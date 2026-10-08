'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Stage, Layer, Line, Circle, Rect, Ellipse, Text, Label, Tag } from 'react-konva';
import type Konva from 'konva';
import type { EditorState } from '@/hooks/use-editor-state';
import type { Point } from '@/lib/editor/geometry';
import { ccwSweep, distance, lineIntersection, sampleArcPoints, toRadians } from '@/lib/editor/geometry';
import { cmToDisplay, displayToCm, formatAngle, formatDisplayValue } from '@/lib/editor/units';
import type { ArcElement, CircleElement, DrawMode, PolylineElement, ProjectElement } from '@/types/project';
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
import { isElementLocked, isElementVisible, layerOf } from '@/lib/editor/layers';
import type { PlanLayer } from '@/types/project';

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
  const layerColor = layerOf(element, layers)?.color;
  if (layerColor) return layerColor;
  return typeColor(element);
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
  actions: {
    beginDraft: (point: Point) => void;
    updateDraft: (point: Point, exact?: boolean) => void;
    extendDraft: () => void;
    commitDraft: (close?: boolean) => void;
    cancelDraft: () => void;
    select: (id: string, add: boolean) => void;
    selectMany: (ids: string[]) => void;
    clearSelection: () => void;
    updateElement: (id: string, changes: Partial<ProjectElement>) => void;
    setZoom: (zoom: number) => void;
    pan: (delta: Point) => void;
    setTool: (tool: EditorState['tool']) => void;
  };
  stageRef: MutableRefObject<Konva.Stage | null>;
};

export function CanvasStage({ state, displayUnit, actions, stageRef }: CanvasStageProps) {
  const t = useTranslations('editor.canvas');
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

  const activeToolMode = state.tool === 'select' ? null : drawModeOf(state.tool);

  useEffect(() => {
    const draft = state.draft;
    const draftMode = draft && draft.tool !== 'select' ? drawModeOf(draft.tool) : null;
    const activeDraft = draft && draftMode && draftMode !== 'point' ? draft : null;
    const toolArmed = state.tool !== 'select';

    function handleLengthKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const buffer = lengthInputRef.current;
      const setBuffer = (value: string) => {
        lengthInputRef.current = value;
        setLengthInput(value);
      };
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
          if (!toolArmed || state.tool === 'select') return;
          actions.beginDraft(point);
          if (drawModeOf(state.tool) === 'point') actions.commitDraft();
          return;
        }
        actions.updateDraft(point, true);
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
  }, [actions, displayUnit, state.draft, state.tool]);

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
    if (state.tool === 'select') {
      actions.clearSelection();
      setDragStart(world);
      setDragEnd(world);
      setDragging(true);
      return;
    }
    if (!state.draft && activeToolMode === 'point') {
      actions.beginDraft(world);
      actions.commitDraft();
      return;
    }
    advanceDraftClick(world);
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
    if (!state.draft) {
      if (activeToolMode === 'point') {
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
      const minX = Math.min(dragStart.x, dragEnd.x);
      const minY = Math.min(dragStart.y, dragEnd.y);
      const maxX = Math.max(dragStart.x, dragEnd.x);
      const maxY = Math.max(dragStart.y, dragEnd.y);
      const ids = visibleElements
        .filter((el) => !isElementLocked(el, state.layers) && isInsideBox(el, minX, minY, maxX, maxY))
        .map((el) => el.id);
      if (ids.length) actions.selectMany(ids);
    }
    setDragStart(null);
    setDragEnd(null);
  }

  function isInsideBox(el: ProjectElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
    const mode = drawMode(el);
    const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    if (mode === 'point') {
      return inside({ x: el.x1, y: el.y1 });
    }
    if (mode === 'rect') {
      const r = rectOf(el);
      return r.x < maxX && r.x + r.w > minX && r.y < maxY && r.y + r.h > minY;
    }
    if (mode === 'center') {
      const radius = (el.properties as { radius?: number }).radius ?? Math.abs(el.x2 - el.x1);
      return el.x1 - radius < maxX && el.x1 + radius > minX && el.y1 - radius < maxY && el.y1 + radius > minY;
    }
    if (mode === 'poly') {
      const points = (el.properties as { points?: Point[] }).points ?? [];
      return points.some(inside) || inside({ x: el.x1, y: el.y1 }) || inside({ x: el.x2, y: el.y2 });
    }
    if (mode === 'arc') {
      const props = (el as ArcElement).properties;
      return inside({ x: el.x1, y: el.y1 }) || inside({ x: el.x2, y: el.y2 }) || inside(props.mid);
    }
    return inside({ x: el.x1, y: el.y1 }) || inside({ x: el.x2, y: el.y2 });
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

  function handleElementDragEnd(e: any, element: ProjectElement) {
    const position = e.target.position();
    if (!position.x && !position.y) return;
    actions.updateElement(element.id, {
      x1: element.x1 + position.x,
      y1: element.y1 + position.y,
      x2: element.x2 + position.x,
      y2: element.y2 + position.y,
    });
    e.target.position({ x: 0, y: 0 });
  }

  function handleEndpointDragEnd(e: any, element: ProjectElement, endpoint: 'start' | 'end') {
    const rawPoint = e.target.position() as Point;
    const snap = element.element_type === 'wall'
      ? snapForWall(rawPoint, state.elements, zoom, 1, element.id)
      : snapToNearest(rawPoint, state.elements, zoom, 1, element.id);
    const point = snap?.point ?? rawPoint;
    const changes = endpoint === 'start'
      ? { x1: point.x, y1: point.y }
      : { x2: point.x, y2: point.y };
    actions.updateElement(element.id, changes);
    e.target.position({ x: 0, y: 0 });
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
              const selected = state.selectedIds.includes(el.id);
              const hovered = hoverId === el.id;
              const locked = isElementLocked(el, state.layers);
              const stroke = colorFor(el, selected, hovered, state.layers);
              const mode = drawMode(el);
              const interactive = {
                onMouseDown: (e: any) => handleShapeClick(e, el),
                onTouchStart: (e: any) => handleShapeClick(e, el),
                onMouseEnter: () => setHoverId(el.id),
                onMouseLeave: () => setHoverId(null),
              };
              const draggable = state.tool === 'select' && selected && !locked && !state.readOnly;

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
                      opacity={locked ? 0.45 : 0.9}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                    opacity={locked ? 0.45 : 0.9}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                      strokeWidth={2.5}
                      fill={selected ? 'rgba(34, 211, 238, 0.15)' : 'rgba(249, 115, 22, 0.12)'}
                      dash={[6, 3]}
                      opacity={locked ? 0.45 : 1}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                    strokeWidth={2}
                    fill={selected ? 'rgba(34, 211, 238, 0.10)' : undefined}
                    opacity={locked ? 0.45 : 1}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                    strokeWidth={2}
                    lineCap="round"
                    lineJoin="round"
                    opacity={locked ? 0.45 : 1}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                    strokeWidth={2}
                    lineCap="round"
                    lineJoin="round"
                    opacity={locked ? 0.45 : 1}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el)}
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
                    radiusX={r.w / 2}
                    radiusY={r.h / 2}
                    stroke={stroke}
                    strokeWidth={2}
                    fill={selected ? 'rgba(34, 211, 238, 0.10)' : undefined}
                    opacity={locked ? 0.45 : 1}
                    draggable={draggable}
                    onDragEnd={(e) => handleElementDragEnd(e, el)}
                    {...interactive}
                  />
                );
              }

              if (el.element_type === 'hatch') {
                const r = rectOf(el);
                const hatch = el.properties as { pattern?: 'ansi31' | 'cross' | 'grid'; spacing?: number; angle?: number };
                const segments = hatchSegments({ x: r.x, y: r.y, width: r.w, height: r.h }, hatch.pattern ?? 'ansi31', hatch.spacing ?? 35, hatch.angle ?? 45);
                return (
                  <Fragment key={el.id}>
                    <Rect
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      stroke={stroke}
                      strokeWidth={1.5}
                      fill={selected ? 'rgba(34, 211, 238, 0.08)' : 'rgba(100, 116, 139, 0.08)'}
                      opacity={locked ? 0.45 : 1}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el)}
                      {...interactive}
                    />
                    <Line
                      points={segments}
                      stroke={stroke}
                      strokeWidth={0.8}
                      opacity={locked ? 0.3 : 0.85}
                      listening={false}
                    />
                  </Fragment>
                );
              }

              if (mode === 'rect') {
                const r = rectOf(el);
                const fill = fillFor(el);
                const isOpening = el.element_type === 'opening';
                return (
                  <Fragment key={el.id}>
                    <Rect
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      fill={selected ? 'rgba(34, 211, 238, 0.14)' : fill ?? 'rgba(148, 163, 184, 0.12)'}
                      stroke={stroke}
                      strokeWidth={isOpening ? 1.5 : 2}
                      dash={isOpening || el.element_type === 'footing' ? [8, 4] : undefined}
                      opacity={locked ? 0.45 : 1}
                      draggable={draggable}
                      onDragEnd={(e) => handleElementDragEnd(e, el)}
                      {...interactive}
                    />
                    {el.element_type === 'stair' && <StairDetails element={el} stroke={stroke} zoom={zoom} />}
                    {el.element_type === 'ramp' && <RampArrow element={el} stroke={stroke} zoom={zoom} />}
                    {isOpening && (
                      <>
                        <Line points={[r.x, r.y, r.x + r.w, r.y + r.h]} stroke={stroke} strokeWidth={1} opacity={0.6} listening={false} />
                        <Line points={[r.x, r.y + r.h, r.x + r.w, r.y]} stroke={stroke} strokeWidth={1} opacity={0.6} listening={false} />
                      </>
                    )}
                    {el.element_type === 'footing' && (
                      <>
                        <Line points={[r.x, r.y, r.x + r.w, r.y + r.h]} stroke={stroke} strokeWidth={1} dash={[4, 4]} opacity={0.5} listening={false} />
                        <Line points={[r.x, r.y + r.h, r.x + r.w, r.y]} stroke={stroke} strokeWidth={1} dash={[4, 4]} opacity={0.5} listening={false} />
                      </>
                    )}
                  </Fragment>
                );
              }

              const style = lineStyle(el);
              return (
                <Line
                  key={el.id}
                  points={[el.x1, el.y1, el.x2, el.y2]}
                  stroke={stroke}
                  strokeWidth={style.width}
                  dash={style.dash}
                  lineCap="butt"
                  lineJoin="miter"
                  opacity={locked ? 0.45 : 1}
                  draggable={draggable}
                  onDragEnd={(e) => handleElementDragEnd(e, el)}
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
            {visibleElements.filter((el) => state.selectedIds.includes(el.id) && !isElementLocked(el, state.layers) && ['line', 'rect', 'arc'].includes(drawMode(el))).map((el) => (
              <Fragment key={`handles-${el.id}`}>
                <Circle
                  key={`handle-start-${el.id}`}
                  x={el.x1}
                  y={el.y1}
                  radius={7 / zoom}
                  fill={COLORS.handleFill}
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  draggable={state.tool === 'select' && !state.readOnly}
                  onMouseDown={(e) => { e.cancelBubble = true; }}
                  onDragEnd={(e) => handleEndpointDragEnd(e, el, 'start')}
                />
                <Circle
                  key={`handle-end-${el.id}`}
                  x={el.x2}
                  y={el.y2}
                  radius={7 / zoom}
                  fill={COLORS.handleFill}
                  stroke={COLORS.select}
                  strokeWidth={2 / zoom}
                  draggable={state.tool === 'select' && !state.readOnly}
                  onMouseDown={(e) => { e.cancelBubble = true; }}
                  onDragEnd={(e) => handleEndpointDragEnd(e, el, 'end')}
                />
              </Fragment>
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
            {state.draft && state.draft.tool !== 'select' && drawModeOf(state.draft.tool) === 'rect' && (
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
            {dragging && dragStart && dragEnd && (
              <Rect
                x={Math.min(dragStart.x, dragEnd.x)}
                y={Math.min(dragStart.y, dragEnd.y)}
                width={Math.abs(dragEnd.x - dragStart.x)}
                height={Math.abs(dragEnd.y - dragStart.y)}
                fill="rgba(34, 211, 238, 0.08)"
                stroke={COLORS.select}
                strokeWidth={1 / zoom}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function StairDetails({ element, stroke, zoom }: { element: ProjectElement; stroke: string; zoom: number }) {
  const r = rectOf(element);
  const props = element.properties as { run_axis?: 'x' | 'y'; step_count?: number };
  const runAxis = props.run_axis ?? (r.w >= r.h ? 'x' : 'y');
  const steps = Math.max(2, Math.min(30, props.step_count ?? 10));
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < steps; i += 1) {
    const f = i / steps;
    if (runAxis === 'x') {
      const x = r.x + r.w * f;
      lines.push(<Line key={i} points={[x, r.y, x, r.y + r.h]} stroke={stroke} strokeWidth={1 / Math.max(zoom, 0.5)} opacity={0.7} listening={false} />);
    } else {
      const y = r.y + r.h * f;
      lines.push(<Line key={i} points={[r.x, y, r.x + r.w, y]} stroke={stroke} strokeWidth={1 / Math.max(zoom, 0.5)} opacity={0.7} listening={false} />);
    }
  }
  // Direction arrow along the run axis.
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const arrow = runAxis === 'x'
    ? [r.x + r.w * 0.15, cy, r.x + r.w * 0.85, cy]
    : [cx, r.y + r.h * 0.15, cx, r.y + r.h * 0.85];
  return (
    <>
      {lines}
      <Line points={arrow} stroke={stroke} strokeWidth={1.5} dash={[6, 3]} listening={false} />
    </>
  );
}

function RampArrow({ element, stroke, zoom }: { element: ProjectElement; stroke: string; zoom: number }) {
  const r = rectOf(element);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const alongX = r.w >= r.h;
  const line = alongX
    ? [r.x + r.w * 0.15, cy, r.x + r.w * 0.8, cy]
    : [cx, r.y + r.h * 0.15, cx, r.y + r.h * 0.8];
  const tip = alongX ? { x: r.x + r.w * 0.8, y: cy } : { x: cx, y: r.y + r.h * 0.8 };
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
        x={alongX ? r.x + r.w * 0.15 : r.x + 6}
        y={alongX ? r.y + 6 : r.y + r.h * 0.15}
        fontSize={Math.max(10, 12 / Math.max(zoom, 0.5))}
        fill={stroke}
        listening={false}
      />
    </>
  );
}
