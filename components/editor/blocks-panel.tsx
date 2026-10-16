'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, Check, Download, FileUp, MousePointerClick, Pencil, Plus, Trash2 } from 'lucide-react';
import type { BlockCreatePayload, BlockDefinition } from '@/types/project';

type BlocksPanelProps = {
  blocks: BlockDefinition[];
  armedBlockId: string | null;
  selectionCount: number;
  readOnly?: boolean;
  actions: {
    armBlock: (blockId: string) => void;
    createFromSelection: (name: string, description?: string) => Promise<void>;
    rename: (id: string, name: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    importPayloads: (payloads: BlockCreatePayload[]) => Promise<void>;
  };
};

export function BlocksPanel({ blocks, armedBlockId, selectionCount, readOnly, actions }: BlocksPanelProps) {
  const t = useTranslations('editor.panels.blocks');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered = blocks.filter((block) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return block.name.toLowerCase().includes(q) || (block.description ?? '').toLowerCase().includes(q);
  });

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function exportBlock(block: BlockDefinition) {
    const payload: BlockCreatePayload = {
      name: block.name,
      description: block.description,
      base_x: block.base_x,
      base_y: block.base_y,
      items: block.items,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `${block.name.replace(/[^a-z0-9-_]+/gi, '_')}.block.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImport(file: File) {
    const parsed = JSON.parse(await file.text()) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const payloads: BlockCreatePayload[] = [];
    for (const entry of list) {
      const candidate = entry as Partial<BlockCreatePayload>;
      if (!candidate || typeof candidate.name !== 'string' || !Array.isArray(candidate.items)) {
        throw new Error(t('invalidFile'));
      }
      payloads.push({
        name: candidate.name,
        description: typeof candidate.description === 'string' ? candidate.description : '',
        base_x: typeof candidate.base_x === 'number' ? candidate.base_x : 0,
        base_y: typeof candidate.base_y === 'number' ? candidate.base_y : 0,
        items: candidate.items,
      });
    }
    await actions.importPayloads(payloads);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-bold text-slate-200">{t('title')}</h2>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{t('subtitle')}</p>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-600"
      />

      {!readOnly && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('createTitle')}</p>
          <p className="mt-1 text-[11px] text-slate-500">{t('createHint', { count: selectionCount })}</p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('createPlaceholder')}
              aria-label={t('createPlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-600"
            />
            <button
              type="button"
              disabled={busy || !newName.trim() || selectionCount === 0}
              onClick={() => void run(async () => { await actions.createFromSelection(newName.trim()); setNewName(''); }, t('saveError'))}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('createButton')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-950/60 p-2 text-xs text-red-300" role="alert">{error}</p>}

      <ul className="mt-3 space-y-2">
        {filtered.map((block) => {
          const armed = block.id === armedBlockId;
          return (
            <li key={block.id} className={`rounded-xl border p-2.5 transition ${armed ? 'border-cyan-600 bg-cyan-950/50' : 'border-slate-800 bg-slate-950'}`}>
              <div className="flex items-center gap-2">
                {renamingId === block.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => {
                      const name = draftName.trim();
                      if (name && name !== block.name) void run(() => actions.rename(block.id, name), t('saveError'));
                      setRenamingId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-cyan-700 px-2 py-1 text-xs outline-none"
                    aria-label={t('rename')}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">{block.name}</span>
                )}
                <span className="shrink-0 text-[10px] text-slate-500">{t('items', { count: block.items.length })}</span>
              </div>
              {block.description && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{block.description}</p>}
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => actions.armBlock(block.id)}
                  disabled={readOnly}
                  className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-semibold transition ${armed ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'} disabled:opacity-40`}
                >
                  {armed ? <Check className="h-3.5 w-3.5" /> : <MousePointerClick className="h-3.5 w-3.5" />}
                  {armed ? t('armed') : t('insert')}
                </button>
                {!readOnly && (
                  <>
                    <IconButton label={t('rename')} icon={Pencil} onClick={() => { setRenamingId(block.id); setDraftName(block.name); }} />
                    <IconButton label={t('export')} icon={Download} onClick={() => exportBlock(block)} />
                    <IconButton label={t('delete')} icon={Trash2} danger disabled={busy} onClick={() => void run(() => actions.remove(block.id), t('deleteError'))} />
                  </>
                )}
                {readOnly && <IconButton label={t('export')} icon={Download} onClick={() => exportBlock(block)} />}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="py-6 text-center text-xs text-slate-500">{t('empty')}</li>}
      </ul>

      {!readOnly && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void run(() => handleImport(file), t('importError'));
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-cyan-700 py-2 text-xs font-semibold text-cyan-400 hover:bg-slate-900 disabled:opacity-40"
          >
            <FileUp className="h-3.5 w-3.5" />
            {t('import')}
          </button>
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${danger ? 'text-slate-500 hover:bg-red-950 hover:text-red-400' : 'text-slate-400 hover:bg-slate-800'} disabled:opacity-30`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
