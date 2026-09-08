'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorState } from '@/hooks/use-editor-state';
import type { Point } from '@/lib/editor/geometry';
import { distance, lineIntersection } from '@/lib/editor/geometry';
import { cmToDisplay, formatAngle, formatDisplayValue } from '@/lib/editor/units';
import type { ProjectElement } from '@/types/project';
import type { DisplayUnit } from '@/lib/editor/units';
import { COLUMN_DEFAULT_DEPTH, COLUMN_DEFAULT_WIDTH } from '@/lib/editor/elements';

const GRID_STEP = 100;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

function boundZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function isLineType(type: ProjectElement['element_type']): boolean {
  return type === 'wall' || type === 'door' || type === 'window' || type === 'beam';
}

function colorFor(element: ProjectElement, selected: boolean, hovered: boolean): string {
  if (selected) return '#1e40af';
  if (hovered) return '#2563eb';
  switch (element.element_type) {
    case 'wall':
      return '#1f2937';
    case 'door':
      return '#4b5563';
    case 'window':
      return '#6b7280';
    case 'beam':
      return '#374151';
    case 'column':
      return '#374151';
    default:
      return '#374151';
  }
}

function worldFromScreen(screen: Point, pan: Point, zoom: number): Point {
  return { x: (screen.x - pan.x) / zoom, y: (screen.y - pan.y) / zoom };
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
    updateDraft: (point: Point) => void;
    commitDraft: () => void;
    select: (id: string, add: boolean) => void;
    selectMany: (ids: string[]) => void;
    clearSelection: () => void;
    setZoom: (zoom: number) => void;
    pan: (delta: Point) => void;
    setTool: (tool: EditorState['tool']) => void;
  };
  stageRef: MutableRefObject<Konva.Stage | null>;
};

export function CanvasStage({ state, displayUnit, actions, stageRef }: CanvasStageProps) {
  const { ref, size } = useContainerSize();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const { zoom, pan } = state.viewport;

  const intersections = useMemo(() => {
    const lineElements = state.elements.filter((el) => isLineType(el.element_type));
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
  }, [state.elements]);

  const grid = useMemo(
    () => gridPoints(state.showGrid, size.width, size.height, pan, zoom),
    [state.showGrid, size.width, size.height, pan, zoom],
  );

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
    if (!state.draft) {
      if (state.tool === 'column') {
        actions.beginDraft(world);
        actions.commitDraft();
      } else {
        actions.beginDraft(world);
      }
    } else {
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
      if (state.tool === 'column') {
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
      const ids = state.elements
        .filter((el) => isInsideBox(el, minX, minY, maxX, maxY))
        .map((el) => el.id);
      if (ids.length) actions.selectMany(ids);
    }
    setDragStart(null);
    setDragEnd(null);
  }

  function isInsideBox(el: ProjectElement, minX: number, minY: number, maxX: number, maxY: number): boolean {
    const p1Inside = el.x1 >= minX && el.x1 <= maxX && el.y1 >= minY && el.y1 <= maxY;
    const p2Inside = el.x2 >= minX && el.x2 <= maxX && el.y2 >= minY && el.y2 <= maxY;
    return p1Inside || p2Inside;
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

  function handleShapeClick(e: any, id: string) {
    e.cancelBubble = true;
    actions.select(id, e.evt.ctrlKey || e.evt.metaKey);
    if (state.tool !== 'select') {
      actions.setTool('select');
    }
  }

  const draftMeasurement = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool === 'column') return null;
    const length = distance(draft.start, draft.end);
    const angle = Math.atan2(draft.end.y - draft.start.y, draft.end.x - draft.start.x);
    const displayValue = formatDisplayValue(cmToDisplay(length, displayUnit), displayUnit);
    return { text: `${displayValue}\n${formatAngle(angle)}`, end: draft.end };
  }, [state.draft, displayUnit]);

  const columnPreview = useMemo(() => {
    const draft = state.draft;
    if (!draft || draft.tool !== 'column') return null;
    const width = COLUMN_DEFAULT_WIDTH * 100;
    const depth = COLUMN_DEFAULT_DEPTH * 100;
    return { point: draft.end, snap: draft.snap, width, depth };
  }, [state.draft]);

  return (
    <div ref={ref} className="relative h-full w-full cursor-crosshair bg-white">
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
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onWheel={handleStageWheel}
          style={{ background: '#ffffff' }}
        >
          <Layer>
            <Rect
              x={-pan.x / zoom}
              y={-pan.y / zoom}
              width={size.width / zoom}
              height={size.height / zoom}
              fill="#ffffff"
              listening={false}
            />
            {state.showGrid && <Line points={grid} stroke="#e5e7eb" strokeWidth={1 / zoom} listening={false} />}
          </Layer>
          <Layer>
            {state.elements.map((el) => {
              const selected = state.selectedIds.includes(el.id);
              const hovered = hoverId === el.id;
              const stroke = colorFor(el, selected, hovered);
              if (el.element_type === 'column') {
                const props = el.properties as { width: number; depth: number };
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
                    opacity={0.9}
                    onMouseDown={(e) => handleShapeClick(e, el.id)}
                    onMouseEnter={() => setHoverId(el.id)}
                    onMouseLeave={() => setHoverId(null)}
                  />
                );
              }
              const thickness =
                el.element_type === 'wall'
                  ? (el.properties as { thickness: number }).thickness * 100
                  : el.element_type === 'beam'
                    ? (el.properties as { width: number }).width * 100
                    : 6;
              return (
                <Line
                  key={el.id}
                  points={[el.x1, el.y1, el.x2, el.y2]}
                  stroke={stroke}
                  strokeWidth={thickness}
                  lineCap="butt"
                  lineJoin="miter"
                  onMouseDown={(e) => handleShapeClick(e, el.id)}
                  onMouseEnter={() => setHoverId(el.id)}
                  onMouseLeave={() => setHoverId(null)}
                />
              );
            })}
            {intersections.map((p, index) => (
              <Circle
                key={`intersection-${index}`}
                x={p.x}
                y={p.y}
                radius={3 / zoom}
                fill="#6b7280"
                listening={false}
              />
            ))}
            {state.elements.map((el) => (
              <Circle
                key={`start-${el.id}`}
                x={el.x1}
                y={el.y1}
                radius={4 / zoom}
                fill={state.selectedIds.includes(el.id) ? '#1e40af' : '#6b7280'}
                listening={false}
              />
            ))}
            {state.elements.map((el) => (
              <Circle
                key={`end-${el.id}`}
                x={el.x2}
                y={el.y2}
                radius={4 / zoom}
                fill={state.selectedIds.includes(el.id) ? '#1e40af' : '#6b7280'}
                listening={false}
              />
            ))}
            {state.draft && state.draft.tool !== 'column' && (
              <>
                <Line
                  points={[state.draft.start.x, state.draft.start.y, state.draft.end.x, state.draft.end.y]}
                  stroke="#1e40af"
                  strokeWidth={2 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                  listening={false}
                />
                <Circle
                  x={state.draft.start.x}
                  y={state.draft.start.y}
                  radius={5 / zoom}
                  fill="#1e40af"
                  listening={false}
                />
                <Circle
                  x={state.draft.end.x}
                  y={state.draft.end.y}
                  radius={5 / zoom}
                  fill="#1e40af"
                  listening={false}
                />
              </>
            )}
            {columnPreview && (
              <>
                <Rect
                  x={columnPreview.point.x}
                  y={columnPreview.point.y}
                  width={columnPreview.width}
                  height={columnPreview.depth}
                  offsetX={columnPreview.width / 2}
                  offsetY={columnPreview.depth / 2}
                  fill="rgba(30, 64, 175, 0.15)"
                  stroke={columnPreview.snap ? '#06b6d4' : '#1e40af'}
                  strokeWidth={2 / zoom}
                  listening={false}
                />
                <Circle
                  x={columnPreview.point.x}
                  y={columnPreview.point.y}
                  radius={5 / zoom}
                  fill="#1e40af"
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
                stroke={state.draft.tool === 'column' ? '#06b6d4' : '#1e40af'}
                strokeWidth={2 / zoom}
                listening={false}
              />
            )}
            {draftMeasurement && (
              <Text
                x={draftMeasurement.end.x + 12 / zoom}
                y={draftMeasurement.end.y - 28 / zoom}
                text={draftMeasurement.text}
                fontSize={12}
                fill="#1e40af"
                scaleX={1 / zoom}
                scaleY={1 / zoom}
                listening={false}
              />
            )}
            {dragging && dragStart && dragEnd && (
              <Rect
                x={Math.min(dragStart.x, dragEnd.x)}
                y={Math.min(dragStart.y, dragEnd.y)}
                width={Math.abs(dragEnd.x - dragStart.x)}
                height={Math.abs(dragEnd.y - dragStart.y)}
                fill="rgba(30, 64, 175, 0.08)"
                stroke="#1e40af"
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
