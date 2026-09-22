import { describe, expect, it } from 'vitest';
import { createBeam, createColumn } from '@/lib/editor/elements';
import {
  beamDesign,
  columnDesign,
  currentInputs,
  DEFAULT_BEAM_LOADS,
  DEFAULT_BEAM_REINFORCEMENT,
  DEFAULT_COLUMN_LOADS,
  DEFAULT_COLUMN_REINFORCEMENT,
  DEFAULT_CONCRETE,
  isMemoryStale,
  memoryToMarkdown,
} from './member-design';

const column = createColumn('c1', 'p1', { x: 0, y: 0 }, { width: 0.3, depth: 0.3, height: 2.5 });
const beam = createBeam('b1', 'p1', { x: 0, y: 0 }, { x: 400, y: 0 }); // 4 m span, 0.2 x 0.3 m

describe('columnDesign', () => {
  const memory = columnDesign(column, DEFAULT_CONCRETE, DEFAULT_COLUMN_REINFORCEMENT, DEFAULT_COLUMN_LOADS);

  it('reproduces the reference hand calculation', () => {
    // Ag = 0.3*0.3*1e6 = 90000 mm2; As = 4*PI*16^2/4 = 804.25 mm2
    // Pu = 400 + 1.2*(0.3*0.3*2.5*24) = 406.48 kN
    // phiPn = 0.65*0.8*(0.85*21*(90000-804.25) + 420*804.25)/1000 = 1003.56 kN
    expect(memory.ratio).toBeCloseTo(0.405, 3);
  });

  it('flags the low reinforcement ratio as review', () => {
    // rho = 804.25 / 90000 = 0.89% < 1% minimum
    expect(memory.status).toBe('review');
    expect(memory.warnings.some((warning) => warning.includes('Reinforcement ratio'))).toBe(true);
  });

  it('produces summary entries and calculation steps', () => {
    expect(memory.steps).toHaveLength(8);
    const dc = memory.summary.find((item) => item.label === 'Demand/Capacity');
    expect(dc?.value).toBe('0.405');
    expect(memory.inputs.geometry).toEqual({ width: 0.3, depth: 0.3, height: 2.5 });
  });

  it('renders warnings in Spanish when locale is es', () => {
    const memoryEs = columnDesign(column, DEFAULT_CONCRETE, DEFAULT_COLUMN_REINFORCEMENT, DEFAULT_COLUMN_LOADS, 'es');
    expect(memoryEs.warnings.some((warning) => warning.includes('Cuantía'))).toBe(true);
  });
});

describe('beamDesign', () => {
  const memory = beamDesign(beam, DEFAULT_CONCRETE, DEFAULT_BEAM_REINFORCEMENT, DEFAULT_BEAM_LOADS);

  it('reproduces the reference hand calculation', () => {
    // d = 300-40-9.5-8 = 242.5 mm; As = 3*201.06 = 603.19 mm2
    // wu = 25 + 1.2*1.44 = 26.728 kN/m; Mu = 53.46 kNm; phiMn = 47.2 kNm
    expect(memory.ratio).toBeCloseTo(1.13, 2);
    expect(memory.status).toBe('review');
    expect(memory.warnings.some((warning) => warning.includes('Ultimate moment'))).toBe(true);
  });

  it('records geometry inputs in meters', () => {
    expect(memory.inputs.geometry).toEqual({ width: 0.2, height: 0.3, length: 4 });
  });
});

describe('isMemoryStale', () => {
  it('detects matching and diverging inputs', () => {
    const memory = columnDesign(column, DEFAULT_CONCRETE, DEFAULT_COLUMN_REINFORCEMENT, DEFAULT_COLUMN_LOADS);
    expect(isMemoryStale(memory, currentInputs(column, DEFAULT_CONCRETE, DEFAULT_COLUMN_REINFORCEMENT, DEFAULT_COLUMN_LOADS))).toBe(false);
    expect(isMemoryStale(memory, currentInputs(column, DEFAULT_CONCRETE, DEFAULT_COLUMN_REINFORCEMENT, { axial: 500, distributed: 0 }))).toBe(true);
  });
});

describe('memoryToMarkdown', () => {
  it('exports a readable calculation memory', () => {
    const memory = beamDesign(beam, DEFAULT_CONCRETE, DEFAULT_BEAM_REINFORCEMENT, DEFAULT_BEAM_LOADS);
    const markdown = memoryToMarkdown(memory, { projectName: 'Frame', elementLabel: 'Beam B-1' });
    expect(markdown).toContain('# Calculation memory — Beam B-1');
    expect(markdown).toContain('Project: Frame');
    expect(markdown).toContain('## Development');
    expect(markdown).toContain('Ultimate moment');
  });
});
