import { describe, expect, it } from 'vitest';
import type { DimensionElement, TableElement } from '@/types/project';
import { clampPrecision, DEFAULT_DIM_STYLES, dimensionGeometry, elementArea, elementPerimeter, ensureDimStyles, formatDimension, linearOrientation, measureDimension, normalizeTextAngle, paperToWorld, resizeTable, resolveDimStyle } from './annotations';
import { createCircle, createEllipse, createRectangle } from './elements';
import { mirrorElement, rotateElement, scaleElement } from './edit-ops';

const baseDimension = (kind: DimensionElement['properties']['kind'], overrides: Partial<DimensionElement> = {}): DimensionElement => ({
  id: 'dimension-1',
  project_id: 'project-1',
  x1: 0,
  y1: 0,
  x2: 300,
  y2: 400,
  length: 500,
  rotation: 0,
  material_id: null,
  section_id: null,
  created_at: '',
  updated_at: '',
  element_type: 'dimension',
  properties: { kind, dim_point: { x: 150, y: 200 } },
  ...overrides,
});

describe('annotation dimensions', () => {
  it('provides and selects DIM styles and converts paper millimeters to world centimeters', () => {
    expect(ensureDimStyles()).toEqual(DEFAULT_DIM_STYLES);
    expect(resolveDimStyle(DEFAULT_DIM_STYLES, 'missing-style', 'arq').id).toBe('arq');
    expect(resolveDimStyle(DEFAULT_DIM_STYLES, 'iso-25', 'arq').id).toBe('iso-25');
    expect(paperToWorld(2.5, 50)).toBe(12.5);
    expect(paperToWorld(1.25, 100)).toBe(12.5);
  });

  it('measures linear, aligned, radial and diameter dimensions in centimeters', () => {
    expect(measureDimension(baseDimension('linear'))).toBe(300);
    expect(measureDimension(baseDimension('linear', { properties: { kind: 'linear', orientation: 'vertical', dim_point: { x: 0, y: 0 } } }))).toBe(400);
    expect(measureDimension(baseDimension('aligned'))).toBe(500);
    expect(measureDimension(baseDimension('radial', { properties: { kind: 'radial', radius: 125, dim_point: { x: 0, y: 0 } } }))).toBe(125);
    expect(measureDimension(baseDimension('diameter', { properties: { kind: 'diameter', radius: 125, dim_point: { x: 0, y: 0 } } }))).toBe(250);
  });

  it('measures either angular sector according to the dimension point', () => {
    const common = {
      x1: 100,
      y1: 0,
      x2: 0,
      y2: 100,
      properties: { kind: 'angular' as const, vertex: { x: 0, y: 0 }, dim_point: { x: 50, y: 50 } },
    };
    expect(measureDimension(baseDimension('angular', common))).toBeCloseTo(Math.PI / 2);
    expect(measureDimension(baseDimension('angular', { ...common, properties: { ...common.properties, dim_point: { x: 50, y: -50 } } }))).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('formats unit conversions, precision, symbols and both override forms', () => {
    const dimension = baseDimension('linear', { x2: 500, y2: 0, properties: { kind: 'linear', dim_point: { x: 250, y: 100 } } });
    expect(formatDimension(dimension, { ...DEFAULT_DIM_STYLES[0], unit: 'm' })).toBe('5.00');
    expect(formatDimension(dimension, { ...DEFAULT_DIM_STYLES[0], unit: 'mm', decimals: 0 })).toBe('5000');
    expect(formatDimension(baseDimension('radial', { properties: { kind: 'radial', radius: 500, dim_point: { x: 0, y: 0 } } }), DEFAULT_DIM_STYLES[0])).toBe('R5.00');
    expect(formatDimension(baseDimension('diameter', { properties: { kind: 'diameter', radius: 500, dim_point: { x: 0, y: 0 } } }), DEFAULT_DIM_STYLES[0])).toBe('Ø10.00');
    expect(formatDimension({ ...dimension, properties: { ...dimension.properties, text_override: 'Length <> m' } }, DEFAULT_DIM_STYLES[0])).toBe('Length 5.00 m');
    expect(formatDimension({ ...dimension, properties: { ...dimension.properties, text_override: 'NTS' } }, DEFAULT_DIM_STYLES[0])).toBe('NTS');
  });

  it('keeps linear dimension measurement and geometry coherent after rotation and mirroring', () => {
    const dimension = baseDimension('linear', {
      x1: 0,
      y1: 0,
      x2: 300,
      y2: 0,
      length: 300,
      properties: { kind: 'linear', orientation: 'horizontal', dim_point: { x: 150, y: -100 } },
    });
    const rotated = rotateElement(dimension, { x: 20, y: 30 }, Math.PI / 2) as DimensionElement;
    const geometry = dimensionGeometry(rotated, DEFAULT_DIM_STYLES[0], 50);
    expect(measureDimension(rotated)).toBeCloseTo(300);
    expect(geometry.lines[2].start.x).toBeCloseTo(geometry.lines[2].end.x);
    expect(geometry.text.angle).toBeCloseTo(Math.PI / 2);

    const mirrored = mirrorElement(dimension, { x: 0, y: 0 }, { x: 1, y: 1 }) as DimensionElement;
    const mirroredGeometry = dimensionGeometry(mirrored, DEFAULT_DIM_STYLES[0], 50);
    expect(measureDimension(mirrored)).toBeCloseTo(300);
    expect(mirroredGeometry.lines[2].start.x).toBeCloseTo(mirroredGeometry.lines[2].end.x);
    expect(mirroredGeometry.text.angle).toBeCloseTo(Math.PI / 2);
  });

  it('chooses linear orientation from the dimension cursor and keeps text upright', () => {
    expect(linearOrientation({ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 100, y: 40 })).toBe('vertical');
    expect(linearOrientation({ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 150, y: 80 })).toBe('horizontal');
    expect(normalizeTextAngle((3 * Math.PI) / 4)).toBeCloseTo(-Math.PI / 4);
    expect(normalizeTextAngle((-3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 4);
  });

  it('projects each measured endpoint onto horizontal and vertical linear dimensions', () => {
    const horizontal = dimensionGeometry(
      baseDimension('linear', {
        x1: 500,
        y1: 100,
        x2: 800,
        y2: 300,
        properties: { kind: 'linear', orientation: 'horizontal', dim_point: { x: 650, y: 50 } },
      }),
      DEFAULT_DIM_STYLES[0],
      50,
    );
    expect(horizontal.lines[2].start).toEqual({ x: 500, y: 50 });
    expect(horizontal.lines[2].end).toEqual({ x: 800, y: 50 });
    expect(horizontal.text.value).toBe('3.00');

    const vertical = dimensionGeometry(
      baseDimension('linear', {
        x1: 500,
        y1: 100,
        x2: 800,
        y2: 300,
        properties: { kind: 'linear', orientation: 'vertical', dim_point: { x: 300, y: 200 } },
      }),
      DEFAULT_DIM_STYLES[0],
      50,
    );
    expect(vertical.lines[2].start.x).toBeCloseTo(300);
    expect(vertical.lines[2].start.y).toBeCloseTo(100);
    expect(vertical.lines[2].end.x).toBeCloseTo(300);
    expect(vertical.lines[2].end.y).toBeCloseTo(300);
    expect(vertical.text.value).toBe('2.00');
  });

  it('builds scale-aware dimension extension, offset, arrow and label geometry', () => {
    const geometry = dimensionGeometry(
      baseDimension('linear', { x2: 500, y2: 0, properties: { kind: 'linear', dim_point: { x: 250, y: 200 } } }),
      DEFAULT_DIM_STYLES[0],
      50,
    );
    expect(geometry.lines[0].start.y).toBeCloseTo(6.25);
    expect(geometry.lines[0].end.y).toBeCloseTo(206.25);
    expect(geometry.arrows[0].size).toBeCloseTo(12.5);
    expect(geometry.text.point.y).toBeCloseTo(207.5);
    expect(geometry.text.value).toBe('5.00');
  });

  it('projects both linear endpoints onto the selected horizontal or vertical dimension line', () => {
    const horizontal = dimensionGeometry(
      baseDimension('linear', {
        x1: 500,
        y1: 100,
        x2: 800,
        y2: 300,
        properties: { kind: 'linear', orientation: 'horizontal', dim_point: { x: 650, y: 50 } },
      }),
      DEFAULT_DIM_STYLES[0],
      50,
    );
    const vertical = dimensionGeometry(
      baseDimension('linear', {
        x1: 500,
        y1: 100,
        x2: 800,
        y2: 300,
        properties: { kind: 'linear', orientation: 'vertical', dim_point: { x: 300, y: 200 } },
      }),
      DEFAULT_DIM_STYLES[0],
      50,
    );

    expect(horizontal.lines[2].start).toEqual({ x: 500, y: 50 });
    expect(horizontal.lines[2].end).toEqual({ x: 800, y: 50 });
    expect(horizontal.text.value).toBe('3.00');
    expect(vertical.lines[2].start.x).toBeCloseTo(300);
    expect(vertical.lines[2].end.x).toBeCloseTo(300);
    expect(vertical.text.value).toBe('2.00');
  });

  it('uses only the normal projection for aligned dimension offsets', () => {
    const geometry = dimensionGeometry(
      baseDimension('aligned', {
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        properties: { kind: 'aligned', dim_point: { x: 150, y: 10 } },
      }),
      DEFAULT_DIM_STYLES[0],
      50,
    );
    expect(geometry.lines[2].start.y).toBeCloseTo(10);
    expect(geometry.lines[2].end.y).toBeCloseTo(10);
  });

  it('clamps negative and fractional dimension precision to safe integers', () => {
    const linear = baseDimension('linear', {
      x2: 123.456,
      y2: 0,
      properties: { kind: 'linear', dim_point: { x: 50, y: 100 } },
    });
    const angular = baseDimension('angular', {
      x1: 100,
      y1: 0,
      x2: 0,
      y2: 100,
      properties: { kind: 'angular', vertex: { x: 0, y: 0 }, dim_point: { x: 50, y: 50 } },
    });
    expect(clampPrecision(-1, 6)).toBe(0);
    expect(clampPrecision(2.7, 6)).toBe(2);
    expect(formatDimension(linear, { ...DEFAULT_DIM_STYLES[0], decimals: -1 })).toBe('1');
    expect(formatDimension(linear, { ...DEFAULT_DIM_STYLES[0], decimals: 2.7 })).toBe('1.23');
    expect(formatDimension(angular, { ...DEFAULT_DIM_STYLES[0], angle_decimals: 2.7 })).toBe('90.00°');
  });

  it('offsets radial and diameter labels perpendicular to their line geometry', () => {
    const radial = baseDimension('radial', {
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      properties: { kind: 'radial', radius: 100, dim_point: { x: 150, y: 0 } },
    });
    const diameter = baseDimension('diameter', {
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      properties: { kind: 'diameter', radius: 100, dim_point: { x: 150, y: 0 } },
    });
    const radialGeometry = dimensionGeometry(radial, DEFAULT_DIM_STYLES[0], 50);
    const diameterGeometry = dimensionGeometry(diameter, DEFAULT_DIM_STYLES[0], 50);
    const expectedOffset = paperToWorld(DEFAULT_DIM_STYLES[0].text_height * 0.6, 50);

    expect(radialGeometry.text.point.x).toBeCloseTo(150);
    expect(radialGeometry.text.point.y).toBeCloseTo(expectedOffset);
    expect(diameterGeometry.text.point.x).toBeCloseTo(0);
    expect(diameterGeometry.text.point.y).toBeCloseTo(expectedOffset);
    expect(radialGeometry.text.angle).toBeGreaterThan(-Math.PI / 2);
    expect(radialGeometry.text.angle).toBeLessThanOrEqual(Math.PI / 2);
    expect(diameterGeometry.text.angle).toBeGreaterThan(-Math.PI / 2);
    expect(diameterGeometry.text.angle).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('updates annotation point geometry and radius through transforms', () => {
    const radial = baseDimension('radial', {
      x1: 10,
      y1: 20,
      x2: 110,
      y2: 20,
      properties: { kind: 'radial', radius: 100, dim_point: { x: 110, y: 20 } },
    });
    const rotated = rotateElement(radial, { x: 10, y: 20 }, Math.PI / 2) as DimensionElement;
    expect(rotated.x2).toBeCloseTo(10);
    expect(rotated.y2).toBeCloseTo(120);
    const scaled = scaleElement(radial, { x: 0, y: 0 }, 2) as DimensionElement;
    expect(scaled.properties.radius).toBe(200);
    expect(scaled.properties.dim_point).toEqual({ x: 220, y: 40 });

    const angular = baseDimension('angular', {
      x1: 100,
      y1: 0,
      x2: 0,
      y2: 100,
      properties: { kind: 'angular', vertex: { x: 0, y: 0 }, dim_point: { x: 50, y: 50 } },
    });
    const moved = rotateElement(angular, { x: 0, y: 0 }, Math.PI / 2) as DimensionElement;
    expect(moved.properties.vertex).toEqual({ x: 0, y: 0 });
    expect(moved.properties.dim_point.x).toBeCloseTo(-50);
    expect(moved.properties.dim_point.y).toBeCloseTo(50);
  });
});

describe('annotation measurements and tables', () => {
  it('returns area and perimeter for supported closed shapes', () => {
    const circle = createCircle('circle', 'project-1', { x: 0, y: 0 }, 100);
    const ellipse = createEllipse('ellipse', 'project-1', { x: 0, y: 0 }, { x: 600, y: 400 });
    const rectangle = createRectangle('rectangle', 'project-1', { x: 0, y: 0 }, { x: 300, y: 200 });
    expect(elementArea(circle)).toBeCloseTo(Math.PI * 10_000);
    expect(elementPerimeter(circle)).toBeCloseTo(200 * Math.PI);
    expect(elementArea(ellipse)).toBeCloseTo(Math.PI * 60_000);
    expect(elementPerimeter(ellipse)).toBeCloseTo(1_586.56, 1);
    expect(elementArea(rectangle)).toBe(60_000);
    expect(elementPerimeter(rectangle)).toBe(1_000);
  });

  it('resizes table cells and bounds dimensions to positive row and column counts', () => {
    const table: TableElement = {
      id: 'table-1',
      project_id: 'project-1',
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 280,
      length: 200,
      rotation: 0,
      material_id: null,
      section_id: null,
      created_at: '',
      updated_at: '',
      element_type: 'table',
      properties: { rows: 2, cols: 2, cells: [['A', 'B'], ['C', 'D']], header: true, text_height: 2.5 },
    };
    const resized = resizeTable(table, 3, 4);
    expect(resized.properties.cells).toEqual([['A', 'B', '', ''], ['C', 'D', '', ''], ['', '', '', '']]);
    expect(resized.x2 - resized.x1).toBe(400);
    expect(resized.y2 - resized.y1).toBe(120);
    expect(resizeTable(table, 0, 0).properties.cells).toEqual([['A']]);
  });
});
