'use client';

import { useTranslations } from 'next-intl';
import type { DesignSettings, DimStyle } from '@/types/project';

export function ProjectSettingsPanel({
  settings,
  onChange,
  onSave,
  readOnly,
}: {
  settings: DesignSettings;
  onChange: (settings: DesignSettings) => void;
  onSave: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.panels.settings');
  const annotationStyles = settings.dim_styles ?? [];
  const activeStyle = annotationStyles.find((style) => style.id === settings.active_dim_style_id) ?? annotationStyles[0];
  const updateStyle = (patch: Partial<DimStyle>) => {
    if (!activeStyle) return;
    onChange({ ...settings, dim_styles: annotationStyles.map((style) => style.id === activeStyle.id ? { ...style, ...patch } : style) });
  };
  return (
    <div className="h-full overflow-y-auto p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('title')}</p>
      <fieldset disabled={readOnly} className="mt-5 min-w-0 space-y-4 border-0 p-0 disabled:opacity-60">
        <SelectField
          label={t('displayUnit')}
          value={settings.unit ?? 'm'}
          options={[
            { value: 'm', label: t('meters') },
            { value: 'ft', label: t('feet') },
          ]}
          onChange={(v) => onChange({ ...settings, unit: v as 'm' | 'ft' })}
        />
        <TextField
          label={t('seismicZone')}
          value={settings.seismic_zone ?? ''}
          onChange={(v) => onChange({ ...settings, seismic_zone: v })}
        />
        <TextField
          label={t('hailZone')}
          value={settings.hail_zone ?? ''}
          onChange={(v) => onChange({ ...settings, hail_zone: v })}
        />
        <TextField
          label={t('windZone')}
          value={settings.wind_zone ?? ''}
          onChange={(v) => onChange({ ...settings, wind_zone: v })}
        />
        <TextField
          label={t('buildingCode')}
          value={settings.building_code ?? ''}
          onChange={(v) => onChange({ ...settings, building_code: v })}
        />
        <p className="text-sm font-medium text-slate-100">{t('materialConstants')}</p>
        <NumberField
          label={t('compressiveStrength')}
          value={settings.material?.compressive_strength}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, compressive_strength: v },
            })
          }
        />
        <NumberField
          label={t('density')}
          value={settings.material?.density}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, density: v },
            })
          }
        />
        <NumberField
          label={t('elasticModulus')}
          value={settings.material?.elastic_modulus}
          onChange={(v) =>
            onChange({
              ...settings,
              material: { ...settings.material, elastic_modulus: v },
            })
          }
        />
        <section className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-sm font-medium text-slate-100">{t('annotationTitle')}</p>
          <SelectField
            label={t('annotationScale')}
            value={String(settings.annotation_scale ?? 50)}
            options={[20, 25, 50, 75, 100, 200].map((scale) => ({ value: String(scale), label: `1:${scale}` }))}
            onChange={(value) => onChange({ ...settings, annotation_scale: Number(value) })}
          />
          <div className="space-y-1">
            {annotationStyles.map((style) => (
              <label key={style.id} className="flex items-center gap-2 rounded border border-slate-800 px-2 py-1.5 text-xs text-slate-300">
                <input
                  type="radio"
                  name="active-dim-style"
                  checked={style.id === activeStyle?.id}
                  onChange={() => onChange({ ...settings, active_dim_style_id: style.id })}
                />
                <span className="flex-1">{style.name}</span>
                <span className="text-slate-500">{style.id}</span>
              </label>
            ))}
          </div>
          {activeStyle && (
            <div className="space-y-2 rounded-md border border-slate-800 p-2">
              <TextField label={t('styleName')} value={activeStyle.name} onChange={(name) => updateStyle({ name })} />
              <SelectField label={t('arrowStyle')} value={activeStyle.arrow} options={['arrow', 'tick', 'dot'].map((value) => ({ value, label: t(`arrowStyles.${value}`) }))} onChange={(value) => updateStyle({ arrow: value as DimStyle['arrow'] })} />
              <NumberField label={t('textHeight')} value={activeStyle.text_height} onChange={(text_height) => updateStyle({ text_height: text_height ?? 2.5 })} />
              <NumberField label={t('arrowSize')} value={activeStyle.arrow_size} onChange={(arrow_size) => updateStyle({ arrow_size: arrow_size ?? 2.5 })} />
              <NumberField label={t('extensionOffset')} value={activeStyle.ext_offset} onChange={(ext_offset) => updateStyle({ ext_offset: ext_offset ?? 1.25 })} />
              <NumberField label={t('extensionExtend')} value={activeStyle.ext_extend} onChange={(ext_extend) => updateStyle({ ext_extend: ext_extend ?? 1.25 })} />
              <NumberField label={t('decimals')} value={activeStyle.decimals} onChange={(decimals) => updateStyle({ decimals: decimals ?? 2 })} />
              <SelectField label={t('dimensionUnit')} value={activeStyle.unit} options={['m', 'cm', 'mm'].map((value) => ({ value, label: value }))} onChange={(unit) => updateStyle({ unit: unit as DimStyle['unit'] })} />
              <NumberField label={t('angleDecimals')} value={activeStyle.angle_decimals} onChange={(angle_decimals) => updateStyle({ angle_decimals: angle_decimals ?? 0 })} />
            </div>
          )}
          {!readOnly && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!activeStyle) return;
                  const copy = { ...activeStyle, id: `dim-${Date.now()}`, name: t('newStyleName') };
                  onChange({ ...settings, dim_styles: [...annotationStyles, copy], active_dim_style_id: copy.id });
                }}
                className="flex-1 rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-900"
              >
                {t('duplicateStyle')}
              </button>
              <button
                type="button"
                disabled={annotationStyles.length <= 1 || !activeStyle}
                onClick={() => {
                  if (!activeStyle || annotationStyles.length <= 1) return;
                  const nextStyles = annotationStyles.filter((style) => style.id !== activeStyle.id);
                  onChange({ ...settings, dim_styles: nextStyles, active_dim_style_id: nextStyles[0].id });
                }}
                className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-300 disabled:opacity-40"
              >
                {t('deleteStyle')}
              </button>
            </div>
          )}
        </section>
        {!readOnly && (
          <button
            onClick={onSave}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t('save')}
          </button>
        )}
      </fieldset>
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
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
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
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
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
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-full rounded-md border border-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-600"
      />
    </label>
  );
}
