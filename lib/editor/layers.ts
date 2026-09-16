import type { PlanLayer, ProjectElement } from '@/types/project';

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

export function defaultLayers(): PlanLayer[] {
  return [
    { id: 'architecture', name: 'Arquitectura', color: '#1f2937', visible: true, locked: false },
    { id: 'structure', name: 'Estructura', color: '#7c3aed', visible: true, locked: false },
    { id: 'openings', name: 'Vanos', color: '#0891b2', visible: true, locked: false },
  ];
}

export function ensureLayers(layers: PlanLayer[] | undefined): PlanLayer[] {
  return layers && layers.length > 0 ? layers : defaultLayers();
}

export function defaultLayerFor(elementType: ProjectElement['element_type']): string {
  if (elementType === 'column' || elementType === 'beam') return 'structure';
  if (elementType === 'door' || elementType === 'window') return 'openings';
  return 'architecture';
}

export function createLayer(index: number): PlanLayer {
  return {
    id: crypto.randomUUID(),
    name: `Capa ${index + 1}`,
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
