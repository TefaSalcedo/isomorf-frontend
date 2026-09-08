'use client';

import type { ProjectElement } from '@/types/project';
import { cmToMeters, metersToCm } from '@/lib/editor/geometry';

export function PropertiesPanel({
  elements,
  onUpdate,
}: {
  elements: ProjectElement[];
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  if (elements.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <p className="text-sm text-slate-500">Select an element to edit its properties.</p>
      </div>
    );
  }
  if (elements.length > 1) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <p className="text-sm text-slate-500">{elements.length} elements selected. Use the right panel to edit one at a time or open Calculations for a summary.</p>
      </div>
    );
  }
  const el = elements[0];

  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Properties</p>
      <p className="mt-1 text-sm font-medium capitalize text-slate-900">{el.element_type}</p>
      <div className="mt-5 space-y-4">
        {el.element_type === 'wall' && (
          <WallFields wall={el} onUpdate={onUpdate} />
        )}
        {el.element_type === 'column' && (
          <ColumnFields column={el} onUpdate={onUpdate} />
        )}
        {el.element_type === 'beam' && (
          <BeamFields beam={el} onUpdate={onUpdate} />
        )}
        {el.element_type === 'door' && (
          <DoorFields door={el} onUpdate={onUpdate} />
        )}
        {el.element_type === 'window' && (
          <WindowFields window={el} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number | string | undefined;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function SelectField({
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
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function WallFields({
  wall,
  onUpdate,
}: {
  wall: Extract<ProjectElement, { element_type: 'wall' }>;
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  const p = wall.properties;
  return (
    <>
      <Field
        label="Length (m)"
        value={cmToMeters(wall.length).toFixed(2)}
        onChange={(v) => onUpdate(wall.id, { length: metersToCm(v) })}
      />
      <Field
        label="Height (m)"
        value={p.height}
        onChange={(v) => onUpdate(wall.id, { properties: { height: v } } as Partial<ProjectElement>)}
      />
      <Field
        label="Thickness (m)"
        value={p.thickness}
        onChange={(v) => onUpdate(wall.id, { properties: { thickness: v } } as Partial<ProjectElement>)}
      />
      <SelectField
        label="Join mode"
        value={p.join_mode}
        options={[
          { value: 'perpendicular', label: '90°' },
          { value: '45', label: '45°' },
          { value: 'free', label: 'Free' },
        ]}
        onChange={(v) =>
          onUpdate(wall.id, { properties: { join_mode: v as 'perpendicular' | '45' | 'free' } } as Partial<ProjectElement>)
        }
      />
      {p.join_mode === 'free' && (
        <Field
          label="Join angle (°)"
          value={p.join_angle}
          onChange={(v) => onUpdate(wall.id, { properties: { join_angle: v } } as Partial<ProjectElement>)}
        />
      )}
    </>
  );
}

function ColumnFields({
  column,
  onUpdate,
}: {
  column: Extract<ProjectElement, { element_type: 'column' }>;
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  const p = column.properties;
  return (
    <>
      <Field label="Width (m)" value={p.width} onChange={(v) => onUpdate(column.id, { properties: { width: v } } as Partial<ProjectElement>)} />
      <Field label="Depth (m)" value={p.depth} onChange={(v) => onUpdate(column.id, { properties: { depth: v } } as Partial<ProjectElement>)} />
      <Field label="Height (m)" value={p.height} onChange={(v) => onUpdate(column.id, { properties: { height: v } } as Partial<ProjectElement>)} />
      <TextField label="Material" value={p.material} onChange={(v) => onUpdate(column.id, { properties: { material: v } } as Partial<ProjectElement>)} />
    </>
  );
}

function BeamFields({
  beam,
  onUpdate,
}: {
  beam: Extract<ProjectElement, { element_type: 'beam' }>;
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  const p = beam.properties;
  return (
    <>
      <Field label="Width (m)" value={p.width} onChange={(v) => onUpdate(beam.id, { properties: { width: v } } as Partial<ProjectElement>)} />
      <Field label="Height (m)" value={p.height} onChange={(v) => onUpdate(beam.id, { properties: { height: v } } as Partial<ProjectElement>)} />
      <Field label="Length (m)" value={p.length} onChange={(v) => onUpdate(beam.id, { properties: { length: v }, length: metersToCm(v) } as Partial<ProjectElement>)} />
      <TextField label="Material" value={p.material} onChange={(v) => onUpdate(beam.id, { properties: { material: v } } as Partial<ProjectElement>)} />
    </>
  );
}

function DoorFields({
  door,
  onUpdate,
}: {
  door: Extract<ProjectElement, { element_type: 'door' }>;
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  const p = door.properties;
  return (
    <>
      <Field label="Width (m)" value={p.width ?? 0} onChange={(v) => onUpdate(door.id, { properties: { width: v } } as Partial<ProjectElement>)} />
      <SelectField
        label="Swing"
        value={p.swing ?? 'left'}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => onUpdate(door.id, { properties: { swing: v as 'left' | 'right' } } as Partial<ProjectElement>)}
      />
    </>
  );
}

function WindowFields({
  window,
  onUpdate,
}: {
  window: Extract<ProjectElement, { element_type: 'window' }>;
  onUpdate: (id: string, changes: Partial<ProjectElement>) => void;
}) {
  const p = window.properties;
  return (
    <>
      <Field label="Width (m)" value={p.width ?? 0} onChange={(v) => onUpdate(window.id, { properties: { width: v } } as Partial<ProjectElement>)} />
      <Field label="Sill height (m)" value={p.sill_height ?? 0.9} onChange={(v) => onUpdate(window.id, { properties: { sill_height: v } } as Partial<ProjectElement>)} />
    </>
  );
}
