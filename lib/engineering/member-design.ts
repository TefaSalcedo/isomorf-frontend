import { localeTags, translate, type Locale } from '@/lib/i18n/messages';
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
  locale: Locale = 'en',
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
  if (rho < 0.01) warnings.push(translate(locale, 'design.warnings.rhoLow', { ratio: round(rho * 100) }));
  if (rho > 0.04) warnings.push(translate(locale, 'design.warnings.rhoHigh', { ratio: round(rho * 100) }));
  if (reinforcement.bar_count < 4) warnings.push(translate(locale, 'design.warnings.minBars'));
  if (reinforcement.stirrup_spacing > maxSpacing) {
    warnings.push(translate(locale, 'design.warnings.stirrupSpacing', { spacing: round(reinforcement.stirrup_spacing, 3), max: round(maxSpacing, 3) }));
  }
  if (ratio > 1) warnings.push(translate(locale, 'design.warnings.axialOver', { ratio: round(ratio) }));

  return {
    calculated_at: new Date().toISOString(),
    code: translate(locale, 'design.code'),
    inputs: { geometry: { width: b, depth: h, height }, concrete, reinforcement, loads },
    status: warnings.length === 0 ? 'ok' : 'review',
    ratio: round(ratio, 3),
    summary: [
      { label: translate(locale, 'design.summary.section'), value: `${round(b * 100, 0)} × ${round(h * 100, 0)} cm` },
      { label: translate(locale, 'design.summary.longitudinalSteel'), value: `${reinforcement.bar_count} ⌀${reinforcement.bar_diameter} mm (${round(as, 0)} mm²)` },
      { label: translate(locale, 'design.summary.rho'), value: `${round(rho * 100)} %` },
      { label: translate(locale, 'design.summary.pu'), value: `${round(pu)} kN` },
      { label: translate(locale, 'design.summary.phiPn'), value: `${round(phiPn)} kN` },
      { label: translate(locale, 'design.summary.demandCapacity'), value: `${round(ratio, 3)}` },
    ],
    steps: [
      step(
        translate(locale, 'design.steps.grossArea'),
        'Ag = b · h',
        `Ag = ${round(b, 3)} m · ${round(h, 3)} m`,
        `Ag = ${round(ag, 0)} mm²`,
      ),
      step(
        translate(locale, 'design.steps.steelArea'),
        'As = n · π · db² / 4',
        `As = ${reinforcement.bar_count} · π · (${reinforcement.bar_diameter} mm)² / 4`,
        `As = ${round(as, 0)} mm²`,
      ),
      step(
        translate(locale, 'design.steps.rho'),
        'ρ = As / Ag',
        `ρ = ${round(as, 0)} / ${round(ag, 0)}`,
        `ρ = ${round(rho * 100)} % (${translate(locale, 'design.steps.rhoLimits')})`,
      ),
      step(
        translate(locale, 'design.steps.factoredSelfWeight'),
        'Pu,sw = 1.2 · b · h · L · γc',
        `Pu,sw = 1.2 · ${round(b, 3)} · ${round(h, 3)} · ${round(height, 2)} · ${CONCRETE_DENSITY}`,
        `Pu,sw = ${round(1.2 * selfWeight)} kN`,
      ),
      step(
        translate(locale, 'design.steps.axialDesign'),
        'Pu = Pu,ext + Pu,sw',
        `Pu = ${round(loads.axial)} + ${round(1.2 * selfWeight)}`,
        `Pu = ${round(pu)} kN`,
      ),
      step(
        translate(locale, 'design.steps.axialCapacity'),
        'φPn,max = 0.65 · 0.80 · [0.85 · f\'c · (Ag − As) + fy · As]',
        `φPn,max = 0.65 · 0.80 · [0.85 · ${concrete.fc} · (${round(ag, 0)} − ${round(as, 0)}) + ${concrete.fy} · ${round(as, 0)}]`,
        `φPn,max = ${round(phiPn)} kN`,
      ),
      step(
        translate(locale, 'design.steps.check'),
        'Pu / φPn,max ≤ 1.0',
        `${round(pu)} / ${round(phiPn)}`,
        `${round(ratio, 3)} → ${translate(locale, ratio <= 1 ? 'design.steps.passes' : 'design.steps.fails')}`,
      ),
      step(
        translate(locale, 'design.steps.maxStirrupSpacing'),
        's ≤ min(16·db, 48·de, smallest dimension)',
        `s ≤ min(${round(16 * (reinforcement.bar_diameter / 1000), 3)}, ${round(48 * (reinforcement.stirrup_diameter / 1000), 3)}, ${round(Math.min(b, h), 3)}) m`,
        `s,max = ${round(maxSpacing, 3)} m (${translate(locale, 'design.steps.adopted', { spacing: round(reinforcement.stirrup_spacing, 3) })})`,
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
  locale: Locale = 'en',
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
  if (as < asMin) warnings.push(translate(locale, 'design.warnings.asMin', { as: round(as, 0), asMin: round(asMin, 0) }));
  if (ratioM > 1) warnings.push(translate(locale, 'design.warnings.momentOver', { ratio: round(ratioM) }));
  if (ratioV > 1) warnings.push(translate(locale, 'design.warnings.shearOver', { ratio: round(ratioV) }));
  if (reinforcement.stirrup_spacing > d / 2000) {
    warnings.push(translate(locale, 'design.warnings.stirrupSpacingD2', { max: round(d / 2000, 3) }));
  }

  return {
    calculated_at: new Date().toISOString(),
    code: translate(locale, 'design.code'),
    inputs: { geometry: { width: b, height: h, length: span }, concrete, reinforcement, loads },
    status: warnings.length === 0 ? 'ok' : 'review',
    ratio: round(ratio, 3),
    summary: [
      { label: translate(locale, 'design.summary.section'), value: `${round(b * 100, 0)} × ${round(h * 100, 0)} cm` },
      { label: translate(locale, 'design.summary.span'), value: `${round(span, 2)} m` },
      { label: translate(locale, 'design.summary.flexureSteel'), value: `${reinforcement.bar_count} ⌀${reinforcement.bar_diameter} mm (${round(as, 0)} mm²)` },
      { label: translate(locale, 'design.summary.muPhiMn'), value: `${round(mu)} / ${round(phiMn)} kN·m` },
      { label: translate(locale, 'design.summary.vuPhiVn'), value: `${round(vu)} / ${round(phiVn)} kN` },
      { label: translate(locale, 'design.summary.demandCapacity'), value: `${round(ratio, 3)}` },
    ],
    steps: [
      step(
        translate(locale, 'design.steps.effectiveDepth'),
        'd = h − recubrimiento − de − db/2',
        `d = ${round(h * 1000, 0)} − ${round(concrete.cover * 1000, 0)} − ${reinforcement.stirrup_diameter} − ${reinforcement.bar_diameter / 2}`,
        `d = ${round(d, 0)} mm`,
      ),
      step(
        translate(locale, 'design.steps.flexureSteelArea'),
        'As = n · π · db² / 4',
        `As = ${reinforcement.bar_count} · π · (${reinforcement.bar_diameter})² / 4`,
        `As = ${round(as, 0)} mm²`,
      ),
      step(
        translate(locale, 'design.steps.ultimateLoad'),
        'wu = w,ext + 1.2 · b · h · γc',
        `wu = ${round(loads.distributed)} + 1.2 · ${round(b, 3)} · ${round(h, 3)} · ${CONCRETE_DENSITY}`,
        `wu = ${round(wu)} kN/m`,
      ),
      step(
        translate(locale, 'design.steps.ultimateMoment'),
        'Mu = wu · L² / 8',
        `Mu = ${round(wu)} · ${round(span, 2)}² / 8`,
        `Mu = ${round(mu)} kN·m`,
      ),
      step(
        translate(locale, 'design.steps.compressionBlock'),
        "a = As · fy / (0.85 · f'c · b)",
        `a = ${round(as, 0)} · ${concrete.fy} / (0.85 · ${concrete.fc} · ${round(bMm, 0)})`,
        `a = ${round(a)} mm`,
      ),
      step(
        translate(locale, 'design.steps.resistantMoment'),
        'φMn = 0.9 · As · fy · (d − a/2)',
        `φMn = 0.9 · ${round(as, 0)} · ${concrete.fy} · (${round(d, 0)} − ${round(a / 2)})`,
        `φMn = ${round(phiMn)} kN·m`,
      ),
      step(
        translate(locale, 'design.steps.minSteel'),
        "As,min = max(0.25·√f'c/fy, 1.4/fy) · b · d",
        `As,min = max(${round((0.25 * Math.sqrt(concrete.fc)) / concrete.fy, 5)}, ${round(1.4 / concrete.fy, 5)}) · ${round(bMm, 0)} · ${round(d, 0)}`,
        `As,min = ${round(asMin, 0)} mm²`,
      ),
      step(
        translate(locale, 'design.steps.ultimateShear'),
        'Vu = wu · L / 2',
        `Vu = ${round(wu)} · ${round(span, 2)} / 2`,
        `Vu = ${round(vu)} kN`,
      ),
      step(
        translate(locale, 'design.steps.concreteShear'),
        "φVc = 0.75 · 0.17 · √f'c · b · d",
        `φVc = 0.75 · 0.17 · √${concrete.fc} · ${round(bMm, 0)} · ${round(d, 0)}`,
        `φVc = ${round(phiVc)} kN`,
      ),
      step(
        translate(locale, 'design.steps.stirrupContribution'),
        'φVs = 0.75 · Av · fy · d / s',
        `φVs = 0.75 · ${round(avArea, 0)} · ${concrete.fy} · ${round(d, 0)} / ${round(reinforcement.stirrup_spacing * 1000, 0)}`,
        `φVs = ${round(phiVs)} kN`,
      ),
      step(
        translate(locale, 'design.steps.check'),
        'max(Mu/φMn, Vu/φVn) ≤ 1.0',
        `max(${round(ratioM, 3)}, ${round(ratioV, 3)})`,
        `${round(ratio, 3)} → ${translate(locale, ratio <= 1 ? 'design.steps.passes' : 'design.steps.fails')}`,
      ),
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

export function isMemoryStale(memory: DesignMemory, inputs: DesignInputs): boolean {
  return JSON.stringify(memory.inputs) !== JSON.stringify(inputs);
}

export function memoryToMarkdown(
  memory: DesignMemory,
  context: { projectName: string; elementLabel: string },
  locale: Locale = 'en',
): string {
  const { concrete, reinforcement, loads } = memory.inputs;
  const lines: string[] = [];
  lines.push(`# ${translate(locale, 'design.markdown.title', { element: context.elementLabel })}`);
  lines.push('');
  lines.push(translate(locale, 'design.markdown.project', { name: context.projectName }));
  lines.push(translate(locale, 'design.markdown.code', { code: memory.code }));
  lines.push(translate(locale, 'design.markdown.date', { date: new Date(memory.calculated_at).toLocaleString(localeTags[locale]) }));
  lines.push(translate(locale, 'design.markdown.status', { status: translate(locale, memory.status === 'ok' ? 'design.markdown.statusOk' : 'design.markdown.statusReview') }));
  lines.push('');
  lines.push(`## ${translate(locale, 'design.markdown.inputs')}`);
  lines.push('');
  lines.push(translate(locale, 'design.markdown.concreteLine', { fc: concrete.fc, fy: concrete.fy, cover: concrete.cover * 100 }));
  lines.push(translate(locale, 'design.markdown.rebarLine', { count: reinforcement.bar_count, diameter: reinforcement.bar_diameter }));
  lines.push(translate(locale, 'design.markdown.stirrupLine', { diameter: reinforcement.stirrup_diameter, spacing: reinforcement.stirrup_spacing }));
  lines.push(translate(locale, 'design.markdown.loadsLine', { axial: loads.axial, distributed: loads.distributed }));
  lines.push('');
  lines.push(translate(locale, 'design.markdown.loadsNote'));
  lines.push('');
  lines.push(`## ${translate(locale, 'design.markdown.summary')}`);
  lines.push('');
  for (const item of memory.summary) lines.push(`- ${item.label}: ${item.value}`);
  lines.push('');
  lines.push(`## ${translate(locale, 'design.markdown.development')}`);
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
    lines.push(`## ${translate(locale, 'design.markdown.notes')}`);
    lines.push('');
    for (const warning of memory.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  return lines.join('\n');
}
