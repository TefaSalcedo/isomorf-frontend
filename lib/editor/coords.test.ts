import { describe, expect, it } from 'vitest';
import { parsePointInput, resolvePoint } from './coords';

describe('parsePointInput', () => {
  it('parses absolute coordinates', () => {
    expect(parsePointInput('6,0')).toEqual({ kind: 'absolute', x: 6, y: 0 });
    expect(parsePointInput('6.5,-2.25')).toEqual({ kind: 'absolute', x: 6.5, y: -2.25 });
    expect(parsePointInput(' 0 , 4 ')).toEqual({ kind: 'absolute', x: 0, y: 4 });
  });

  it('parses relative coordinates', () => {
    expect(parsePointInput('@0,4')).toEqual({ kind: 'relative', dx: 0, dy: 4 });
    expect(parsePointInput('@-1.5,2')).toEqual({ kind: 'relative', dx: -1.5, dy: 2 });
  });

  it('parses polar length+angle and partial forms', () => {
    expect(parsePointInput('4<45')).toEqual({ kind: 'polar', length: 4, angle: 45 });
    expect(parsePointInput('4<')).toEqual({ kind: 'polar', length: 4, angle: undefined });
    expect(parsePointInput('<90')).toEqual({ kind: 'polar', length: undefined, angle: 90 });
    expect(parsePointInput('<')).toBeNull();
  });

  it('parses rectangle sizes', () => {
    expect(parsePointInput('6x4')).toEqual({ kind: 'size', width: 6, height: 4 });
    expect(parsePointInput('2.5X1.5')).toEqual({ kind: 'size', width: 2.5, height: 1.5 });
  });

  it('parses a bare number as radius/length and c as close', () => {
    expect(parsePointInput('3')).toEqual({ kind: 'radius', radius: 3 });
    expect(parsePointInput('c')).toEqual({ kind: 'close' });
    expect(parsePointInput('C')).toEqual({ kind: 'close' });
  });

  it('rejects garbage and empty input', () => {
    expect(parsePointInput('')).toBeNull();
    expect(parsePointInput('abc')).toBeNull();
    expect(parsePointInput('1,2,3')).toBeNull();
    expect(parsePointInput('@5')).toBeNull();
    expect(parsePointInput('4<45<30')).toBeNull();
    expect(parsePointInput('1x2x3')).toBeNull();
  });
});

describe('resolvePoint', () => {
  it('converts display units to world centimeters', () => {
    expect(resolvePoint({ kind: 'absolute', x: 6, y: 4 }, { x: 0, y: 0 }, 'm')).toEqual({ x: 600, y: 400 });
  });

  it('resolves relative input against the draft anchor', () => {
    expect(resolvePoint({ kind: 'relative', dx: 0, dy: 4 }, { x: 600, y: 0 }, 'm')).toEqual({ x: 600, y: 400 });
  });

  it('resolves polar input around the anchor', () => {
    const p = resolvePoint({ kind: 'polar', length: 4, angle: 90 }, { x: 600, y: 0 }, 'm');
    expect(p.x).toBeCloseTo(600);
    expect(p.y).toBeCloseTo(400);
  });

  it('honors feet as the display unit', () => {
    const p = resolvePoint({ kind: 'absolute', x: 1, y: 0 }, { x: 0, y: 0 }, 'ft');
    expect(p.x).toBeCloseTo(30.48);
  });
});
