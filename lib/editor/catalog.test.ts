import { describe, expect, it } from 'vitest';
import type { CatalogPresets, Material, ProjectElement, Section } from '@/types/project';
import { createBeam } from './elements';
import {
  currentMaterialRef,
  currentSectionRef,
  emptyCatalog,
  materialLabelOf,
  materialRefChanges,
  presetFor,
  sectionLabelOf,
  sectionRefChanges,
  type CatalogData,
} from './catalog';

const presets: CatalogPresets = {
  materials: [
    { key: 'c-21', name: "Concrete f'c=21 MPa", category: 'concrete', properties: { fck: 21 } },
    { key: 'a36', name: 'Steel A36', category: 'steel', properties: { fy: 253 } },
  ],
  sections: [
    { key: 'w14x22', name: 'W14x22', shape: 'i_shape', category: 'steel', dimensions: { d: 0.349 } },
  ],
};

const projectMaterial: Material = {
  id: 'mat-uuid-1',
  project_id: 'p1',
  name: 'C28 site mix',
  category: 'concrete',
  properties: { fck: 28 },
  created_at: '',
  updated_at: '',
};

const projectSection: Section = {
  id: 'sec-uuid-1',
  project_id: 'p1',
  name: '30x50',
  shape: 'rectangular',
  material_id: 'mat-uuid-1',
  dimensions: { b: 0.3, h: 0.5 },
  properties: {},
  created_at: '',
  updated_at: '',
};

const catalog: CatalogData = { materials: [projectMaterial], sections: [projectSection], presets };

function beamWith(overrides: { material_id?: string | null; section_id?: string | null; props?: Record<string, unknown> }): ProjectElement {
  const beam = createBeam('b1', 'p1', { x: 0, y: 0 }, { x: 100, y: 0 });
  return {
    ...beam,
    material_id: overrides.material_id ?? beam.material_id,
    section_id: overrides.section_id ?? beam.section_id,
    properties: { ...beam.properties, ...overrides.props } as typeof beam.properties,
  } as ProjectElement;
}

describe('catalog ref changes', () => {
  it('routes presets to properties and UUIDs to FK columns', () => {
    expect(materialRefChanges('preset:c-21')).toEqual({ material_id: null, material_preset: 'preset:c-21' });
    expect(materialRefChanges('mat-uuid-1')).toEqual({ material_id: 'mat-uuid-1', material_preset: null });
    expect(materialRefChanges('')).toEqual({ material_id: null, material_preset: null });
    expect(sectionRefChanges('preset:w14x22')).toEqual({ section_id: null, section_preset: 'preset:w14x22' });
    expect(sectionRefChanges('sec-uuid-1')).toEqual({ section_id: 'sec-uuid-1', section_preset: null });
  });

  it('reads the active ref preferring the preset stored in properties', () => {
    const el = beamWith({ material_id: 'mat-uuid-1', props: { material_preset: 'preset:c-21' } });
    expect(currentMaterialRef(el)).toBe('preset:c-21');
    expect(currentMaterialRef(beamWith({ material_id: 'mat-uuid-1' }))).toBe('mat-uuid-1');
    expect(currentMaterialRef(beamWith({}))).toBe('');
    expect(currentSectionRef(beamWith({ section_id: 'sec-uuid-1' }))).toBe('sec-uuid-1');
  });
});

describe('catalog labels', () => {
  it('resolves preset refs to preset names', () => {
    const el = beamWith({ props: { material_preset: 'preset:c-21' } });
    expect(materialLabelOf(el, catalog)).toBe("Concrete f'c=21 MPa");
  });

  it('resolves UUID refs to project rows', () => {
    const el = beamWith({ material_id: 'mat-uuid-1', section_id: 'sec-uuid-1' });
    expect(materialLabelOf(el, catalog)).toBe('C28 site mix');
    expect(sectionLabelOf(el, catalog)).toBe('30x50');
  });

  it('falls back to the legacy free-text material and empty strings', () => {
    const legacy = beamWith({ props: { material: 'concrete' } });
    expect(materialLabelOf(legacy, catalog)).toBe('concrete');
    expect(sectionLabelOf(beamWith({}), catalog)).toBe('');
  });

  it('returns the raw ref when the catalog does not contain it', () => {
    const el = beamWith({ material_id: 'missing-uuid' });
    expect(materialLabelOf(el, catalog)).toBe('missing-uuid');
  });
});

describe('preset helpers', () => {
  it('finds presets by key and ships an empty catalog', () => {
    expect(presetFor('a36', presets.materials)?.name).toBe('Steel A36');
    expect(presetFor('missing', presets.materials)).toBeUndefined();
    const empty = emptyCatalog();
    expect(empty.materials).toHaveLength(0);
    expect(empty.presets.sections).toHaveLength(0);
  });
});
