import { translate, type Locale } from '@/lib/i18n/messages';
import type { Linetype, PlanLayer, ProjectElement } from '@/types/project';

export const LAYER_PALETTE = [
  '#1f2937',
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#db2777',
];

export function defaultLayers(locale: Locale = 'en'): PlanLayer[] {
  return [
    { id: 'architecture', name: translate(locale, 'layers.architecture'), color: '#1f2937', visible: true, locked: false },
    { id: 'structure', name: translate(locale, 'layers.structure'), color: '#7c3aed', visible: true, locked: false },
    { id: 'openings', name: translate(locale, 'layers.openings'), color: '#0891b2', visible: true, locked: false },
  ];
}

export function ensureLayers(layers: PlanLayer[] | undefined, locale: Locale = 'en'): PlanLayer[] {
  if (!layers || layers.length === 0) return defaultLayers(locale);
  // Documents saved before week 10 have no style fields; normalize so
  // downstream code can read them without extra guards.
  return layers.map((layer) => ({ linetype: null, lineweight: null, ...layer }));
}

export function defaultLayerFor(elementType: ProjectElement['element_type']): string {
  if (elementType === 'door' || elementType === 'window' || elementType === 'opening') return 'openings';
  if (elementType === 'wall' || elementType === 'stair' || elementType === 'ramp') return 'architecture';
  return 'structure';
}

export function createLayer(index: number, locale: Locale = 'en'): PlanLayer {
  return {
    id: crypto.randomUUID(),
    name: translate(locale, 'layers.newName', { index: index + 1 }),
    color: LAYER_PALETTE[index % LAYER_PALETTE.length],
    visible: true,
    locked: false,
  };
}

export function layerOf(element: ProjectElement, layers: PlanLayer[]): PlanLayer | null {
  const id = element.properties.layer_id ?? defaultLayerFor(element.element_type);
  return layers.find((layer) => layer.id === id) ?? null;
}

export function isElementVisible(element: ProjectElement, layers: PlanLayer[]): boolean {
  return layerOf(element, layers)?.visible ?? true;
}

export function isElementLocked(element: ProjectElement, layers: PlanLayer[]): boolean {
  return layerOf(element, layers)?.locked ?? false;
}

export function countElementsByLayer(elements: ProjectElement[], layerId: string): number {
  return elements.filter((element) => (element.properties.layer_id ?? defaultLayerFor(element.element_type)) === layerId).length;
}

/* ------------------------------------------------------------------ */
/* Linetypes & lineweights (week 10)                                    */
/*                                                                     */
/* Dash patterns live in world units (cm) so they read consistently at  */
/* any zoom — like AutoCAD's global linetype scale. Lineweights are     */
/* authored in millimeters and mapped to canvas stroke width with a     */
/* fixed screen factor: 0.13 mm reads ~1.3, 0.5 mm reads ~5.            */
/* ------------------------------------------------------------------ */

export const LINETYPES: Linetype[] = ['solid', 'dashed', 'dotted', 'dashdot', 'center', 'hidden'];

export const LINETYPE_DASH: Record<Exclude<Linetype, 'solid'>, number[]> = {
  dashed: [12, 6],
  dotted: [2, 5],
  dashdot: [12, 5, 2, 5],
  center: [20, 5, 5, 5],
  hidden: [6, 3],
};

/** Common plot lineweights (mm) offered by the UI, thin → thick. */
export const LINEWEIGHT_OPTIONS = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0];

const LINEWEIGHT_TO_STROKE = 10;

export function lineweightToStroke(mm: number): number {
  return Math.max(0.5, mm * LINEWEIGHT_TO_STROKE);
}

export type ResolvedLineStyle = {
  /** Konva ``dash`` array, or ``undefined`` for a continuous stroke. */
  dash?: number[];
  /** Resolved stroke width, or ``undefined`` to keep the type default. */
  width?: number;
};

/** ByLayer resolution (AutoCAD): the element's own ``linetype``/
 *  ``lineweight`` wins; otherwise the owning layer's; otherwise nothing
 *  (the renderer keeps its per-type default). */
export function resolveLineStyle(element: ProjectElement, layers: PlanLayer[]): ResolvedLineStyle {
  const props = element.properties as { linetype?: Linetype | null; lineweight?: number | null };
  const layer = layerOf(element, layers);
  const linetype = props.linetype ?? layer?.linetype ?? null;
  const lineweight = props.lineweight ?? layer?.lineweight ?? null;
  return {
    dash: linetype && linetype !== 'solid' ? LINETYPE_DASH[linetype] : undefined,
    width: lineweight != null ? lineweightToStroke(lineweight) : undefined,
  };
}
