'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { CatalogData } from '@/lib/editor/catalog';
import type { MaterialCategory, SectionShape } from '@/types/project';

const MATERIAL_CATEGORIES: MaterialCategory[] = ['concrete', 'steel', 'masonry', 'timber', 'aluminum', 'generic'];
const SECTION_SHAPES: SectionShape[] = ['rectangular', 'circular', 'i_shape', 't_shape', 'l_shape', 'box', 'pipe', 'custom'];

export type CatalogActions = {
  addMaterial: (payload: { name: string; category: MaterialCategory }) => Promise<void> | void;
  removeMaterial: (id: string) => Promise<void> | void;
  addSection: (payload: { name: string; shape: SectionShape; dimensions: Record<string, number> }) => Promise<void> | void;
  removeSection: (id: string) => Promise<void> | void;
};

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500 placeholder:text-slate-600';

export function CatalogPanel({
  catalog,
  actions,
  readOnly,
}: {
  catalog: CatalogData;
  actions: CatalogActions;
  readOnly?: boolean;
}) {
  const t = useTranslations('editor.panels.catalog');
  const [materialName, setMaterialName] = useState('');
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>('concrete');
  const [sectionName, setSectionName] = useState('');
  const [sectionShape, setSectionShape] = useState<SectionShape>('rectangular');
  const [sectionB, setSectionB] = useState('0.3');
  const [sectionH, setSectionH] = useState('0.3');

  const submitMaterial = () => {
    const name = materialName.trim();
    if (!name) return;
    void actions.addMaterial({ name, category: materialCategory });
    setMaterialName('');
  };

  const submitSection = () => {
    const name = sectionName.trim();
    if (!name) return;
    const dimensions: Record<string, number> = sectionShape === 'circular'
      ? { diameter: Number(sectionB) || 0.3 }
      : { b: Number(sectionB) || 0.3, h: Number(sectionH) || 0.3 };
    void actions.addSection({ name, shape: sectionShape, dimensions });
    setSectionName('');
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto p-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('title')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
      </header>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('materials')}</h3>
        <ul className="mt-2 space-y-1.5">
          {catalog.materials.map((material) => (
            <li key={material.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{material.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{t(`categories.${material.category}`)}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => void actions.removeMaterial(material.id)} aria-label={t('delete')} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {catalog.materials.length === 0 && <li className="text-xs text-slate-600">{t('emptyMaterials')}</li>}
        </ul>
        {!readOnly && (
          <div className="mt-2 space-y-2 rounded-lg border border-dashed border-slate-700 p-3">
            <input value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder={t('newMaterial')} aria-label={t('newMaterial')} className={inputClass} />
            <select value={materialCategory} onChange={(e) => setMaterialCategory(e.target.value as MaterialCategory)} aria-label={t('category')} className={inputClass}>
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>{t(`categories.${category}`)}</option>
              ))}
            </select>
            <button type="button" onClick={submitMaterial} disabled={!materialName.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cyan-600 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" />{t('addMaterial')}
            </button>
          </div>
        )}
        <h4 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('presets')}</h4>
        <ul className="mt-2 space-y-1">
          {catalog.presets.materials.map((preset) => (
            <li key={preset.key} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-400">
              <span className="truncate">{preset.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">{preset.category ?? ''}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('sections')}</h3>
        <ul className="mt-2 space-y-1.5">
          {catalog.sections.map((section) => (
            <li key={section.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{section.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{t(`shapes.${section.shape}`)}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => void actions.removeSection(section.id)} aria-label={t('delete')} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {catalog.sections.length === 0 && <li className="text-xs text-slate-600">{t('emptySections')}</li>}
        </ul>
        {!readOnly && (
          <div className="mt-2 space-y-2 rounded-lg border border-dashed border-slate-700 p-3">
            <input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder={t('newSection')} aria-label={t('newSection')} className={inputClass} />
            <select value={sectionShape} onChange={(e) => setSectionShape(e.target.value as SectionShape)} aria-label={t('shape')} className={inputClass}>
              {SECTION_SHAPES.map((shape) => (
                <option key={shape} value={shape}>{t(`shapes.${shape}`)}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={sectionB} onChange={(e) => setSectionB(e.target.value)} placeholder={sectionShape === 'circular' ? 'Ø (m)' : 'b (m)'} aria-label="b" className={inputClass} />
              {sectionShape !== 'circular' && (
                <input value={sectionH} onChange={(e) => setSectionH(e.target.value)} placeholder="h (m)" aria-label="h" className={inputClass} />
              )}
            </div>
            <button type="button" onClick={submitSection} disabled={!sectionName.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cyan-600 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" />{t('addSection')}
            </button>
          </div>
        )}
        <h4 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('presets')}</h4>
        <ul className="mt-2 space-y-1">
          {catalog.presets.sections.map((preset) => (
            <li key={preset.key} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-400">
              <span className="truncate">{preset.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">{preset.shape ?? ''}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
