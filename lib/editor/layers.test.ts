import { describe, expect, it } from 'vitest';
import type { PlanLayer } from '@/types/project';
import { createColumn, createWall } from './elements';
import { countElementsByLayer, createLayer, defaultLayerFor, defaultLayers, ensureLayers, isElementLocked, isElementVisible, LAYER_PALETTE, layerOf, lineweightToStroke, resolveLineStyle } from './layers';

describe('defaultLayers', () => {
  it('provides architecture, structure and openings layers', () => {
    const layers = defaultLayers();
    expect(layers.map((layer) => layer.id)).toEqual(['architecture', 'structure', 'openings']);
    expect(layers.every((layer) => layer.visible && !layer.locked)).toBe(true);
  });
});

describe('ensureLayers', () => {
  it('falls back to defaults when empty or undefined', () => {
    expect(ensureLayers(undefined)).toEqual(defaultLayers());
    expect(ensureLayers([])).toEqual(defaultLayers());
  });

  it('keeps existing layers while backfilling week-10 style fields', () => {
    const custom: PlanLayer[] = [{ id: 'x', name: 'X', color: '#000000', visible: false, locked: true }];
    expect(ensureLayers(custom)).toEqual([{ id: 'x', name: 'X', color: '#000000', visible: false, locked: true, linetype: null, lineweight: null }]);
  });
});

describe('defaultLayerFor', () => {
  it('routes elements to their discipline layer', () => {
    expect(defaultLayerFor('column')).toBe('structure');
    expect(defaultLayerFor('beam')).toBe('structure');
    expect(defaultLayerFor('door')).toBe('openings');
    expect(defaultLayerFor('window')).toBe('openings');
    expect(defaultLayerFor('wall')).toBe('architecture');
  });
});

describe('createLayer', () => {
  it('names the layer and cycles the palette', () => {
    const layer = createLayer(1);
    expect(layer.name).toBe('Layer 2');
    expect(layer.color).toBe(LAYER_PALETTE[1]);
    expect(layer.visible).toBe(true);
  });

  it('names layers in Spanish when locale is es', () => {
    expect(createLayer(1, 'es').name).toBe('Capa 2');
    expect(defaultLayers('es').map((layer) => layer.name)).toEqual(['Arquitectura', 'Estructura', 'Vanos']);
  });
});

describe('layerOf and element predicates', () => {
  const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 100, y: 0 });

  it('resolves the explicit layer_id or the default discipline layer', () => {
    const layers = defaultLayers();
    expect(layerOf(wall, layers)?.id).toBe('architecture');
    const assigned = { ...wall, properties: { ...wall.properties, layer_id: 'structure' } };
    expect(layerOf(assigned, layers)?.id).toBe('structure');
  });

  it('reports visibility and locking from the owning layer', () => {
    const hidden: PlanLayer[] = [{ id: 'architecture', name: 'A', color: '#000000', visible: false, locked: true }];
    expect(isElementVisible(wall, hidden)).toBe(false);
    expect(isElementLocked(wall, hidden)).toBe(true);
    expect(isElementVisible(wall, defaultLayers())).toBe(true);
  });

  it('counts elements per layer using the default fallback', () => {
    const column = createColumn('c1', 'p1', { x: 0, y: 0 });
    const elements = [wall, column, { ...wall, id: 'w2', properties: { ...wall.properties, layer_id: 'structure' } }];
    expect(countElementsByLayer(elements, 'architecture')).toBe(1);
    expect(countElementsByLayer(elements, 'structure')).toBe(2);
  });
});

describe('ensureLayers normalization', () => {
  it('backfills style fields on documents saved before week 10', () => {
    const legacy: PlanLayer[] = [{ id: 'x', name: 'X', color: '#000000', visible: true, locked: false }];
    const [layer] = ensureLayers(legacy);
    expect(layer.linetype).toBeNull();
    expect(layer.lineweight).toBeNull();
  });
});

describe('resolveLineStyle', () => {
  const wall = createWall('w1', 'p1', { x: 0, y: 0 }, { x: 100, y: 0 });

  it('returns no overrides for a plain element on a plain layer', () => {
    expect(resolveLineStyle(wall, defaultLayers())).toEqual({ dash: undefined, width: undefined });
  });

  it('inherits the layer linetype and lineweight', () => {
    const layers: PlanLayer[] = [{ id: 'architecture', name: 'A', color: '#000', visible: true, locked: false, linetype: 'dashed', lineweight: 0.5 }];
    const resolved = resolveLineStyle(wall, layers);
    expect(resolved.dash).toEqual([12, 6]);
    expect(resolved.width).toBeCloseTo(5);
  });

  it('lets the element override the layer', () => {
    const layers: PlanLayer[] = [{ id: 'architecture', name: 'A', color: '#000', visible: true, locked: false, linetype: 'dashed', lineweight: 0.5 }];
    const overridden = { ...wall, properties: { ...wall.properties, linetype: 'hidden' as const, lineweight: 0.18 } };
    const resolved = resolveLineStyle(overridden, layers);
    expect(resolved.dash).toEqual([6, 3]);
    expect(resolved.width).toBeCloseTo(1.8);
  });

  it('treats solid as a continuous stroke even when the layer dashes', () => {
    const layers: PlanLayer[] = [{ id: 'architecture', name: 'A', color: '#000', visible: true, locked: false, linetype: 'dashed' }];
    const solid = { ...wall, properties: { ...wall.properties, linetype: 'solid' as const } };
    expect(resolveLineStyle(solid, layers).dash).toBeUndefined();
  });

  it('clamps lineweight strokes to a readable minimum', () => {
    expect(lineweightToStroke(0.01)).toBe(0.5);
    expect(lineweightToStroke(0.7)).toBeCloseTo(7);
  });
});
