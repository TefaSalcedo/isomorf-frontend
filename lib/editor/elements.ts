import type {
  Project,
  ProjectElement,
  ElementType,
  DrawMode,
  PlanPoint,
  WallElement,
  ColumnElement,
  BeamElement,
  DoorElement,
  WindowElement,
  JoistElement,
  GradeBeamElement,
  BraceElement,
  PileElement,
  SlabElement,
  FootingElement,
  StairElement,
  RampElement,
  OpeningElement,
  LineElement,
  PolylineElement,
  ArcElement,
  CircleElement,
  EllipseElement,
  RectangleElement,
  HatchElement,
} from '@/types/project';
import { ccwSweep, circleThroughPoints, cmToMeters, distance, metersToCm, normalizeAngle, pointsEqual, resolveTJoin } from '@/lib/editor/geometry';

export const WALL_DEFAULT_HEIGHT = 2.5;
export const WALL_DEFAULT_THICKNESS = 0.15;
export const WALL_DEFAULT_JOIN_ANGLE = 90;

export const COLUMN_DEFAULT_WIDTH = 0.3;
export const COLUMN_DEFAULT_DEPTH = 0.3;
export const COLUMN_DEFAULT_HEIGHT = 2.5;

export const BEAM_DEFAULT_WIDTH = 0.2;
export const BEAM_DEFAULT_HEIGHT = 0.3;
export const BEAM_DEFAULT_ELEVATION = 2.5;

export const SLAB_DEFAULT_THICKNESS = 0.15;
export const FOOTING_DEFAULT_DEPTH = 0.4;
export const STAIR_DEFAULT_TREAD = 0.28;
export const STAIR_DEFAULT_RISER = 0.175;
export const RAMP_DEFAULT_SLOPE = 12.5;
export const PILE_DEFAULT_DIAMETER = 0.4;
export const PILE_DEFAULT_LENGTH = 12;
export const JOIST_DEFAULT_SPACING = 0.45;
export const GRADE_BEAM_DEFAULT_ELEVATION = 0;
export const BRACE_DEFAULT_WIDTH = 0.2;
export const HATCH_DEFAULT_SPACING_CM = 35;
export const HATCH_DEFAULT_ANGLE = 45;

export const DRAW_MODE: Record<ElementType, DrawMode> = {
  wall: 'line',
  door: 'line',
  window: 'line',
  beam: 'line',
  joist: 'line',
  grade_beam: 'line',
  brace: 'line',
  column: 'point',
  pile: 'point',
  slab: 'rect',
  footing: 'rect',
  stair: 'rect',
  ramp: 'rect',
  opening: 'rect',
  line: 'line',
  polyline: 'poly',
  arc: 'arc',
  circle: 'center',
  ellipse: 'rect',
  rectangle: 'rect',
  hatch: 'rect',
};

/** CAD drawing/annotation primitives (week 8): they carry no structural role,
 *  so the 3D view and the structural selection summary skip them. */
export const ANNOTATION_TYPES: ReadonlySet<ElementType> = new Set([
  'line',
  'polyline',
  'arc',
  'circle',
  'ellipse',
  'rectangle',
  'hatch',
]);

export const LINE_TYPES: ReadonlySet<ElementType> = new Set(
  (Object.keys(DRAW_MODE) as ElementType[]).filter((t) => DRAW_MODE[t] === 'line'),
);
export const POINT_TYPES: ReadonlySet<ElementType> = new Set(
  (Object.keys(DRAW_MODE) as ElementType[]).filter((t) => DRAW_MODE[t] === 'point'),
);
export const RECT_TYPES: ReadonlySet<ElementType> = new Set(
  (Object.keys(DRAW_MODE) as ElementType[]).filter((t) => DRAW_MODE[t] === 'rect'),
);

export function drawModeOf(type: ElementType): DrawMode {
  return DRAW_MODE[type];
}

export function wallLengthInMeters(element: WallElement): number {
  return cmToMeters(element.length);
}

export function wallDefaultProperties() {
  return {
    height: WALL_DEFAULT_HEIGHT,
    thickness: WALL_DEFAULT_THICKNESS,
    join_angle: WALL_DEFAULT_JOIN_ANGLE,
    join_mode: 'perpendicular' as const,
    join_target: null as 'start' | 'end' | null,
    join_host_id: null as string | null,
  };
}

/** Default ``properties`` per element type, merged when creating or
 *  normalizing elements coming from older documents. */
export function defaultPropertiesFor(type: ElementType): Record<string, unknown> {
  switch (type) {
    case 'wall':
      return wallDefaultProperties();
    case 'door':
      return { width: 0.9, height: 2.1, swing: 'left' };
    case 'window':
      return { width: 1.0, height: 1.2, sill_height: 0.9 };
    case 'column':
      return { shape: 'rectangular', width: COLUMN_DEFAULT_WIDTH, depth: COLUMN_DEFAULT_DEPTH, height: COLUMN_DEFAULT_HEIGHT, base_elevation: 0, material: 'concrete' };
    case 'beam':
      return { width: BEAM_DEFAULT_WIDTH, height: BEAM_DEFAULT_HEIGHT, top_elevation: BEAM_DEFAULT_ELEVATION, material: 'concrete' };
    case 'joist':
      return { width: 0.15, height: 0.3, spacing: JOIST_DEFAULT_SPACING, top_elevation: BEAM_DEFAULT_ELEVATION };
    case 'grade_beam':
      return { width: 0.3, height: 0.4, top_elevation: GRADE_BEAM_DEFAULT_ELEVATION };
    case 'brace':
      return { width: BRACE_DEFAULT_WIDTH, depth: BRACE_DEFAULT_WIDTH, bottom_z: 0, top_z: COLUMN_DEFAULT_HEIGHT };
    case 'pile':
      return { diameter: PILE_DEFAULT_DIAMETER, pile_length: PILE_DEFAULT_LENGTH, top_elevation: 0 };
    case 'slab':
      return { thickness: SLAB_DEFAULT_THICKNESS, slab_type: 'solid', top_elevation: BEAM_DEFAULT_ELEVATION, diaphragm: 'none' };
    case 'footing':
      return { depth: FOOTING_DEFAULT_DEPTH, top_elevation: 0 };
    case 'stair':
      return { step_count: 14, tread: STAIR_DEFAULT_TREAD, riser: STAIR_DEFAULT_RISER, base_elevation: 0, run_axis: 'x' };
    case 'ramp':
      return { slope_percent: RAMP_DEFAULT_SLOPE, thickness: 0.15, base_elevation: 0 };
    case 'opening':
      return {};
    case 'polyline':
      return { points: [], closed: false };
    case 'circle':
      return { radius: 50 };
    case 'arc':
      return { cx: 0, cy: 0, radius: 50, start_angle: 0, end_angle: Math.PI / 2, clockwise: false, mid: { x: 0, y: 0 } };
    case 'hatch':
      return { pattern: 'ansi31', spacing: HATCH_DEFAULT_SPACING_CM, angle: HATCH_DEFAULT_ANGLE };
    default:
      return {};
  }
}

export function normalizeElement(element: ProjectElement): ProjectElement {
  const withRefs = {
    ...element,
    material_id: element.material_id ?? null,
    section_id: element.section_id ?? null,
  };
  if (withRefs.element_type === 'beam' && withRefs.properties.length === undefined) {
    withRefs.properties = { ...withRefs.properties, length: cmToMeters(withRefs.length) } as typeof withRefs.properties;
  }
  return { ...withRefs, properties: { ...defaultPropertiesFor(withRefs.element_type), ...withRefs.properties } } as ProjectElement;
}

/** Footprint size of a rect element in centimeters. */
export function rectSize(element: ProjectElement): { width: number; depth: number } {
  return { width: Math.abs(element.x2 - element.x1), depth: Math.abs(element.y2 - element.y1) };
}

/** Returns a copy of ``element`` with the rect footprint resized around its
 *  minimum corner (x1,y1 stays put). */
export function updateRectSize(element: ProjectElement, widthCm: number, depthCm: number): ProjectElement {
  const minX = Math.min(element.x1, element.x2);
  const minY = Math.min(element.y1, element.y2);
  return {
    ...element,
    x1: minX,
    y1: minY,
    x2: minX + Math.max(1, widthCm),
    y2: minY + Math.max(1, depthCm),
    length: Math.max(1, widthCm),
  };
}

function baseFields(id: string, projectId: string) {
  const now = new Date().toISOString();
  return { id, project_id: projectId, material_id: null, section_id: null, created_at: now, updated_at: now };
}

function lineGeometry(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length: distance(start, end),
    rotation: Math.atan2(end.y - start.y, end.x - start.x),
  };
}

function rectGeometry(start: { x: number; y: number }, end: { x: number; y: number }) {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);
  return { x1: minX, y1: minY, x2: maxX, y2: maxY, length: Math.max(1, maxX - minX), rotation: 0 };
}

function pointGeometry(center: { x: number; y: number }) {
  return { x1: center.x, y1: center.y, x2: center.x + 1, y2: center.y, length: 1, rotation: 0 };
}

export function createWall(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  overrides: Partial<WallElement['properties']> = {},
): WallElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'wall',
    ...lineGeometry(start, end),
    properties: { ...wallDefaultProperties(), ...overrides },
  };
}

export function updateWallLength(element: WallElement, newLengthMeters: number): WallElement {
  const length = metersToCm(newLengthMeters);
  const dir = { x: Math.cos(element.rotation), y: Math.sin(element.rotation) };
  let x1 = element.x1;
  let y1 = element.y1;
  let x2 = element.x2;
  let y2 = element.y2;
  if (element.properties.join_target === 'end' && element.properties.join_host_id) {
    x1 = x2 - dir.x * length;
    y1 = y2 - dir.y * length;
  } else {
    x2 = x1 + dir.x * length;
    y2 = y1 + dir.y * length;
  }
  return { ...element, x1, y1, x2, y2, length };
}

function joinAngleFor(wall: WallElement): number {
  if (wall.properties.join_mode === 'perpendicular') return 90;
  if (wall.properties.join_mode === '45') return 45;
  return wall.properties.join_angle ?? 90;
}

export function recomputeWallJoin(
  wall: WallElement,
  elements: ProjectElement[],
): WallElement {
  const hostId = wall.properties.join_host_id;
  if (!hostId) return wall;
  const host = elements.find((el) => el.id === hostId);
  if (!host) return wall;
  const hostStart = { x: host.x1, y: host.y1 };
  const hostEnd = { x: host.x2, y: host.y2 };
  const angle = joinAngleFor(wall);
  let start = { x: wall.x1, y: wall.y1 };
  let end = { x: wall.x2, y: wall.y2 };
  if (wall.properties.join_target === 'start') {
    end = resolveTJoin(start, hostStart, hostEnd, end, angle);
  } else if (wall.properties.join_target === 'end') {
    start = resolveTJoin(end, hostStart, hostEnd, start, angle);
  }
  const length = distance(start, end);
  const rotation = Math.atan2(end.y - start.y, end.x - start.x);
  return { ...wall, x1: start.x, y1: start.y, x2: end.x, y2: end.y, length, rotation };
}

export function updateBeamLength(element: BeamElement, newLengthMeters: number): BeamElement {
  const length = metersToCm(newLengthMeters);
  const start = { x: element.x1, y: element.y1 };
  const dir = { x: Math.cos(element.rotation), y: Math.sin(element.rotation) };
  const end = { x: start.x + dir.x * length, y: start.y + dir.y * length };
  return {
    ...element,
    x2: end.x,
    y2: end.y,
    length,
    properties: { ...element.properties, length: newLengthMeters },
  };
}

export function createColumn(
  id: string,
  projectId: string,
  center: { x: number; y: number },
  overrides: Partial<ColumnElement['properties']> = {},
): ColumnElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'column',
    ...pointGeometry(center),
    properties: { ...defaultPropertiesFor('column'), ...overrides } as ColumnElement['properties'],
  };
}

export function createBeam(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  overrides: Partial<BeamElement['properties']> = {},
): BeamElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'beam',
    ...lineGeometry(start, end),
    properties: {
      ...defaultPropertiesFor('beam'),
      length: cmToMeters(distance(start, end)),
      ...overrides,
    } as BeamElement['properties'],
  };
}

export function createDoor(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): DoorElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'door',
    ...lineGeometry(start, end),
    properties: { ...defaultPropertiesFor('door'), width: cmToMeters(distance(start, end)) } as DoorElement['properties'],
  };
}

export function createWindow(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): WindowElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'window',
    ...lineGeometry(start, end),
    properties: { ...defaultPropertiesFor('window'), width: cmToMeters(distance(start, end)) } as WindowElement['properties'],
  };
}

export function createJoist(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): JoistElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'joist',
    ...lineGeometry(start, end),
    properties: defaultPropertiesFor('joist') as JoistElement['properties'],
  };
}

export function createGradeBeam(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): GradeBeamElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'grade_beam',
    ...lineGeometry(start, end),
    properties: defaultPropertiesFor('grade_beam') as GradeBeamElement['properties'],
  };
}

export function createBrace(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): BraceElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'brace',
    ...lineGeometry(start, end),
    properties: defaultPropertiesFor('brace') as BraceElement['properties'],
  };
}

export function createPile(
  id: string,
  projectId: string,
  center: { x: number; y: number },
): PileElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'pile',
    ...pointGeometry(center),
    properties: defaultPropertiesFor('pile') as PileElement['properties'],
  };
}

function createRect<T extends SlabElement | FootingElement | StairElement | RampElement | OpeningElement>(
  type: T['element_type'],
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): T {
  return {
    ...baseFields(id, projectId),
    element_type: type,
    ...rectGeometry(start, end),
    properties: defaultPropertiesFor(type),
  } as T;
}

export const createSlab = (id: string, projectId: string, start: { x: number; y: number }, end: { x: number; y: number }): SlabElement => createRect<SlabElement>('slab', id, projectId, start, end);
export const createFooting = (id: string, projectId: string, start: { x: number; y: number }, end: { x: number; y: number }): FootingElement => createRect<FootingElement>('footing', id, projectId, start, end);
export const createStair = (id: string, projectId: string, start: { x: number; y: number }, end: { x: number; y: number }): StairElement => createRect<StairElement>('stair', id, projectId, start, end);
export const createRamp = (id: string, projectId: string, start: { x: number; y: number }, end: { x: number; y: number }): RampElement => createRect<RampElement>('ramp', id, projectId, start, end);
export const createOpening = (id: string, projectId: string, start: { x: number; y: number }, end: { x: number; y: number }): OpeningElement => createRect<OpeningElement>('opening', id, projectId, start, end);

/* ------------------------------------------------------------------ */
/* CAD annotation primitives                                            */
/* ------------------------------------------------------------------ */

export function createLine(id: string, projectId: string, start: PlanPoint, end: PlanPoint): LineElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'line',
    ...lineGeometry(start, end),
    properties: defaultPropertiesFor('line') as LineElement['properties'],
  };
}

export function createPolyline(
  id: string,
  projectId: string,
  points: PlanPoint[],
  closed = false,
): PolylineElement {
  const repeatsFirst = points.length > 1 && pointsEqual(points[0], points[points.length - 1]);
  const isClosed = closed || repeatsFirst;
  const vertices = isClosed && !repeatsFirst ? [...points, points[0]] : points;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const length = vertices.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(vertices[i - 1], p)), 0);
  return {
    ...baseFields(id, projectId),
    element_type: 'polyline',
    x1: first.x,
    y1: first.y,
    x2: last.x,
    y2: last.y,
    length: Math.max(1, length),
    rotation: 0,
    properties: { points: vertices, closed: isClosed } as PolylineElement['properties'],
  };
}

/** Arc parameters derived from three points on the curve (start, a point on
 *  the arc, end). Returns null when the points are collinear. */
export function arcSpecFromPoints(
  p1: PlanPoint,
  mid: PlanPoint,
  p3: PlanPoint,
): { cx: number; cy: number; radius: number; start_angle: number; end_angle: number; clockwise: boolean } | null {
  const circle = circleThroughPoints(p1, mid, p3);
  if (!circle || circle.radius < 1e-6) return null;
  const { center, radius } = circle;
  const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  const midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);
  const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);
  // The mid point sits on the travelled path: if it is reached while sweeping
  // counterclockwise (increasing angle) from start to end, the arc goes ccw.
  const onCcwPath = ccwSweep(startAngle, midAngle) <= ccwSweep(startAngle, endAngle);
  return {
    cx: center.x,
    cy: center.y,
    radius,
    start_angle: normalizeAngle(startAngle),
    end_angle: normalizeAngle(endAngle),
    clockwise: !onCcwPath,
  };
}

export function createArc(
  id: string,
  projectId: string,
  start: PlanPoint,
  mid: PlanPoint,
  end: PlanPoint,
): ArcElement | null {
  const spec = arcSpecFromPoints(start, mid, end);
  if (!spec) return null;
  const sweep = spec.clockwise
    ? ccwSweep(spec.end_angle, spec.start_angle)
    : ccwSweep(spec.start_angle, spec.end_angle);
  return {
    ...baseFields(id, projectId),
    element_type: 'arc',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length: Math.max(1, spec.radius * sweep),
    rotation: 0,
    properties: { ...spec, mid } as ArcElement['properties'],
  };
}

/** Recompute an arc after one of its chord endpoints moved, keeping the
 *  stored through-point. Returns null when the geometry degenerates. */
export function recomputeArc(element: ArcElement, start: PlanPoint, end: PlanPoint): ArcElement | null {
  return createArc(element.id, element.project_id, start, element.properties.mid, end);
}

export function createCircle(id: string, projectId: string, center: PlanPoint, radiusCm: number): CircleElement {
  const radius = Math.max(1, radiusCm);
  return {
    ...baseFields(id, projectId),
    element_type: 'circle',
    x1: center.x,
    y1: center.y,
    x2: center.x + radius,
    y2: center.y,
    length: 2 * Math.PI * radius,
    rotation: 0,
    properties: { radius } as CircleElement['properties'],
  };
}

export function createEllipse(id: string, projectId: string, start: PlanPoint, end: PlanPoint): EllipseElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'ellipse',
    ...rectGeometry(start, end),
    properties: defaultPropertiesFor('ellipse') as EllipseElement['properties'],
  };
}

export function createRectangle(id: string, projectId: string, start: PlanPoint, end: PlanPoint): RectangleElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'rectangle',
    ...rectGeometry(start, end),
    properties: defaultPropertiesFor('rectangle') as RectangleElement['properties'],
  };
}

export function createHatch(id: string, projectId: string, start: PlanPoint, end: PlanPoint): HatchElement {
  return {
    ...baseFields(id, projectId),
    element_type: 'hatch',
    ...rectGeometry(start, end),
    properties: defaultPropertiesFor('hatch') as HatchElement['properties'],
  };
}

export function defaultDesignSettings(): Project['design_settings'] {
  return {
    unit: 'm',
    seismic_zone: '',
    hail_zone: '',
    wind_zone: '',
    building_code: '',
    material: {
      compressive_strength: undefined,
      density: undefined,
      elastic_modulus: undefined,
    },
  };
}
