import type { CatalogPreset, CatalogPresets, Material, ProjectElement, Section } from '@/types/project';

export const PRESET_PREFIX = 'preset:';

export type CatalogData = {
  materials: Material[];
  sections: Section[];
  presets: CatalogPresets;
};

export const EMPTY_PRESETS: CatalogPresets = { materials: [], sections: [] };

export function emptyCatalog(): CatalogData {
  return { materials: [], sections: [], presets: EMPTY_PRESETS };
}

/** The material a reference resolves to. ``preset:<key>`` values are
 *  matched against the read-only catalog; anything else is a project
 *  material id. Falls back to the legacy free-text ``properties.material``. */
export function materialLabelOf(element: ProjectElement, catalog: CatalogData): string {
  const ref = element.material_id ?? (element.properties as Record<string, unknown>).material_preset;
  if (typeof ref === 'string' && ref.startsWith(PRESET_PREFIX)) {
    return catalog.presets.materials.find((preset) => `${PRESET_PREFIX}${preset.key}` === ref)?.name ?? ref;
  }
  if (ref) {
    return catalog.materials.find((material) => material.id === ref)?.name ?? String(ref);
  }
  const legacy = (element.properties as Record<string, unknown>).material;
  return typeof legacy === 'string' ? legacy : '';
}

export function sectionLabelOf(element: ProjectElement, catalog: CatalogData): string {
  const ref = element.section_id ?? (element.properties as Record<string, unknown>).section_preset;
  if (typeof ref === 'string' && ref.startsWith(PRESET_PREFIX)) {
    return catalog.presets.sections.find((preset) => `${PRESET_PREFIX}${preset.key}` === ref)?.name ?? ref;
  }
  if (ref) {
    return catalog.sections.find((section) => section.id === ref)?.name ?? String(ref);
  }
  return '';
}

/** Raw reference value stored on the element for a given select option. */
export function currentMaterialRef(element: ProjectElement): string {
  const preset = (element.properties as Record<string, unknown>).material_preset;
  if (typeof preset === 'string') return preset;
  return element.material_id ?? '';
}

export function currentSectionRef(element: ProjectElement): string {
  const preset = (element.properties as Record<string, unknown>).section_preset;
  if (typeof preset === 'string') return preset;
  return element.section_id ?? '';
}

/** Builds the update payload for a material reference change: catalog UUIDs go
 *  to ``material_id`` (FK, SET NULL on delete), presets to
 *  ``properties.material_preset``. */
export function materialRefChanges(ref: string): { material_id: string | null; material_preset: string | null } {
  if (!ref) return { material_id: null, material_preset: null };
  if (ref.startsWith(PRESET_PREFIX)) return { material_id: null, material_preset: ref };
  return { material_id: ref, material_preset: null };
}

export function sectionRefChanges(ref: string): { section_id: string | null; section_preset: string | null } {
  if (!ref) return { section_id: null, section_preset: null };
  if (ref.startsWith(PRESET_PREFIX)) return { section_id: null, section_preset: ref };
  return { section_id: ref, section_preset: null };
}

export function presetFor(key: string, presets: CatalogPreset[]): CatalogPreset | undefined {
  return presets.find((preset) => preset.key === key);
}
