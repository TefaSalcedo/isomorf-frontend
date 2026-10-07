'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import type { CatalogData } from '@/lib/editor/catalog';
import { currentMaterialRef, materialLabelOf, materialRefChanges } from '@/lib/editor/catalog';
import { drawModeOf } from '@/lib/editor/elements';
import { cmToMeters, metersToCm } from '@/lib/editor/geometry';
import type { ElementType, LayeredProperties, PlanLayer, ProjectElement } from '@/types/project';

type TableActions = {
  updateElement: (id: string, changes: Partial<ProjectElement>) => void;
  updateMany: (ids: string[], changes: Partial<ProjectElement>) => void;
  deleteSelection: () => void;
  selectMany: (ids: string[]) => void;
};

export function ElementTable({
  elements,
  layers,
  catalog,
  selectedIds,
  actions,
  readOnly,
}: {
  elements: ProjectElement[];
  layers: PlanLayer[];
  catalog: CatalogData;
  selectedIds: string[];
  actions: TableActions;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.panels.table');
  const tt = useTranslations('editor.tools');
  const [typeFilter, setTypeFilter] = useState<ElementType | 'all'>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const types = useMemo(
    () => [...new Set(elements.map((el) => el.element_type))].sort(),
    [elements],
  );
  const rows = useMemo(
    () => elements.filter((el) => typeFilter === 'all' || el.element_type === typeFilter),
    [elements, typeFilter],
  );
  const checkedIds = useMemo(() => rows.filter((el) => checked.has(el.id)).map((el) => el.id), [rows, checked]);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyMaterial = (ref: string) => {
    const changes = materialRefChanges(ref);
    actions.updateMany(checkedIds, { material_id: changes.material_id, properties: { material_preset: changes.material_preset } } as Partial<ProjectElement>);
  };

  const inputClass = 'w-full min-w-16 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-200 outline-none hover:border-slate-700 focus:border-cyan-500 focus:bg-slate-900';
  const selectClass = 'w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs text-slate-200 outline-none hover:border-slate-700 focus:border-cyan-500 focus:bg-slate-900 [&>option]:bg-slate-900';

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('title')}</p>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ElementType | 'all')}
          aria-label={t('filterType')}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          <option value="all">{t('allTypes', { count: elements.length })}</option>
          {types.map((type) => (
            <option key={type} value={type}>{tt(type)} ({elements.filter((el) => el.element_type === type).length})</option>
          ))}
        </select>
        {checkedIds.length > 0 && !readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('checked', { count: checkedIds.length })}</span>
            <select
              value=""
              onChange={(e) => e.target.value && applyMaterial(e.target.value)}
              aria-label={t('bulkMaterial')}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            >
              <option value="">{t('bulkMaterial')}</option>
              {catalog.presets.materials.map((preset) => (
                <option key={preset.key} value={`preset:${preset.key}`}>{preset.name}</option>
              ))}
              {catalog.materials.map((material) => (
                <option key={material.id} value={material.id}>{material.name}</option>
              ))}
            </select>
            <select
              value=""
              onChange={(e) => e.target.value && actions.updateMany(checkedIds, { properties: { layer_id: e.target.value } } as Partial<ProjectElement>)}
              aria-label={t('bulkLayer')}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            >
              <option value="">{t('bulkLayer')}</option>
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>{layer.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { actions.selectMany(checkedIds); actions.deleteSelection(); setChecked(new Set()); }}
              className="flex items-center gap-1 rounded-md bg-red-950/60 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900/60"
            >
              <Trash2 className="h-3.5 w-3.5" />{t('deleteChecked')}
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr>
              {!readOnly && <th className="w-8 border-b border-slate-800 px-2 py-2" />}
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">{t('colTag')}</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">{t('colType')}</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">X1 (m)</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">Y1 (m)</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">X2 (m)</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">Y2 (m)</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">{t('colRotation')}</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">{t('colMaterial')}</th>
              <th className="border-b border-slate-800 px-2 py-2 font-medium text-slate-400">{t('colLayer')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((el) => {
              const p = el.properties as Record<string, unknown> & LayeredProperties;
              const mode = drawModeOf(el.element_type);
              const selected = selectedIds.includes(el.id);
              return (
                <tr
                  key={el.id}
                  onClick={() => actions.selectMany([el.id])}
                  className={`cursor-pointer border-b border-slate-800/60 ${selected ? 'bg-cyan-950/40' : 'hover:bg-slate-900/60'}`}
                >
                  {!readOnly && (
                    <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(el.id)}
                        onChange={() => toggleChecked(el.id)}
                        aria-label={t('checkRow', { tag: (p.tag as string) || el.element_type })}
                        className="accent-cyan-500"
                      />
                    </td>
                  )}
                  <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={(p.tag as string) ?? ''}
                      onChange={(e) => actions.updateElement(el.id, { properties: { tag: e.target.value } } as Partial<ProjectElement>)}
                      disabled={readOnly}
                      aria-label={t('colTag')}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1 capitalize text-slate-400">{tt(el.element_type)}</td>
                  {(['x1', 'y1', 'x2', 'y2'] as const).map((axis) => (
                    <td key={axis} className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        step={0.1}
                        value={Number(cmToMeters(el[axis]).toFixed(3))}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (e.target.value !== '' && Number.isFinite(v)) actions.updateElement(el.id, { [axis]: metersToCm(v) });
                        }}
                        disabled={readOnly || mode === 'point' && (axis === 'x2' || axis === 'y2')}
                        aria-label={axis.toUpperCase()}
                        className={inputClass}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      step={1}
                      value={Number(((el.rotation * 180) / Math.PI).toFixed(1))}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value !== '' && Number.isFinite(v)) actions.updateElement(el.id, { rotation: (v * Math.PI) / 180 });
                      }}
                      disabled={readOnly || mode !== 'line'}
                      aria-label={t('colRotation')}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={currentMaterialRef(el)}
                      onChange={(e) => {
                        const changes = materialRefChanges(e.target.value);
                        actions.updateElement(el.id, { material_id: changes.material_id, properties: { material_preset: changes.material_preset } } as Partial<ProjectElement>);
                      }}
                      disabled={readOnly}
                      aria-label={t('colMaterial')}
                      className={selectClass}
                    >
                      <option value="">{materialLabelOf(el, catalog) || '—'}</option>
                      {catalog.presets.materials.map((preset) => (
                        <option key={preset.key} value={`preset:${preset.key}`}>{preset.name}</option>
                      ))}
                      {catalog.materials.map((material) => (
                        <option key={material.id} value={material.id}>{material.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={p.layer_id ?? ''}
                      onChange={(e) => actions.updateElement(el.id, { properties: { layer_id: e.target.value || null } } as Partial<ProjectElement>)}
                      disabled={readOnly}
                      aria-label={t('colLayer')}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {layers.map((layer) => (
                        <option key={layer.id} value={layer.id}>{layer.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 9 : 10} className="px-4 py-8 text-center text-slate-500">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
