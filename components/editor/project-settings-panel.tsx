'use client';

import type { DesignSettings } from '@/types/project';

export function ProjectSettingsPanel({
  settings,
  onChange,
  onSave,
}: {
  settings: DesignSettings;
  onChange: (settings: DesignSettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Project settings</p>
      <div className="mt-5 space-y-4">
        <TextField
          label="Seismic zone"
          value={settings.seismic_zone ?? ''}
          onChange={(v) => onChange({ ...settings, seismic_zone: v })}
        />
        <TextField
          label="Hail zone"
          value={settings.hail_zone ?? ''}
          onChange={(v) => onChange({ ...settings, hail_zone: v })}
        />
        <TextField
          label="Wind zone"
          value={settings.wind_zone ?? ''}
          onChange={(v) => onChange({ ...settings, wind_zone: v })}
        />
        <TextField
          label="Building code"
          value={settings.building_code ?? ''}
          onChange={(v) => onChange({ ...settings, building_code: v })}
        />
        <p className="text-sm font-medium text-slate-900">Material constants</p>
        <NumberField
          label="Compressive strength (MPa)"
          value={settings.material?.compressive_strength}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, compressive_strength: v },
            })
          }
        />
        <NumberField
          label="Density (kg/m³)"
          value={settings.material?.density}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, density: v },
            })
          }
        />
        <NumberField
          label="Elastic modulus (GPa)"
          value={settings.material?.elastic_modulus}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, elastic_modulus: v },
            })
          }
        />
        <button
          onClick={onSave}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save project settings
        </button>
      </div>
    </div>
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
      />
    </label>
  );
}
