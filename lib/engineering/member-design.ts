import type {
  BeamElement,
  ColumnElement,
  ConcreteSpec,
  DesignInputs,
  DesignLoads,
  DesignMemory,
  DesignStep,
  ReinforcementSpec,
} from '@/types/project';

export const DESIGN_CODE = 'ACI 318-19 (resistencia última, verificación simplificada)';

export const DEFAULT_CONCRETE: ConcreteSpec = { fc: 21, fy: 420, cover: 0.04 };

export const DEFAULT_COLUMN_REINFORCEMENT: ReinforcementSpec = {
  bar_count: 4,
  bar_diameter: 16,
  stirrup_diameter: 9.5,
  stirrup_spacing: 0.15,
};

export const DEFAULT_BEAM_REINFORCEMENT: ReinforcementSpec = {
  bar_count: 3,
  bar_diameter: 16,
  stirrup_diameter: 9.5,
  stirrup_spacing: 0.15,
};

export const DEFAULT_COLUMN_LOADS: DesignLoads = { axial: 400, distributed: 0 };

export const DEFAULT_BEAM_LOADS: DesignLoads = { axial: 0, distributed: 25 };

export const BAR_DIAMETERS = [9.5, 12, 16, 20, 25, 32];

const CONCRETE_DENSITY = 24; // kN/m3

function barArea(diameterMm: number): number {
  return (Math.PI * diameterMm ** 2) / 4; // mm2
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function step(title: string, formula: string, substitution: string, result: string): DesignStep {
  return { title, formula, substitution, result };
}

export function columnDesign(
  column: ColumnElement,
  concrete: ConcreteSpec,
  reinforcement: ReinforcementSpec,
  loads: DesignLoads,
): DesignMemory {
  const { width: b, depth: h, height } = column.properties;
  const ag = b * h * 1e6; // mm2
  const as = reinforcement.bar_count * barArea(reinforcement.bar_diameter); // mm2
  const rho = as / ag;
  const selfWeight = b * h * height * CONCRETE_DENSITY; // kN
  const pu = loads.axial + 1.2 * selfWeight; // kN
  const phiPn =
    (0.65 * 0.8 * (0.85 * concrete.fc * (ag - as) + concrete.fy * as)) / 1000; // kN
  const ratio = phiPn > 0 ? pu / phiPn : Number.POSITIVE_INFINITY;
  const maxSpacing = Math.min(
    16 * (reinforcement.bar_diameter / 1000),
    48 * (reinforcement.stirrup_diameter / 1000),
    Math.min(b, h),
  );

  const warnings: string[] = [];
  if (rho < 0.01) warnings.push(`Cuantía ρ = ${round(rho * 100)}% menor al mínimo de 1% (ACI 10.6.1.1).`);
  if (rho > 0.04) warnings.push(`Cuantía ρ = ${round(rho * 100)}% mayor al máximo práctico de 4%.`);
  if (reinforcement.bar_count < 4) warnings.push('Una columna con estribos requiere al menos 4 barras longitudinales.');
  if (reinforcement.stirrup_spacing > maxSpacing) {
    warnings.push(`Separación de estribos ${round(reinforcement.stirrup_spacing, 3)} m mayor al máximo ${round(maxSpacing, 3)} m.`);
  }
  if (ratio > 1) warnings.push(`Demanda Pu supera la capacidad φPn (relación ${round(ratio)}).`);

  return {
    calculated_at: new Date().toISOString(),
    code: DESIGN_CODE,
    inputs: { geometry: { width: b, depth: h, height }, concrete, reinforcement, loads },
    status: warnings.length === 0 ? 'ok' : 'review',
    ratio: round(ratio, 3),
    summary: [
      { label: 'Sección', value: `${round(b * 100, 0)} × ${round(h * 100, 0)} cm` },
      { label: 'Acero longitudinal', value: `${reinforcement.bar_count} ⌀${reinforcement.bar_diameter} mm (${round(as, 0)} mm²)` },
      { label: 'Cuantía ρ', value: `${round(rho * 100)} %` },
      { label: 'Pu', value: `${round(pu)} kN` },
      { label: 'φPn,máx', value: `${round(phiPn)} kN` },
      { label: 'Demanda/Capacidad', value: `${round(ratio, 3)}` },
    ],
    steps: [
      step(
        'Área bruta de concreto',
        'Ag = b · h',
        `Ag = ${round(b, 3)} m · ${round(h, 3)} m`,
        `Ag = ${round(ag, 0)} mm²`,
      ),
      step(
        'Área de acero longitudinal',
        'As = n · π · db² / 4',
        `As = ${reinforcement.bar_count} · π · (${reinforcement.bar_diameter} mm)² / 4`,
        `As = ${round(as, 0)} mm²`,
      ),
      step('Cuantía de refuerzo', 'ρ = As / Ag', `ρ = ${round(as, 0)} / ${round(ag, 0)}`, `ρ = ${round(rho * 100)} % (límites 1 % – 4 %)`),
      step(
        'Peso propio mayorado',
        'Pu,pp = 1.2 · b · h · L · γc',
        `Pu,pp = 1.2 · ${round(b, 3)} · ${round(h, 3)} · ${round(height, 2)} · ${CONCRETE_DENSITY}`,
        `Pu,pp = ${round(1.2 * selfWeight)} kN`,
      ),
      step('Carga axial de diseño', 'Pu = Pu,externa + Pu,pp', `Pu = ${round(loads.axial)} + ${round(1.2 * selfWeight)}`, `Pu = ${round(pu)} kN`),
      step(
        'Capacidad axial (columna con estribos)',
        'φPn,máx = 0.65 · 0.80 · [0.85 · f\'c · (Ag − As) + fy · As]',
        `φPn,máx = 0.65 · 0.80 · [0.85 · ${concrete.fc} · (${round(ag, 0)} − ${round(as, 0)}) + ${concrete.fy} · ${round(as, 0)}]`,
        `φPn,máx = ${round(phiPn)} kN`,
      ),
      step('Verificación', 'Pu / φPn,máx ≤ 1.0', `${round(pu)} / ${round(phiPn)}`, `${round(ratio, 3)} → ${ratio <= 1 ? 'cumple' : 'no cumple'}`),
      step(
        'Separación máxima de estribos',
        's ≤ mín(16·db, 48·de, menor dimensión)',
        `s ≤ mín(${round(16 * (reinforcement.bar_diameter / 1000), 3)}, ${round(48 * (reinforcement.stirrup_diameter / 1000), 3)}, ${round(Math.min(b, h), 3)}) m`,
        `s,máx = ${round(maxSpacing, 3)} m (adoptada ${round(reinforcement.stirrup_spacing, 3)} m)`,
      ),
    ],
    warnings,
  };
}

export function beamDesign(
  beam: BeamElement,
  concrete: ConcreteSpec,
  reinforcement: ReinforcementSpec,
  loads: DesignLoads,
): DesignMemory {
  const { width: b, height: h } = beam.properties;
  const span = beam.properties.length;
  const bMm = b * 1000;
  const d =
    h * 1000 - concrete.cover * 1000 - reinforcement.stirrup_diameter - reinforcement.bar_diameter / 2; // mm
  const as = reinforcement.bar_count * barArea(reinforcement.bar_diameter); // mm2
  const selfWeight = b * h * CONCRETE_DENSITY; // kN/m
  const wu = loads.distributed + 1.2 * selfWeight; // kN/m
  const mu = (wu * span ** 2) / 8; // kN·m
  const vu = (wu * span) / 2; // kN
  const a = (as * concrete.fy) / (0.85 * concrete.fc * bMm); // mm
  const phiMn = (0.9 * as * concrete.fy * (d - a / 2)) / 1e6; // kN·m
  const asMin = Math.max((0.25 * Math.sqrt(concrete.fc)) / concrete.fy, 1.4 / concrete.fy) * bMm * d; // mm2
  const phiVc = (0.75 * 0.17 * Math.sqrt(concrete.fc) * bMm * d) / 1000; // kN
  const avArea = 2 * barArea(reinforcement.stirrup_diameter); // mm2 (estribo de dos ramas)
  const phiVs = (0.75 * avArea * concrete.fy * d) / (reinforcement.stirrup_spacing * 1000) / 1000; // kN
  const phiVn = phiVc + phiVs;
  const ratioM = phiMn > 0 ? mu / phiMn : Number.POSITIVE_INFINITY;
  const ratioV = phiVn > 0 ? vu / phiVn : Number.POSITIVE_INFINITY;
  const ratio = Math.max(ratioM, ratioV);

  const warnings: string[] = [];
  if (as < asMin) warnings.push(`As = ${round(as, 0)} mm² menor al mínimo ${round(asMin, 0)} mm² (ACI 9.6.1.2).`);
  if (ratioM > 1) warnings.push(`Momento último Mu supera φMn (relación ${round(ratioM)}).`);
  if (ratioV > 1) warnings.push(`Cortante último Vu supera φVn (relación ${round(ratioV)}).`);
  if (reinforcement.stirrup_spacing > d / 2000) {
    warnings.push(`Separación de estribos mayor a d/2 = ${round(d / 2000, 3)} m.`);
  }

  return {
    calculated_at: new Date().toISOString(),
    code: DESIGN_CODE,
    inputs: { geometry: { width: b, height: h, length: span }, concrete, reinforcement, loads },
    status: warnings.length === 0 ? 'ok' : 'review',
    ratio: round(ratio, 3),
    summary: [
      { label: 'Sección', value: `${round(b * 100, 0)} × ${round(h * 100, 0)} cm` },
      { label: 'Luz', value: `${round(span, 2)} m` },
      { label: 'Acero a flexión', value: `${reinforcement.bar_count} ⌀${reinforcement.bar_diameter} mm (${round(as, 0)} mm²)` },
      { label: 'Mu / φMn', value: `${round(mu)} / ${round(phiMn)} kN·m` },
      { label: 'Vu / φVn', value: `${round(vu)} / ${round(phiVn)} kN` },
      { label: 'Demanda/Capacidad', value: `${round(ratio, 3)}` },
    ],
    steps: [
      step(
        'Peralte efectivo',
        'd = h − recubrimiento − de − db/2',
        `d = ${round(h * 1000, 0)} − ${round(concrete.cover * 1000, 0)} − ${reinforcement.stirrup_diameter} − ${reinforcement.bar_diameter / 2}`,
        `d = ${round(d, 0)} mm`,
      ),
      step('Área de acero a flexión', 'As = n · π · db² / 4', `As = ${reinforcement.bar_count} · π · (${reinforcement.bar_diameter})² / 4`, `As = ${round(as, 0)} mm²`),
      step(
        'Carga última',
        'wu = w,externa + 1.2 · b · h · γc',
        `wu = ${round(loads.distributed)} + 1.2 · ${round(b, 3)} · ${round(h, 3)} · ${CONCRETE_DENSITY}`,
        `wu = ${round(wu)} kN/m`,
      ),
      step('Momento último (viga simplemente apoyada)', 'Mu = wu · L² / 8', `Mu = ${round(wu)} · ${round(span, 2)}² / 8`, `Mu = ${round(mu)} kN·m`),
      step('Profundidad del bloque de compresión', "a = As · fy / (0.85 · f'c · b)", `a = ${round(as, 0)} · ${concrete.fy} / (0.85 · ${concrete.fc} · ${round(bMm, 0)})`, `a = ${round(a)} mm`),
      step('Momento resistente', 'φMn = 0.9 · As · fy · (d − a/2)', `φMn = 0.9 · ${round(as, 0)} · ${concrete.fy} · (${round(d, 0)} − ${round(a / 2)})`, `φMn = ${round(phiMn)} kN·m`),
      step('Acero mínimo', "As,mín = máx(0.25·√f'c/fy, 1.4/fy) · b · d", `As,mín = máx(${round((0.25 * Math.sqrt(concrete.fc)) / concrete.fy, 5)}, ${round(1.4 / concrete.fy, 5)}) · ${round(bMm, 0)} · ${round(d, 0)}`, `As,mín = ${round(asMin, 0)} mm²`),
      step('Cortante último', 'Vu = wu · L / 2', `Vu = ${round(wu)} · ${round(span, 2)} / 2`, `Vu = ${round(vu)} kN`),
      step('Resistencia del concreto a cortante', "φVc = 0.75 · 0.17 · √f'c · b · d", `φVc = 0.75 · 0.17 · √${concrete.fc} · ${round(bMm, 0)} · ${round(d, 0)}`, `φVc = ${round(phiVc)} kN`),
      step('Aporte de estribos', 'φVs = 0.75 · Av · fy · d / s', `φVs = 0.75 · ${round(avArea, 0)} · ${concrete.fy} · ${round(d, 0)} / ${round(reinforcement.stirrup_spacing * 1000, 0)}`, `φVs = ${round(phiVs)} kN`),
      step('Verificación', 'máx(Mu/φMn, Vu/φVn) ≤ 1.0', `máx(${round(ratioM, 3)}, ${round(ratioV, 3)})`, `${round(ratio, 3)} → ${ratio <= 1 ? 'cumple' : 'no cumple'}`),
    ],
    warnings,
  };
}

export function currentInputs(
  element: ColumnElement | BeamElement,
  concrete: ConcreteSpec,
  reinforcement: ReinforcementSpec,
  loads: DesignLoads,
): DesignInputs {
  const geometry: Record<string, number> =
    element.element_type === 'column'
      ? { width: element.properties.width, depth: element.properties.depth, height: element.properties.height }
      : { width: element.properties.width, height: element.properties.height, length: element.properties.length };
  return { geometry, concrete, reinforcement, loads };
}

function sameNumbers(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (Math.abs((a[key] ?? 0) - (b[key] ?? 0)) > 1e-9) return false;
  }
  return true;
}

export function isMemoryStale(memory: DesignMemory, inputs: DesignInputs): boolean {
  const stored = memory.inputs;
  if (!stored) return true;
  return !(
    sameNumbers(stored.geometry, inputs.geometry) &&
    sameNumbers({ ...stored.concrete }, { ...inputs.concrete }) &&
    sameNumbers({ ...stored.reinforcement }, { ...inputs.reinforcement }) &&
    sameNumbers({ ...stored.loads }, { ...inputs.loads })
  );
}

export function memoryToMarkdown(
  memory: DesignMemory,
  context: { projectName: string; elementLabel: string },
): string {
  const { concrete, reinforcement, loads } = memory.inputs;
  const lines: string[] = [];
  lines.push(`# Memoria de cálculo — ${context.elementLabel}`);
  lines.push('');
  lines.push(`Proyecto: ${context.projectName}`);
  lines.push(`Norma de referencia: ${memory.code}`);
  lines.push(`Fecha de cálculo: ${new Date(memory.calculated_at).toLocaleString('es-CO')}`);
  lines.push(`Estado: ${memory.status === 'ok' ? 'Cumple las verificaciones' : 'Requiere revisión'}`);
  lines.push('');
  lines.push('## Datos de entrada');
  lines.push('');
  lines.push(`- Concreto f'c = ${concrete.fc} MPa, acero fy = ${concrete.fy} MPa, recubrimiento = ${concrete.cover * 100} cm`);
  lines.push(`- Refuerzo longitudinal: ${reinforcement.bar_count} ⌀${reinforcement.bar_diameter} mm`);
  lines.push(`- Estribos: ⌀${reinforcement.stirrup_diameter} mm @ ${reinforcement.stirrup_spacing} m`);
  lines.push(`- Carga axial externa mayorada: ${loads.axial} kN · Carga distribuida externa mayorada: ${loads.distributed} kN/m`);
  lines.push('');
  lines.push('Las cargas externas se ingresan ya mayoradas; el cálculo sólo añade 1.2 · peso propio.');
  lines.push('');
  lines.push('## Resumen');
  lines.push('');
  for (const item of memory.summary) lines.push(`- ${item.label}: ${item.value}`);
  lines.push('');
  lines.push('## Desarrollo');
  lines.push('');
  memory.steps.forEach((entry, index) => {
    lines.push(`### ${index + 1}. ${entry.title}`);
    lines.push('');
    lines.push(`${entry.formula}`);
    lines.push('');
    lines.push(`${entry.substitution}`);
    lines.push('');
    lines.push(`**${entry.result}**`);
    lines.push('');
  });
  if (memory.warnings.length > 0) {
    lines.push('## Observaciones');
    lines.push('');
    for (const warning of memory.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  return lines.join('\n');
}
