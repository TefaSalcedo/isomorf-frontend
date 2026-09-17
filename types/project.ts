export type ElementType = 'wall' | 'door' | 'window' | 'column' | 'beam';

export type MaterialConstants = {
  compressive_strength?: number;
  density?: number;
  elastic_modulus?: number;
};

export type PlanLayer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
};

export type DesignSettings = {
  unit?: 'm' | 'ft';
  seismic_zone?: string;
  hail_zone?: string;
  wind_zone?: string;
  building_code?: string;
  material?: MaterialConstants;
  layers?: PlanLayer[];
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

export type LayeredProperties = {
  layer_id?: string | null;
};

export type WallProperties = LayeredProperties & {
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

export type DoorProperties = LayeredProperties & {
  width?: number;
  swing?: 'left' | 'right';
};

export type DoorElement = BaseElement & {
  element_type: 'door';
  properties: DoorProperties;
};

export type WindowProperties = LayeredProperties & {
  width?: number;
  sill_height?: number;
};

export type WindowElement = BaseElement & {
  element_type: 'window';
  properties: WindowProperties;
};

export type ConcreteSpec = {
  fc: number;
  fy: number;
  cover: number;
};

export type ReinforcementSpec = {
  bar_count: number;
  bar_diameter: number;
  stirrup_diameter: number;
  stirrup_spacing: number;
};

export type DesignLoads = {
  axial: number;
  distributed: number;
};

export type DesignStep = {
  title: string;
  formula: string;
  substitution: string;
  result: string;
};

export type DesignInputs = {
  geometry: Record<string, number>;
  concrete: ConcreteSpec;
  reinforcement: ReinforcementSpec;
  loads: DesignLoads;
};

export type DesignMemory = {
  calculated_at: string;
  code: string;
  inputs: DesignInputs;
  status: 'ok' | 'review';
  ratio: number;
  summary: { label: string; value: string }[];
  steps: DesignStep[];
  warnings: string[];
};

export type DesignableProperties = {
  concrete?: ConcreteSpec;
  reinforcement?: ReinforcementSpec;
  design_loads?: DesignLoads;
  design_memory?: DesignMemory;
};

export type ColumnProperties = LayeredProperties & DesignableProperties & {
  width: number;
  depth: number;
  height: number;
  material: string;
};

export type ColumnElement = BaseElement & {
  element_type: 'column';
  properties: ColumnProperties;
};

export type BeamProperties = LayeredProperties & DesignableProperties & {
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
  public_id: string;
  folder_id?: string | null;
  name: string;
  description: string;
  design_settings: DesignSettings;
  created_at: string;
  updated_at: string;
  elements?: ProjectElement[];
};
