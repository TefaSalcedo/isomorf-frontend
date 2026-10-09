import type { Point } from '@/lib/editor/geometry';
import { displayToCm, type DisplayUnit } from '@/lib/editor/units';

/** Parsed dynamic-input command (AutoCAD-style). Distances are expressed in
 *  the user's display unit; ``toCm``/``resolvePoint`` convert to world cm. */
export type PointCommand =
  | { kind: 'absolute'; x: number; y: number }
  | { kind: 'relative'; dx: number; dy: number }
  | { kind: 'polar'; length?: number; angle?: number }
  | { kind: 'size'; width: number; height: number }
  | { kind: 'radius'; radius: number }
  | { kind: 'close' };

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const NUMBER_RE = new RegExp(`^${NUM}$`);
const COORD_RE = new RegExp(`^(${NUM}),(${NUM})$`);
const SIZE_RE = new RegExp(`^(${NUM})x(${NUM})$`, 'i');
const POLAR_RE = new RegExp(`^(${NUM})?<(${NUM})?$`);

/** Parse a dynamic-input string typed while a draw tool is armed.
 *  Grammar: ``x,y`` absolute, ``@dx,dy`` relative to the draft origin,
 *  ``L<angle`` polar, ``WxH`` rectangle size, bare ``R`` radius/length, and
 *  ``c`` to close a polyline. Returns null when the text is not a command. */
export function parsePointInput(raw: string): PointCommand | null {
  // Whitespace is cosmetic: ``6 , 4`` parses like ``6,4``.
  const text = raw.trim().replace(/\s+/g, '');
  if (!text) return null;
  if (text.toLowerCase() === 'c') return { kind: 'close' };

  if (text.startsWith('@')) {
    const rel = text.slice(1).match(COORD_RE);
    if (!rel) return null;
    return { kind: 'relative', dx: Number(rel[1]), dy: Number(rel[2]) };
  }

  const coord = text.match(COORD_RE);
  if (coord) return { kind: 'absolute', x: Number(coord[1]), y: Number(coord[2]) };

  const size = text.match(SIZE_RE);
  if (size) return { kind: 'size', width: Number(size[1]), height: Number(size[2]) };

  if (text.includes('<')) {
    const polar = text.match(POLAR_RE);
    if (!polar) return null;
    const length = polar[1] === undefined || polar[1] === '' ? undefined : Number(polar[1]);
    const angle = polar[2] === undefined || polar[2] === '' ? undefined : Number(polar[2]);
    if (length === undefined && angle === undefined) return null;
    return { kind: 'polar', length, angle };
  }

  if (NUMBER_RE.test(text)) return { kind: 'radius', radius: Number(text) };
  return null;
}

/** Resolve a coordinate command to a world-space point (cm). ``origin`` is
 *  the current draft anchor (last clicked point) used by relative input. */
export function resolvePoint(
  command: Exclude<PointCommand, { kind: 'size' | 'close' | 'radius' }>,
  origin: Point,
  unit: DisplayUnit,
): Point {
  if (command.kind === 'absolute') {
    return { x: displayToCm(command.x, unit), y: displayToCm(command.y, unit) };
  }
  if (command.kind === 'relative') {
    return { x: origin.x + displayToCm(command.dx, unit), y: origin.y + displayToCm(command.dy, unit) };
  }
  // polar: keep the missing component from the origin→current direction is the
  // caller's job; here we only need length+angle resolved around the origin.
  const length = displayToCm(command.length ?? 0, unit);
  const angle = ((command.angle ?? 0) * Math.PI) / 180;
  return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
}
