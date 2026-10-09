export type ElementType =
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'beam'
  | 'slab'
  | 'footing'
  | 'stair'
  | 'ramp'
  | 'opening'
  | 'joist'
  | 'grade_beam'
  | 'brace'
  | 'pile'
  | 'line'
  | 'polyline'
  | 'arc'
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'hatch';

/** How an element is drawn on the plan: two-point line, single click point,
 *  corner-to-corner rectangle (x1,y1 = min corner, x2,y2 = max corner),
 *  multi-click vertex chain (polyline), three-point arc, or center+radius
 *  (circle). */
export type DrawMode = 'line' | 'point' | 'rect' | 'poly' | 'arc' | 'center';

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
  material_id: string | null;
  section_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LayeredProperties = {
  layer_id?: string | null;
};

/** Identity fields common to every element. */
export type TaggedProperties = {
  tag?: string;
};

export type WallProperties = LayeredProperties & TaggedProperties & {
  height: number;
  thickness: number;
  wall_type?: 'bearing' | 'shear' | 'partition' | 'masonry';
  base_elevation?: number;
  join_mode: 'perpendicular' | '45' | 'free';
  join_angle: number;
  join_target: 'start' | 'end' | null;
  join_host_id: string | null;
};

export type WallElement = BaseElement & {
  element_type: 'wall';
  properties: WallProperties;
};

export type DoorProperties = LayeredProperties & TaggedProperties & {
  width?: number;
  height?: number;
  swing?: 'left' | 'right';
};

export type DoorElement = BaseElement & {
  element_type: 'door';
  properties: DoorProperties;
};

export type WindowProperties = LayeredProperties & TaggedProperties & {
  width?: number;
  height?: number;
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

export type ColumnProperties = LayeredProperties & TaggedProperties & DesignableProperties & {
  shape?: 'rectangular' | 'circular';
  width: number;
  depth: number;
  /** Circular columns use diameter instead of width/depth. */
  diameter?: number;
  height: number;
  base_elevation?: number;
  /** Legacy free-text material; superseded by element.material_id / material_preset. */
  material?: string;
};

export type ColumnElement = BaseElement & {
  element_type: 'column';
  properties: ColumnProperties;
};

export type BeamProperties = LayeredProperties & TaggedProperties & DesignableProperties & {
  width: number;
  height: number;
  length: number;
  /** Elevation of the beam top, in meters. */
  top_elevation?: number;
  material?: string;
};

export type BeamElement = BaseElement & {
  element_type: 'beam';
  properties: BeamProperties;
};

export type JoistProperties = LayeredProperties & TaggedProperties & {
  width: number;
  height: number;
  spacing: number;
  top_elevation?: number;
};

export type JoistElement = BaseElement & {
  element_type: 'joist';
  properties: JoistProperties;
};

export type GradeBeamProperties = LayeredProperties & TaggedProperties & DesignableProperties & {
  width: number;
  height: number;
  top_elevation?: number;
};

export type GradeBeamElement = BaseElement & {
  element_type: 'grade_beam';
  properties: GradeBeamProperties;
};

export type BraceProperties = LayeredProperties & TaggedProperties & {
  width: number;
  depth: number;
  bottom_z: number;
  top_z: number;
};

export type BraceElement = BaseElement & {
  element_type: 'brace';
  properties: BraceProperties;
};

export type SlabProperties = LayeredProperties & TaggedProperties & {
  thickness: number;
  slab_type: 'solid' | 'waffle' | 'ribbed' | 'mat';
  /** Elevation of the slab top surface, in meters. */
  top_elevation: number;
  diaphragm?: 'none' | 'rigid' | 'semirigid';
};

export type SlabElement = BaseElement & {
  element_type: 'slab';
  properties: SlabProperties;
};

export type FootingProperties = LayeredProperties & TaggedProperties & {
  /** Footing thickness (vertical dimension), in meters. */
  depth: number;
  /** Elevation of the footing top, in meters. */
  top_elevation: number;
  soil_capacity_kpa?: number;
};

export type FootingElement = BaseElement & {
  element_type: 'footing';
  properties: FootingProperties;
};

export type StairProperties = LayeredProperties & TaggedProperties & {
  step_count: number;
  tread: number;
  riser: number;
  base_elevation: number;
  /** Plan axis along which the stair ascends. */
  run_axis: 'x' | 'y';
};

export type StairElement = BaseElement & {
  element_type: 'stair';
  properties: StairProperties;
};

export type RampProperties = LayeredProperties & TaggedProperties & {
  slope_percent: number;
  thickness: number;
  base_elevation: number;
};

export type RampElement = BaseElement & {
  element_type: 'ramp';
  properties: RampProperties;
};

export type OpeningProperties = LayeredProperties & TaggedProperties & {
  notes?: string;
};

export type OpeningElement = BaseElement & {
  element_type: 'opening';
  properties: OpeningProperties;
};

export type PileProperties = LayeredProperties & TaggedProperties & {
  diameter: number;
  /** Pile length below its top elevation, in meters. */
  pile_length: number;
  top_elevation: number;
  capacity_kn?: number;
};

export type PileElement = BaseElement & {
  element_type: 'pile';
  properties: PileProperties;
};

/* ------------------------------------------------------------------ */
/* CAD annotation primitives (roadmap week 8). They carry no structural  */
/* role: skipped by the 3D view and the structural selection summary.    */
/* ------------------------------------------------------------------ */

export type LineProperties = LayeredProperties & TaggedProperties;

export type LineElement = BaseElement & {
  element_type: 'line';
  properties: LineProperties;
};

export type PlanPoint = { x: number; y: number };

export type PolylineProperties = LayeredProperties & TaggedProperties & {
  /** Ordered vertices in world units (cm). ``x1,y1`` mirrors the first
   *  vertex and ``x2,y2`` the last; a closed polyline repeats the first. */
  points: PlanPoint[];
  closed?: boolean;
};

export type PolylineElement = BaseElement & {
  element_type: 'polyline';
  properties: PolylineProperties;
};

export type ArcProperties = LayeredProperties & TaggedProperties & {
  /** Circle center in world units (cm). */
  cx: number;
  cy: number;
  /** Arc radius in centimeters. */
  radius: number;
  /** Angles of the start/end chord points, radians, atan2 convention. */
  start_angle: number;
  end_angle: number;
  /** Whether the arc sweeps clockwise (canvas y-down coordinates). */
  clockwise: boolean;
  /** The through-point used to define the arc, kept so dragging a chord
   *  endpoint can recompute the circle. */
  mid: PlanPoint;
};

export type ArcElement = BaseElement & {
  element_type: 'arc';
  properties: ArcProperties;
};

export type CircleProperties = LayeredProperties & TaggedProperties & {
  /** Radius in centimeters; ``x1,y1`` is the center. */
  radius: number;
};

export type CircleElement = BaseElement & {
  element_type: 'circle';
  properties: CircleProperties;
};

export type EllipseProperties = LayeredProperties & TaggedProperties;

export type EllipseElement = BaseElement & {
  element_type: 'ellipse';
  properties: EllipseProperties;
};

export type RectangleProperties = LayeredProperties & TaggedProperties;

export type RectangleElement = BaseElement & {
  element_type: 'rectangle';
  properties: RectangleProperties;
};

export type HatchPattern = 'ansi31' | 'cross' | 'grid';

export type HatchProperties = LayeredProperties & TaggedProperties & {
  pattern: HatchPattern;
  /** Hatch line spacing in centimeters. */
  spacing: number;
  /** Pattern rotation in degrees. */
  angle: number;
};

export type HatchElement = BaseElement & {
  element_type: 'hatch';
  properties: HatchProperties;
};

export type ProjectElement =
  | WallElement
  | DoorElement
  | WindowElement
  | ColumnElement
  | BeamElement
  | JoistElement
  | GradeBeamElement
  | BraceElement
  | PileElement
  | SlabElement
  | FootingElement
  | StairElement
  | RampElement
  | OpeningElement
  | LineElement
  | PolylineElement
  | ArcElement
  | CircleElement
  | EllipseElement
  | RectangleElement
  | HatchElement;

export type MaterialCategory = 'concrete' | 'steel' | 'masonry' | 'timber' | 'aluminum' | 'generic';

export type Material = {
  id: string;
  project_id: string;
  name: string;
  category: MaterialCategory;
  properties: Record<string, number | string | undefined>;
  created_at: string;
  updated_at: string;
};

export type SectionShape = 'rectangular' | 'circular' | 'i_shape' | 't_shape' | 'l_shape' | 'box' | 'pipe' | 'custom';

export type Section = {
  id: string;
  project_id: string;
  name: string;
  shape: SectionShape;
  material_id: string | null;
  dimensions: Record<string, number | undefined>;
  properties: Record<string, number | string | undefined>;
  created_at: string;
  updated_at: string;
};

/** Read-only catalog entry referenced as ``preset:<key>``. */
export type CatalogPreset = {
  key: string;
  name: string;
  category?: string | null;
  shape?: string | null;
  properties?: Record<string, number>;
  dimensions?: Record<string, number>;
};

export type CatalogPresets = {
  materials: CatalogPreset[];
  sections: CatalogPreset[];
};

export type Project = {
  id: string;
  public_id: string;
  folder_id?: string | null;
  name: string;
  description: string;
  design_settings: DesignSettings;
  access_role?: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
  elements?: ProjectElement[];
  current_revision?: number;
  head_revision?: number;
};

export type DocumentState = {
  revision: number;
  head_revision: number;
  can_undo: boolean;
  can_redo: boolean;
  elements: ProjectElement[];
  design_settings: DesignSettings;
};

export type RevisionChange = {
  element_id: string;
  operation: 'baseline' | 'create' | 'update' | 'delete';
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export type RevisionEntry = {
  revision: number;
  created_at: string;
  changes: RevisionChange[];
};

export type HistoryResponse = {
  current_revision: number;
  head_revision: number;
  revisions: RevisionEntry[];
};
