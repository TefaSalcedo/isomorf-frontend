export type LoadType = 'dead' | 'live' | 'point' | 'distributed' | 'surface' | 'wind' | 'snow' | 'seismic' | 'self_weight';

export type LoadCase = {
  id: string;
  project_id: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
};

export type ElementLoad = {
  id: string;
  load_case_id: string;
  element_id: string | null;
  load_type: LoadType;
  magnitude: number;
  unit: string;
  direction: string;
  position: Record<string, unknown>;
  created_at: string;
};
