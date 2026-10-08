'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CatalogData } from '@/lib/editor/catalog';
import {
  currentMaterialRef,
  currentSectionRef,
  materialRefChanges,
  sectionRefChanges,
} from '@/lib/editor/catalog';
import { drawModeOf, rectSize } from '@/lib/editor/elements';
import { cmToMeters, metersToCm } from '@/lib/editor/geometry';
import type { LayeredProperties, PlanLayer, ProjectElement } from '@/types/project';

type UpdateFn = (id: string, changes: Partial<ProjectElement>) => void;
type UpdateManyFn = (ids: string[], changes: Partial<ProjectElement>) => void;

export function PropertiesPanel({
  elements,
  layers,
  catalog,
  onUpdate,
  onUpdateMany,
  readOnly,
}: {
  elements: ProjectElement[];
  layers: PlanLayer[];
  catalog: CatalogData;
  onUpdate: UpdateFn;
  onUpdateMany: UpdateManyFn;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.panels.properties');
  const tt = useTranslations('editor.tools');

  if (elements.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <p className="text-sm text-slate-400">{t('empty')}</p>
      </div>
    );
  }

  if (elements.length > 1) {
    return (
      <BulkInspector
        elements={elements}
        layers={layers}
        catalog={catalog}
        onUpdateMany={onUpdateMany}
        readOnly={readOnly}
        title={t('title')}
        multiLabel={t('multi', { count: elements.length })}
      />
    );
  }

  return <SingleInspector element={elements[0]} layers={layers} catalog={catalog} onUpdate={onUpdate} readOnly={readOnly} />;
}

function SingleInspector({
  element: el,
  layers,
  catalog,
  onUpdate,
  readOnly,
}: {
  element: ProjectElement;
  layers: PlanLayer[];
  catalog: CatalogData;
  onUpdate: UpdateFn;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.panels.properties');
  const tt = useTranslations('editor.tools');
  const mode = drawModeOf(el.element_type);
  const p = el.properties as Record<string, unknown> & LayeredProperties;

  const setProp = (patch: Record<string, unknown>) =>
    onUpdate(el.id, { properties: patch } as Partial<ProjectElement>);

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('title')}</p>
      <p className="mt-1 text-sm font-medium capitalize text-slate-100">{tt(el.element_type)}</p>
      <fieldset disabled={readOnly} className="mt-4 min-w-0 space-y-4 border-0 p-0 disabled:opacity-60">
        <Section title={t('sections.identity')} defaultOpen>
          <TextInput label={t('tag')} value={(p.tag as string) ?? ''} onChange={(v) => setProp({ tag: v })} />
        </Section>

        <Section title={t('sections.position')} defaultOpen>
          {mode === 'point' ? (
            <>
              <NumberInput label="X (m)" value={cmToMeters(el.x1)} onChange={(v) => onUpdate(el.id, { x1: metersToCm(v), x2: metersToCm(v) + 1 })} step={0.1} />
              <NumberInput label="Y (m)" value={cmToMeters(el.y1)} onChange={(v) => onUpdate(el.id, { y1: metersToCm(v) })} step={0.1} />
            </>
          ) : mode === 'center' ? (
            <>
              <NumberInput label="X (m)" value={cmToMeters(el.x1)} onChange={(v) => onUpdate(el.id, { x1: metersToCm(v) })} step={0.1} />
              <NumberInput label="Y (m)" value={cmToMeters(el.y1)} onChange={(v) => onUpdate(el.id, { y1: metersToCm(v) })} step={0.1} />
            </>
          ) : mode === 'rect' ? (
            <>
              <NumberInput label="X1 (m)" value={cmToMeters(Math.min(el.x1, el.x2))} onChange={(v) => onUpdate(el.id, { x1: metersToCm(v) })} step={0.1} />
              <NumberInput label="Y1 (m)" value={cmToMeters(Math.min(el.y1, el.y2))} onChange={(v) => onUpdate(el.id, { y1: metersToCm(v) })} step={0.1} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X1 (m)" value={cmToMeters(el.x1)} onChange={(v) => onUpdate(el.id, { x1: metersToCm(v) })} step={0.1} />
                <NumberInput label="Y1 (m)" value={cmToMeters(el.y1)} onChange={(v) => onUpdate(el.id, { y1: metersToCm(v) })} step={0.1} />
                <NumberInput label="X2 (m)" value={cmToMeters(el.x2)} onChange={(v) => onUpdate(el.id, { x2: metersToCm(v) })} step={0.1} />
                <NumberInput label="Y2 (m)" value={cmToMeters(el.y2)} onChange={(v) => onUpdate(el.id, { y2: metersToCm(v) })} step={0.1} />
              </div>
              <NumberInput
                label={t('rotation')}
                value={(el.rotation * 180) / Math.PI}
                onChange={(v) => onUpdate(el.id, { rotation: (v * Math.PI) / 180 })}
                step={1}
              />
              <NumberInput
                label={t('length')}
                value={cmToMeters(el.length)}
                onChange={(v) => onUpdate(el.id, { length: metersToCm(v) })}
                step={0.1}
              />
            </>
          )}
        </Section>

        <Section title={t('sections.geometry')} defaultOpen>
          <GeometryFields element={el} setProp={setProp} onUpdate={onUpdate} />
        </Section>

        <Section title={t('sections.material')}>
          <CatalogSelect
            label={t('material')}
            value={currentMaterialRef(el)}
            options={[
              ...catalog.presets.materials.map((preset) => ({ value: `preset:${preset.key}`, label: preset.name })),
              ...catalog.materials.map((material) => ({ value: material.id, label: material.name })),
            ]}
            onChange={(ref) => {
              const changes = materialRefChanges(ref);
              onUpdate(el.id, { material_id: changes.material_id, properties: { material_preset: changes.material_preset } } as Partial<ProjectElement>);
            }}
          />
          <CatalogSelect
            label={t('section')}
            value={currentSectionRef(el)}
            options={[
              ...catalog.presets.sections.map((preset) => ({ value: `preset:${preset.key}`, label: preset.name })),
              ...catalog.sections.map((section) => ({ value: section.id, label: section.name })),
            ]}
            onChange={(ref) => {
              const changes = sectionRefChanges(ref);
              onUpdate(el.id, { section_id: changes.section_id, properties: { section_preset: changes.section_preset } } as Partial<ProjectElement>);
            }}
          />
        </Section>

        <Section title={t('sections.layer')}>
          <SelectInput
            label={t('layer')}
            value={p.layer_id ?? ''}
            options={layers.map((layer) => ({ value: layer.id, label: layer.name }))}
            onChange={(v) => setProp({ layer_id: v || null })}
          />
        </Section>
      </fieldset>
    </div>
  );
}

function GeometryFields({
  element: el,
  setProp,
  onUpdate,
}: {
  element: ProjectElement;
  setProp: (patch: Record<string, unknown>) => void;
  onUpdate: UpdateFn;
}) {
  const t = useTranslations('editor.panels.properties');
  const p = el.properties as Record<string, unknown>;
  const num = (key: string, fallback = 0) => (typeof p[key] === 'number' ? (p[key] as number) : fallback);
  const size = drawModeOf(el.element_type) === 'rect' ? rectSize(el) : null;
  const setRectProp = (key: 'width' | 'depth', meters: number) => setProp({ [key]: meters });

  switch (el.element_type) {
    case 'wall':
      return (
        <>
          <NumberInput label={t('height')} value={num('height', 2.5)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('thickness')} value={num('thickness', 0.15)} onChange={(v) => setProp({ thickness: v })} />
          <NumberInput label={t('baseElevation')} value={num('base_elevation')} onChange={(v) => setProp({ base_elevation: v })} />
          <SelectInput
            label={t('wallType')}
            value={(p.wall_type as string) ?? 'bearing'}
            options={['bearing', 'shear', 'partition', 'masonry'].map((v) => ({ value: v, label: t(`wallTypes.${v}`) }))}
            onChange={(v) => setProp({ wall_type: v })}
          />
          <SelectInput
            label={t('joinMode')}
            value={(p.join_mode as string) ?? 'perpendicular'}
            options={[
              { value: 'perpendicular', label: t('joinPerpendicular') },
              { value: '45', label: t('join45') },
              { value: 'free', label: t('joinFree') },
            ]}
            onChange={(v) => setProp({ join_mode: v })}
          />
          {p.join_mode === 'free' && (
            <NumberInput label={t('joinAngle')} value={num('join_angle', 90)} onChange={(v) => setProp({ join_angle: v })} />
          )}
        </>
      );
    case 'column':
      return (
        <>
          <SelectInput
            label={t('shape')}
            value={(p.shape as string) ?? 'rectangular'}
            options={[
              { value: 'rectangular', label: t('shapeRect') },
              { value: 'circular', label: t('shapeCircular') },
            ]}
            onChange={(v) => setProp({ shape: v })}
          />
          {p.shape === 'circular' ? (
            <NumberInput label={t('diameter')} value={num('diameter', 0.3)} onChange={(v) => setProp({ diameter: v })} />
          ) : (
            <>
              <NumberInput label={t('width')} value={num('width', 0.3)} onChange={(v) => setProp({ width: v })} />
              <NumberInput label={t('depth')} value={num('depth', 0.3)} onChange={(v) => setProp({ depth: v })} />
            </>
          )}
          <NumberInput label={t('height')} value={num('height', 2.5)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('baseElevation')} value={num('base_elevation')} onChange={(v) => setProp({ base_elevation: v })} />
        </>
      );
    case 'beam':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 0.2)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('height')} value={num('height', 0.3)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('topElevation')} value={num('top_elevation', 2.5)} onChange={(v) => setProp({ top_elevation: v })} />
        </>
      );
    case 'joist':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 0.15)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('height')} value={num('height', 0.3)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('spacing')} value={num('spacing', 0.45)} onChange={(v) => setProp({ spacing: v })} />
          <NumberInput label={t('topElevation')} value={num('top_elevation', 2.5)} onChange={(v) => setProp({ top_elevation: v })} />
        </>
      );
    case 'grade_beam':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 0.3)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('height')} value={num('height', 0.4)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('topElevation')} value={num('top_elevation')} onChange={(v) => setProp({ top_elevation: v })} />
        </>
      );
    case 'brace':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 0.2)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('depth')} value={num('depth', 0.2)} onChange={(v) => setProp({ depth: v })} />
          <NumberInput label={t('bottomZ')} value={num('bottom_z')} onChange={(v) => setProp({ bottom_z: v })} />
          <NumberInput label={t('topZ')} value={num('top_z', 2.5)} onChange={(v) => setProp({ top_z: v })} />
        </>
      );
    case 'pile':
      return (
        <>
          <NumberInput label={t('diameter')} value={num('diameter', 0.4)} onChange={(v) => setProp({ diameter: v })} />
          <NumberInput label={t('pileLength')} value={num('pile_length', 12)} onChange={(v) => setProp({ pile_length: v })} />
          <NumberInput label={t('topElevation')} value={num('top_elevation')} onChange={(v) => setProp({ top_elevation: v })} />
          <NumberInput label={t('capacity')} value={num('capacity_kn')} onChange={(v) => setProp({ capacity_kn: v })} step={10} />
        </>
      );
    case 'slab':
      return (
        <>
          <NumberInput label={t('thickness')} value={num('thickness', 0.15)} onChange={(v) => setProp({ thickness: v })} />
          <SelectInput
            label={t('slabType')}
            value={(p.slab_type as string) ?? 'solid'}
            options={['solid', 'waffle', 'ribbed', 'mat'].map((v) => ({ value: v, label: t(`slabTypes.${v}`) }))}
            onChange={(v) => setProp({ slab_type: v })}
          />
          <SelectInput
            label={t('diaphragm')}
            value={(p.diaphragm as string) ?? 'none'}
            options={['none', 'rigid', 'semirigid'].map((v) => ({ value: v, label: t(`diaphragms.${v}`) }))}
            onChange={(v) => setProp({ diaphragm: v })}
          />
          <NumberInput label={t('topElevation')} value={num('top_elevation', 2.5)} onChange={(v) => setProp({ top_elevation: v })} />
        </>
      );
    case 'footing':
      return (
        <>
          <NumberInput label={t('depth')} value={num('depth', 0.4)} onChange={(v) => setProp({ depth: v })} />
          <NumberInput label={t('topElevation')} value={num('top_elevation')} onChange={(v) => setProp({ top_elevation: v })} />
          <NumberInput label={t('soilCapacity')} value={num('soil_capacity_kpa')} onChange={(v) => setProp({ soil_capacity_kpa: v })} step={10} />
        </>
      );
    case 'stair':
      return (
        <>
          <NumberInput label={t('stepCount')} value={num('step_count', 14)} onChange={(v) => setProp({ step_count: Math.max(1, Math.round(v)) })} step={1} />
          <NumberInput label={t('tread')} value={num('tread', 0.28)} onChange={(v) => setProp({ tread: v })} />
          <NumberInput label={t('riser')} value={num('riser', 0.175)} onChange={(v) => setProp({ riser: v })} />
          <SelectInput
            label={t('runAxis')}
            value={(p.run_axis as string) ?? 'x'}
            options={[
              { value: 'x', label: t('runAxisX') },
              { value: 'y', label: t('runAxisY') },
            ]}
            onChange={(v) => setProp({ run_axis: v })}
          />
          <NumberInput label={t('baseElevation')} value={num('base_elevation')} onChange={(v) => setProp({ base_elevation: v })} />
        </>
      );
    case 'ramp':
      return (
        <>
          <NumberInput label={t('slope')} value={num('slope_percent', 12.5)} onChange={(v) => setProp({ slope_percent: v })} step={0.5} />
          <NumberInput label={t('thickness')} value={num('thickness', 0.15)} onChange={(v) => setProp({ thickness: v })} />
          <NumberInput label={t('baseElevation')} value={num('base_elevation')} onChange={(v) => setProp({ base_elevation: v })} />
        </>
      );
    case 'door':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 0.9)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('height')} value={num('height', 2.1)} onChange={(v) => setProp({ height: v })} />
          <SelectInput
            label={t('swing')}
            value={(p.swing as string) ?? 'left'}
            options={[
              { value: 'left', label: t('swingLeft') },
              { value: 'right', label: t('swingRight') },
            ]}
            onChange={(v) => setProp({ swing: v })}
          />
        </>
      );
    case 'window':
      return (
        <>
          <NumberInput label={t('width')} value={num('width', 1)} onChange={(v) => setProp({ width: v })} />
          <NumberInput label={t('height')} value={num('height', 1.2)} onChange={(v) => setProp({ height: v })} />
          <NumberInput label={t('sillHeight')} value={num('sill_height', 0.9)} onChange={(v) => setProp({ sill_height: v })} />
        </>
      );
    case 'opening':
      return <p className="text-xs text-slate-500">{t('openingHint')}</p>;
    case 'circle':
      return (
        <NumberInput
          label={t('radius')}
          value={cmToMeters(num('radius', 50))}
          onChange={(v) => onUpdate(el.id, { properties: { radius: metersToCm(v) } } as Partial<ProjectElement>)}
          step={0.05}
        />
      );
    case 'hatch':
      return (
        <>
          <SelectInput
            label={t('hatchPattern')}
            value={(p.pattern as string) ?? 'ansi31'}
            options={['ansi31', 'cross', 'grid'].map((v) => ({ value: v, label: t(`hatchPatterns.${v}`) }))}
            onChange={(v) => setProp({ pattern: v })}
          />
          <NumberInput label={t('spacing')} value={cmToMeters(num('spacing', 35))} onChange={(v) => setProp({ spacing: metersToCm(v) })} step={0.05} />
          <NumberInput label={t('hatchAngle')} value={num('angle', 45)} onChange={(v) => setProp({ angle: v })} step={5} />
        </>
      );
    case 'polyline':
      return (
        <>
          <p className="text-xs text-slate-500">{t('vertexCount', { count: ((p.points as unknown[] | undefined) ?? []).length })}</p>
          <SelectInput
            label={t('closed')}
            value={p.closed ? 'yes' : 'no'}
            options={[
              { value: 'yes', label: t('yes') },
              { value: 'no', label: t('no') },
            ]}
            onChange={(v) => setProp({ closed: v === 'yes' })}
          />
        </>
      );
    default:
      return null;
  }
}

function BulkInspector({
  elements,
  layers,
  catalog,
  onUpdateMany,
  readOnly,
  title,
  multiLabel,
}: {
  elements: ProjectElement[];
  layers: PlanLayer[];
  catalog: CatalogData;
  onUpdateMany: UpdateManyFn;
  readOnly?: boolean;
  title: string;
  multiLabel: string;
}) {
  const t = useTranslations('editor.panels.properties');
  const ids = elements.map((el) => el.id);
  const sameType = elements.every((el) => el.element_type === elements[0].element_type);
  const materialRefs = new Set(elements.map(currentMaterialRef));
  const sectionRefs = new Set(elements.map(currentSectionRef));
  const layerRefs = new Set(elements.map((el) => (el.properties as LayeredProperties).layer_id ?? ''));

  const applyMaterial = (ref: string) => {
    const changes = materialRefChanges(ref);
    onUpdateMany(ids, { material_id: changes.material_id, properties: { material_preset: changes.material_preset } } as Partial<ProjectElement>);
  };
  const applySection = (ref: string) => {
    const changes = sectionRefChanges(ref);
    onUpdateMany(ids, { section_id: changes.section_id, properties: { section_preset: changes.section_preset } } as Partial<ProjectElement>);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-300">{multiLabel}</p>
      <fieldset disabled={readOnly} className="mt-4 min-w-0 space-y-4 border-0 p-0 disabled:opacity-60">
        <Section title={t('sections.material')} defaultOpen>
          <CatalogSelect
            label={t('material')}
            value={materialRefs.size === 1 ? [...materialRefs][0] : ''}
            mixed={materialRefs.size > 1}
            options={[
              ...catalog.presets.materials.map((preset) => ({ value: `preset:${preset.key}`, label: preset.name })),
              ...catalog.materials.map((material) => ({ value: material.id, label: material.name })),
            ]}
            onChange={applyMaterial}
          />
          <CatalogSelect
            label={t('section')}
            value={sectionRefs.size === 1 ? [...sectionRefs][0] : ''}
            mixed={sectionRefs.size > 1}
            options={[
              ...catalog.presets.sections.map((preset) => ({ value: `preset:${preset.key}`, label: preset.name })),
              ...catalog.sections.map((section) => ({ value: section.id, label: section.name })),
            ]}
            onChange={applySection}
          />
        </Section>
        <Section title={t('sections.layer')} defaultOpen>
          <SelectInput
            label={t('layer')}
            value={layerRefs.size === 1 ? [...layerRefs][0] : ''}
            options={layers.map((layer) => ({ value: layer.id, label: layer.name }))}
            onChange={(v) => onUpdateMany(ids, { properties: { layer_id: v || null } } as Partial<ProjectElement>)}
          />
        </Section>
        {sameType && (
          <BulkGeometry elements={elements} onUpdateMany={onUpdateMany} />
        )}
        {!sameType && (
          <p className="text-xs text-slate-500">{t('bulkTypeHint')}</p>
        )}
      </fieldset>
    </div>
  );
}

/** Shared dimension editing when every selected element has the same type. */
function BulkGeometry({ elements, onUpdateMany }: { elements: ProjectElement[]; onUpdateMany: UpdateManyFn }) {
  const t = useTranslations('editor.panels.properties');
  const ids = elements.map((el) => el.id);
  const keys = SHARED_KEYS[elements[0].element_type] ?? [];
  if (keys.length === 0) return null;
  return (
    <Section title={t('sections.geometry')} defaultOpen>
      {keys.map((key) => {
        const values = new Set(elements.map((el) => (el.properties as Record<string, unknown>)[key] as number | undefined));
        const unique = values.size === 1 ? [...values][0] : undefined;
        return (
          <NumberInput
            key={key}
            label={t(`bulk.${key}`)}
            value={unique}
            placeholder={values.size > 1 ? t('mixed') : undefined}
            onChange={(v) => onUpdateMany(ids, { properties: { [key]: v } } as Partial<ProjectElement>)}
          />
        );
      })}
    </Section>
  );
}

const SHARED_KEYS: Partial<Record<ProjectElement['element_type'], string[]>> = {
  wall: ['height', 'thickness', 'base_elevation'],
  column: ['width', 'depth', 'height', 'diameter', 'base_elevation'],
  beam: ['width', 'height', 'top_elevation'],
  joist: ['width', 'height', 'spacing', 'top_elevation'],
  grade_beam: ['width', 'height', 'top_elevation'],
  brace: ['width', 'depth', 'bottom_z', 'top_z'],
  pile: ['diameter', 'pile_length', 'top_elevation', 'capacity_kn'],
  slab: ['thickness', 'top_elevation'],
  footing: ['depth', 'top_elevation', 'soil_capacity_kpa'],
  stair: ['step_count', 'tread', 'riser', 'base_elevation'],
  ramp: ['slope_percent', 'thickness', 'base_elevation'],
  door: ['width', 'height'],
  window: ['width', 'height', 'sill_height'],
};

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="space-y-3 border-t border-slate-800 px-3 py-3">{children}</div>}
    </section>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500 placeholder:text-slate-600';

function NumberInput({
  label,
  value,
  onChange,
  step = 0.01,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  step?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v)) onChange(v);
        }}
        className={inputClass}
      />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogSelect({
  label,
  value,
  options,
  onChange,
  mixed,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  mixed?: boolean;
}) {
  const t = useTranslations('editor.panels.properties');
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select value={mixed ? '__mixed__' : value} onChange={(e) => onChange(e.target.value === '__mixed__' ? value : e.target.value)} className={inputClass}>
        {mixed && <option value="__mixed__">{t('mixed')}</option>}
        <option value="">{t('none')}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
