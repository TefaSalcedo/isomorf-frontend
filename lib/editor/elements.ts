import type {
  Project,
  ProjectElement,
  WallElement,
  ColumnElement,
  BeamElement,
  DoorElement,
  WindowElement,
} from '@/types/project';
import { cmToMeters, distance, metersToCm, resolveTJoin } from '@/lib/editor/geometry';

export const WALL_DEFAULT_HEIGHT = 2.5;
export const WALL_DEFAULT_THICKNESS = 0.15;
export const WALL_DEFAULT_JOIN_ANGLE = 90;

export const COLUMN_DEFAULT_WIDTH = 0.3;
export const COLUMN_DEFAULT_DEPTH = 0.3;
export const COLUMN_DEFAULT_HEIGHT = 2.5;

export const BEAM_DEFAULT_WIDTH = 0.2;
export const BEAM_DEFAULT_HEIGHT = 0.3;

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

export function normalizeElement(element: ProjectElement): ProjectElement {
  switch (element.element_type) {
    case 'wall': {
      const props = {
        ...wallDefaultProperties(),
        ...element.properties,
      };
      return { ...element, properties: props };
    }
    case 'door': {
      const doorDefaults = { width: 0.9, swing: 'left' as const };
      return { ...element, properties: { ...doorDefaults, ...element.properties } };
    }
    case 'window': {
      const windowDefaults = { width: 1.0, sill_height: 0.9 };
      return { ...element, properties: { ...windowDefaults, ...element.properties } };
    }
    case 'column': {
      const columnDefaults = {
        width: COLUMN_DEFAULT_WIDTH,
        depth: COLUMN_DEFAULT_DEPTH,
        height: COLUMN_DEFAULT_HEIGHT,
        material: 'concrete',
      };
      const props = { ...columnDefaults, ...element.properties };
      return { ...element, properties: props } as ColumnElement;
    }
    case 'beam': {
      const beamDefaults = {
        width: BEAM_DEFAULT_WIDTH,
        height: BEAM_DEFAULT_HEIGHT,
        length: cmToMeters(element.length),
        material: 'concrete',
      };
      const props = { ...beamDefaults, ...element.properties };
      return { ...element, properties: props } as BeamElement;
    }
    default:
      return element;
  }
}

export function createWall(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  overrides: Partial<WallElement['properties']> = {},
): WallElement {
  const now = new Date().toISOString();
  const length = distance(start, end);
  return {
    id,
    project_id: projectId,
    element_type: 'wall',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length,
    rotation: Math.atan2(end.y - start.y, end.x - start.x),
    properties: { ...wallDefaultProperties(), ...overrides },
    created_at: now,
    updated_at: now,
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
  const now = new Date().toISOString();
  return {
    id,
    project_id: projectId,
    element_type: 'column',
    x1: center.x,
    y1: center.y,
    x2: center.x + 1,
    y2: center.y,
    length: 1,
    rotation: 0,
    properties: {
      width: COLUMN_DEFAULT_WIDTH,
      depth: COLUMN_DEFAULT_DEPTH,
      height: COLUMN_DEFAULT_HEIGHT,
      material: 'concrete',
      ...overrides,
    },
    created_at: now,
    updated_at: now,
  };
}

export function createBeam(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  overrides: Partial<BeamElement['properties']> = {},
): BeamElement {
  const now = new Date().toISOString();
  const length = distance(start, end);
  return {
    id,
    project_id: projectId,
    element_type: 'beam',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length,
    rotation: Math.atan2(end.y - start.y, end.x - start.x),
    properties: {
      width: BEAM_DEFAULT_WIDTH,
      height: BEAM_DEFAULT_HEIGHT,
      length: cmToMeters(length),
      material: 'concrete',
      ...overrides,
    },
    created_at: now,
    updated_at: now,
  };
}

export function createDoor(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): DoorElement {
  const now = new Date().toISOString();
  const length = distance(start, end);
  return {
    id,
    project_id: projectId,
    element_type: 'door',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length,
    rotation: Math.atan2(end.y - start.y, end.x - start.x),
    properties: { width: cmToMeters(length), swing: 'left' },
    created_at: now,
    updated_at: now,
  };
}

export function createWindow(
  id: string,
  projectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): WindowElement {
  const now = new Date().toISOString();
  const length = distance(start, end);
  return {
    id,
    project_id: projectId,
    element_type: 'window',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    length,
    rotation: Math.atan2(end.y - start.y, end.x - start.x),
    properties: { width: cmToMeters(length), sill_height: 0.9 },
    created_at: now,
    updated_at: now,
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
