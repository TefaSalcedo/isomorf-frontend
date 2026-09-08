import type { ProjectElement, WallElement } from '@/types/project';
import { cmToMeters, distance, pointsEqual } from '@/lib/editor/geometry';

const CYCLE_EPSILON = 0.01;

export type Cycle = {
  points: { x: number; y: number }[];
  area: number;
  perimeter: number;
};

export type SelectionSummary = {
  totalLength: number;
  volume: number;
  interiorArea: number | null;
  exteriorArea: number | null;
  wallCount: number;
};

function toCmPoint(element: ProjectElement, end: 'start' | 'end') {
  return end === 'start' ? { x: element.x1, y: element.y1 } : { x: element.x2, y: element.y2 };
}

function findNodeIndex(nodes: { x: number; y: number }[], point: { x: number; y: number }): number {
  for (let i = 0; i < nodes.length; i += 1) {
    if (pointsEqual(nodes[i], point, CYCLE_EPSILON)) return i;
  }
  return -1;
}

export function findClosedLoops(elements: ProjectElement[]): Cycle[] | null {
  const walls = elements.filter((el) => el.element_type === 'wall');
  if (walls.length < 3) return null;
  const nodes: { x: number; y: number }[] = [];
  const edges: { a: number; b: number; el: WallElement }[] = [];
  for (const el of walls) {
    const a = toCmPoint(el, 'start');
    const b = toCmPoint(el, 'end');
    let ai = findNodeIndex(nodes, a);
    if (ai === -1) {
      ai = nodes.length;
      nodes.push(a);
    }
    let bi = findNodeIndex(nodes, b);
    if (bi === -1) {
      bi = nodes.length;
      nodes.push(b);
    }
    edges.push({ a: ai, b: bi, el });
  }
  const degree = new Array(nodes.length).fill(0);
  const adj: { to: number; edgeIndex: number }[][] = Array.from({ length: nodes.length }, () => []);
  edges.forEach((edge, index) => {
    degree[edge.a] += 1;
    degree[edge.b] += 1;
    adj[edge.a].push({ to: edge.b, edgeIndex: index });
    adj[edge.b].push({ to: edge.a, edgeIndex: index });
  });
  const visited = new Set<number>();
  const cycles: Cycle[] = [];
  for (let start = 0; start < nodes.length; start += 1) {
    if (visited.has(start)) continue;
    const component: number[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of adj[current]) {
        if (!visited.has(next.to)) {
          visited.add(next.to);
          stack.push(next.to);
        }
      }
    }
    const isCycle = component.every((index) => degree[index] === 2);
    if (!isCycle) return null;
    const ordered: { x: number; y: number }[] = [];
    const seenEdges = new Set<number>();
    let current = component[0];
    let prevEdge: number | null = null;
    do {
      ordered.push(nodes[current]);
      const next = adj[current].find((n) => n.edgeIndex !== prevEdge);
      if (!next) break;
      seenEdges.add(next.edgeIndex);
      prevEdge = next.edgeIndex;
      current = next.to;
    } while (current !== component[0]);
    if (ordered.length < 3) return null;
    const perimeter = ordered.reduce((sum, p, i) => {
      const q = ordered[(i + 1) % ordered.length];
      return sum + cmToMeters(distance(p, q));
    }, 0);
    const areaM2 = Math.abs(
      ordered.reduce((sum, p, i) => {
        const q = ordered[(i + 1) % ordered.length];
        const px = cmToMeters(p.x);
        const py = cmToMeters(p.y);
        const qx = cmToMeters(q.x);
        const qy = cmToMeters(q.y);
        return sum + (px * qy - qx * py);
      }, 0) / 2,
    );
    cycles.push({ points: ordered, area: areaM2, perimeter });
  }
  return cycles.length ? cycles : null;
}

export function calculateSelectionSummary(elements: ProjectElement[]): SelectionSummary {
  const walls = elements.filter((el) => el.element_type === 'wall') as WallElement[];
  const totalLength = elements.reduce((sum, el) => sum + cmToMeters(el.length), 0);
  const volume = elements.reduce((sum, el) => {
    if (el.element_type === 'wall') {
      const props = el.properties;
      return sum + cmToMeters(el.length) * (props.height ?? 2.5) * (props.thickness ?? 0.15);
    }
    if (el.element_type === 'column') {
      const props = el.properties;
      return sum + (props.width ?? 0.3) * (props.depth ?? 0.3) * (props.height ?? 2.5);
    }
    if (el.element_type === 'beam') {
      const props = el.properties;
      return sum + (props.width ?? 0.2) * (props.height ?? 0.3) * (props.length ?? cmToMeters(el.length));
    }
    return sum;
  }, 0);
  const loops = findClosedLoops(elements);
  if (!loops || loops.length === 0) {
    return { totalLength, volume, interiorArea: null, exteriorArea: null, wallCount: walls.length };
  }
  const totalCenterlineArea = loops.reduce((sum, cycle) => sum + cycle.area, 0);
  const totalPerimeter = loops.reduce((sum, cycle) => sum + cycle.perimeter, 0);
  const avgThickness =
    walls.reduce((sum, wall) => sum + (wall.properties.thickness ?? 0.15), 0) / Math.max(1, walls.length);
  const d = avgThickness / 2;
  const interiorArea = Math.max(0, totalCenterlineArea - d * totalPerimeter + Math.PI * d * d);
  const exteriorArea = totalCenterlineArea + d * totalPerimeter + Math.PI * d * d;
  return {
    totalLength,
    volume,
    interiorArea,
    exteriorArea,
    wallCount: walls.length,
  };
}
