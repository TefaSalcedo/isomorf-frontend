export type ElementType = 'wall' | 'door' | 'window' | 'column' | 'beam';

export type MaterialConstants = {
  compressive_strength?: number;
  density?: number;
  elastic_modulus?: number;
};

export type DesignSettings = {
  seismic_zone?: string;
  hail_zone?: string;
  wind_zone?: string;
  building_code?: string;
  material?: MaterialConstants;
};

export type BaseElement = {
  id: string;
  project_id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  rotation: number;
  created_at: string;
  updated_at: string;
};

export type WallProperties = {
  height: number;
  thickness: number;
  join_mode: 'perpendicular' | '45' | 'free';
  join_angle: number;
  join_target: 'start' | 'end' | null;
  join_host_id: string | null;
};

export type WallElement = BaseElement & {
  element_type: 'wall';
  properties: WallProperties;
};

export type DoorProperties = {
  width?: number;
  swing?: 'left' | 'right';
};

export type DoorElement = BaseElement & {
  element_type: 'door';
  properties: DoorProperties;
};

export type WindowProperties = {
  width?: number;
  sill_height?: number;
};

export type WindowElement = BaseElement & {
  element_type: 'window';
  properties: WindowProperties;
};

export type ColumnProperties = {
  width: number;
  depth: number;
  height: number;
  material: string;
};

export type ColumnElement = BaseElement & {
  element_type: 'column';
  properties: ColumnProperties;
};

export type BeamProperties = {
  width: number;
  height: number;
  length: number;
  material: string;
};

export type BeamElement = BaseElement & {
  element_type: 'beam';
  properties: BeamProperties;
};

export type ProjectElement =
  | WallElement
  | DoorElement
  | WindowElement
  | ColumnElement
  | BeamElement;

export type Project = {
  id: string;
  name: string;
  description: string;
  design_settings: DesignSettings;
  created_at: string;
  updated_at: string;
  elements?: ProjectElement[];
};
