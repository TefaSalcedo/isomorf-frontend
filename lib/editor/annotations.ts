import type { DimStyle, DimensionElement, ProjectElement, TableElement } from '@/types/project';
import { ccwSweep, distance, normalizeAngle } from '@/lib/editor/geometry';

export type Segment = { start: { x: number; y: number }; end: { x: number; y: number } };
export type AnnotationGeometry = {
  lines: Segment[];
  arcs: { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number }[];
  arrows: { tip: { x: number; y: number }; angle: number; kind: DimStyle['arrow']; size: number }[];
  text: { point: { x: number; y: number }; angle: number; value: string };
};

export const DEFAULT_DIM_STYLES: DimStyle[] = [
  {
    id: 'iso-25',
    name: 'ISO-25',
    text_height: 2.5,
    arrow: 'arrow',
    arrow_size: 2.5,
    ext_offset: 1.25,
    ext_extend: 1.25,
    decimals: 2,
    unit: 'm',
    angle_decimals: 0,
  },
  {
    id: 'arq',
    name: 'Architectural',
    text_height: 2.5,
    arrow: 'tick',
    arrow_size: 2,
    ext_offset: 1.25,
    ext_extend: 1.25,
    decimals: 2,
    unit: 'm',
    angle_decimals: 0,
  },
];

export function ensureDimStyles(styles?: DimStyle[] | null): DimStyle[] {
  if (!styles?.length) return DEFAULT_DIM_STYLES.map((style) => ({ ...style }));
  return styles.map((style) => ({ ...style }));
}

export function activeDimStyle(styles?: DimStyle[] | null, activeId?: string | null): DimStyle {
  const safeStyles = ensureDimStyles(styles);
  return safeStyles.find((style) => style.id === activeId) ?? safeStyles[0];
}

export function resolveDimStyle(
  styles: DimStyle[] | null | undefined,
  styleId?: string | null,
  fallbackId?: string | null,
): DimStyle {
  const safeStyles = ensureDimStyles(styles);
  return safeStyles.find((style) => style.id === styleId)
    ?? safeStyles.find((style) => style.id === fallbackId)
    ?? safeStyles[0];
}

export function paperToWorld(mm: number, scale: number): number {
  return (mm * scale) / 10;
}

export function measureDimension(element: DimensionElement): number {
  const { kind, radius, vertex } = element.properties;
  const p1 = { x: element.x1, y: element.y1 };
  const p2 = { x: element.x2, y: element.y2 };
  switch (kind) {
    case 'linear':
      {
        const axisAngle = (element.properties.orientation === 'vertical' ? Math.PI / 2 : 0) + element.rotation;
        return Math.abs((p2.x - p1.x) * Math.cos(axisAngle) + (p2.y - p1.y) * Math.sin(axisAngle));
      }
    case 'aligned':
      return distance(p1, p2);
    case 'radial':
      return radius ?? distance(p1, p2);
    case 'diameter':
      return 2 * (radius ?? distance(p1, p2));
    case 'angular': {
      if (!vertex) return 0;
      const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
      const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
      const ap = Math.atan2(element.properties.dim_point.y - vertex.y, element.properties.dim_point.x - vertex.x);
      const sweep = ccwSweep(a1, a2);
      return ccwSweep(a1, ap) <= sweep + 1e-9 ? sweep : ccwSweep(a2, a1);
    }
  }
}

function measuredText(value: number, style: DimStyle, kind: DimensionElement['properties']['kind']): string {
  if (kind === 'angular') {
    const degrees = (value * 180) / Math.PI;
    return `${degrees.toFixed(style.angle_decimals)}°`;
  }
  const converted = style.unit === 'm' ? value / 100 : style.unit === 'mm' ? value * 10 : value;
  const formatted = converted.toFixed(style.decimals);
  if (kind === 'radial') return `R${formatted}`;
  if (kind === 'diameter') return `Ø${formatted}`;
  return formatted;
}

export function formatDimension(element: DimensionElement, style: DimStyle): string {
  const measured = measuredText(measureDimension(element), style, element.properties.kind);
  const override = element.properties.text_override;
  if (!override) return measured;
  return override.includes('<>') ? override.replaceAll('<>', measured) : override;
}

export function linearOrientation(p1: { x: number; y: number }, p2: { x: number; y: number }, cursor: { x: number; y: number }): 'horizontal' | 'vertical' {
  const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return Math.abs(cursor.y - midpoint.y) >= Math.abs(cursor.x - midpoint.x) ? 'horizontal' : 'vertical';
}

export function normalizeTextAngle(angle: number): number {
  let normalized = normalizeAngle(angle);
  if (normalized > Math.PI / 2) normalized -= Math.PI;
  if (normalized <= -Math.PI / 2) normalized += Math.PI;
  return normalized;
}

function add(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function multiply(p: { x: number; y: number }, scalar: number) {
  return { x: p.x * scalar, y: p.y * scalar };
}

function unit(p: { x: number; y: number }) {
  const length = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / length, y: p.y / length };
}

function arrow(geometry: AnnotationGeometry, tip: { x: number; y: number }, toward: { x: number; y: number }, style: DimStyle, scale: number) {
  geometry.arrows.push({
    tip,
    angle: Math.atan2(toward.y - tip.y, toward.x - tip.x),
    kind: style.arrow,
    size: paperToWorld(style.arrow_size, scale),
  });
}

export function dimensionGeometry(element: DimensionElement, style: DimStyle, scale: number): AnnotationGeometry {
  const geometry: AnnotationGeometry = { lines: [], arcs: [], arrows: [], text: { point: { x: 0, y: 0 }, angle: 0, value: formatDimension(element, style) } };
  const props = element.properties;
  const p1 = { x: element.x1, y: element.y1 };
  const p2 = { x: element.x2, y: element.y2 };
  const dimPoint = props.dim_point;
  const offset = paperToWorld(style.ext_offset, scale);
  const extend = paperToWorld(style.ext_extend, scale);
  const arrowSize = paperToWorld(style.arrow_size, scale);
  if (props.kind === 'linear') {
    const axisAngle = (props.orientation === 'vertical' ? Math.PI / 2 : 0) + element.rotation;
    const direction = { x: Math.cos(axisAngle), y: Math.sin(axisAngle) };
    const normal = { x: -direction.y, y: direction.x };
    const offsetFromStart = (dimPoint.x - p1.x) * normal.x + (dimPoint.y - p1.y) * normal.y;
    const sign = offsetFromStart >= 0 ? 1 : -1;
    const displacement = multiply(normal, offsetFromStart);
    const q1 = add(p1, displacement);
    const q2 = add(p2, displacement);
    const n = multiply(normal, sign);
    const e1 = add(p1, multiply(n, offset));
    const e2 = add(p2, multiply(n, offset));
    const lineEnd1 = add(q1, multiply(n, extend));
    const lineEnd2 = add(q2, multiply(n, extend));
    geometry.lines.push({ start: e1, end: lineEnd1 }, { start: e2, end: lineEnd2 }, { start: q1, end: q2 });
    arrow(geometry, q1, q2, style, scale);
    arrow(geometry, q2, q1, style, scale);
    geometry.text.point = add(
      { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 },
      multiply(n, paperToWorld(style.text_height * 0.6, scale)),
    );
    geometry.text.angle = normalizeTextAngle(axisAngle);
    return geometry;
  }
  if (props.kind === 'aligned') {
    const direction = unit(subtract(p2, p1));
    const normal = { x: -direction.y, y: direction.x };
    const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const sign = (dimPoint.x - midpoint.x) * normal.x + (dimPoint.y - midpoint.y) * normal.y >= 0 ? 1 : -1;
    const displacement = multiply(normal, distance(midpoint, dimPoint) * sign);
    const q1 = add(p1, displacement);
    const q2 = add(p2, displacement);
    geometry.lines.push(
      { start: add(p1, multiply(normal, sign * offset)), end: add(q1, multiply(normal, sign * extend)) },
      { start: add(p2, multiply(normal, sign * offset)), end: add(q2, multiply(normal, sign * extend)) },
      { start: q1, end: q2 },
    );
    arrow(geometry, q1, q2, style, scale);
    arrow(geometry, q2, q1, style, scale);
    geometry.text.point = add(midpoint, add(displacement, multiply(normal, sign * (arrowSize + paperToWorld(style.text_height, scale)))));
    geometry.text.angle = normalizeTextAngle(Math.atan2(direction.y, direction.x));
    return geometry;
  }
  if (props.kind === 'angular' && props.vertex) {
    const vertex = props.vertex;
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    const ap = Math.atan2(dimPoint.y - vertex.y, dimPoint.x - vertex.x);
    const ccw = ccwSweep(a1, a2);
    const contains = ccwSweep(a1, ap) <= ccw + 1e-9;
    const startAngle = contains ? a1 : a2;
    const endAngle = contains ? a2 : a1;
    const radius = distance(vertex, dimPoint);
    geometry.arcs.push({ center: vertex, radius, startAngle, endAngle });
    const start = { x: vertex.x + Math.cos(startAngle) * radius, y: vertex.y + Math.sin(startAngle) * radius };
    const end = { x: vertex.x + Math.cos(endAngle) * radius, y: vertex.y + Math.sin(endAngle) * radius };
    geometry.lines.push(
      { start: p1, end: { x: vertex.x + Math.cos(a1) * (radius + extend), y: vertex.y + Math.sin(a1) * (radius + extend) } },
      { start: p2, end: { x: vertex.x + Math.cos(a2) * (radius + extend), y: vertex.y + Math.sin(a2) * (radius + extend) } },
    );
    arrow(geometry, start, { x: start.x + Math.sin(startAngle), y: start.y - Math.cos(startAngle) }, style, scale);
    arrow(geometry, end, { x: end.x - Math.sin(endAngle), y: end.y + Math.cos(endAngle) }, style, scale);
    const middle = startAngle + (ccwSweep(startAngle, endAngle) / 2);
    geometry.text.point = { x: vertex.x + Math.cos(middle) * (radius + arrowSize + paperToWorld(style.text_height, scale)), y: vertex.y + Math.sin(middle) * (radius + arrowSize + paperToWorld(style.text_height, scale)) };
    geometry.text.angle = normalizeTextAngle(middle);
    return geometry;
  }
  const radius = props.radius ?? distance(p1, p2);
  const direction = unit(subtract(dimPoint, p1));
  const rim = add(p1, multiply(direction, radius));
  const textOffset = paperToWorld(style.text_height * 0.6, scale);
  if (props.kind === 'radial') {
    geometry.lines.push({ start: p1, end: rim }, { start: rim, end: dimPoint });
    arrow(geometry, rim, p1, style, scale);
    geometry.text.angle = normalizeTextAngle(Math.atan2(dimPoint.y - rim.y, dimPoint.x - rim.x));
    const normal = { x: -Math.sin(geometry.text.angle), y: Math.cos(geometry.text.angle) };
    geometry.text.point = add(dimPoint, multiply(normal, textOffset));
  } else {
    const opposite = add(p1, multiply(direction, -radius));
    geometry.lines.push({ start: opposite, end: rim });
    arrow(geometry, opposite, rim, style, scale);
    arrow(geometry, rim, opposite, style, scale);
    geometry.text.angle = normalizeTextAngle(Math.atan2(direction.y, direction.x));
    const normal = { x: -Math.sin(geometry.text.angle), y: Math.cos(geometry.text.angle) };
    geometry.text.point = add(
      { x: (opposite.x + rim.x) / 2, y: (opposite.y + rim.y) / 2 },
      multiply(normal, textOffset),
    );
  }
  return geometry;
}

export function leaderGeometry(element: ProjectElement, style: DimStyle, scale: number): AnnotationGeometry | null {
  if (element.element_type !== 'leader') return null;
  const end = { x: element.x2, y: element.y2 };
  const direction = element.x2 >= element.x1 ? 1 : -1;
  const landing = { x: end.x + direction * paperToWorld(style.arrow_size * 2, scale), y: end.y };
  return {
    lines: [{ start: { x: element.x1, y: element.y1 }, end }, { start: end, end: landing }],
    arcs: [],
    arrows: [{ tip: { x: element.x1, y: element.y1 }, angle: Math.atan2(element.y1 - element.y2, element.x1 - element.x2), kind: style.arrow, size: paperToWorld(style.arrow_size, scale) }],
    text: { point: landing, angle: 0, value: element.properties.text },
  };
}

function polylinePoints(element: ProjectElement) {
  return element.element_type === 'polyline' ? element.properties.points : [];
}

export function elementArea(element: ProjectElement): number | null {
  if (element.element_type === 'circle') return Math.PI * element.properties.radius ** 2;
  if (element.element_type === 'ellipse') {
    const a = Math.abs(element.x2 - element.x1) / 2;
    const b = Math.abs(element.y2 - element.y1) / 2;
    return Math.PI * a * b;
  }
  if (element.element_type === 'rectangle' || element.element_type === 'hatch' || element.element_type === 'slab') {
    return Math.abs(element.x2 - element.x1) * Math.abs(element.y2 - element.y1);
  }
  if (element.element_type === 'polyline' && element.properties.closed && element.properties.points.length >= 3) {
    const points = polylinePoints(element);
    const count = points.length > 1 && points[0].x === points.at(-1)?.x && points[0].y === points.at(-1)?.y ? points.length - 1 : points.length;
    let sum = 0;
    for (let i = 0; i < count; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % count];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }
  return null;
}

export function elementPerimeter(element: ProjectElement): number | null {
  if (element.element_type === 'circle') return 2 * Math.PI * element.properties.radius;
  if (element.element_type === 'ellipse') {
    const a = Math.abs(element.x2 - element.x1) / 2;
    const b = Math.abs(element.y2 - element.y1) / 2;
    const h = ((a - b) ** 2) / ((a + b) ** 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }
  if (element.element_type === 'rectangle' || element.element_type === 'hatch' || element.element_type === 'slab') {
    return 2 * (Math.abs(element.x2 - element.x1) + Math.abs(element.y2 - element.y1));
  }
  if (element.element_type === 'polyline' && element.properties.closed && element.properties.points.length >= 3) {
    const points = polylinePoints(element);
    let length = 0;
    for (let i = 1; i < points.length; i += 1) length += distance(points[i - 1], points[i]);
    if (points[0].x !== points.at(-1)?.x || points[0].y !== points.at(-1)?.y) length += distance(points[0], points.at(-1)!);
    return length;
  }
  return null;
}

export function resizeTable(element: TableElement, rows: number, cols: number): TableElement {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  const cells = Array.from({ length: safeRows }, (_, row) =>
    Array.from({ length: safeCols }, (_, col) => element.properties.cells[row]?.[col] ?? ''),
  );
  return {
    ...element,
    x2: element.x1 + (Math.abs(element.x2 - element.x1) / element.properties.cols) * safeCols,
    y2: element.y1 + (Math.abs(element.y2 - element.y1) / element.properties.rows) * safeRows,
    length: Math.max(1, (Math.abs(element.x2 - element.x1) / element.properties.cols) * safeCols),
    properties: { ...element.properties, rows: safeRows, cols: safeCols, cells },
  };
}
