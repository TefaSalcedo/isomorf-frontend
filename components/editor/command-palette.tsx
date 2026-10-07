'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Terminal } from 'lucide-react';
import type { EditorCommand } from '@/lib/editor/commands';
import { matchCommands } from '@/lib/editor/commands';

type CommandPaletteProps = {
  open: boolean;
  initialQuery?: string;
  commands: EditorCommand[];
  onClose: () => void;
};

export function CommandPalette({ open, initialQuery = '', commands, onClose }: CommandPaletteProps) {
  if (!open) return null;
  return (
    <PaletteDialog
      key={initialQuery}
      initialQuery={initialQuery}
      commands={commands}
      onClose={onClose}
    />
  );
}

function PaletteDialog({
  initialQuery,
  commands,
  onClose,
}: {
  initialQuery: string;
  commands: EditorCommand[];
  onClose: () => void;
}) {
  const t = useTranslations('editor.commands');
  const tP = useTranslations('editor.palette');
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => matchCommands(commands, query, (id) => t(id)),
    [commands, query, t],
  );
  const activeIndex = Math.min(index, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runCommand = (command?: EditorCommand) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndex(Math.min(activeIndex + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runCommand(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-4">
          <Terminal className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={tP('placeholder')}
            className="w-full bg-transparent py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />
          <kbd className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
          {results.map((command, i) => (
            <button
              key={command.id}
              type="button"
              data-active={i === activeIndex}
              onMouseEnter={() => setIndex(i)}
              onClick={() => runCommand(command)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === activeIndex ? 'bg-blue-600/20 text-slate-100' : 'text-slate-400'
              }`}
            >
              <span>{t(command.id)}</span>
              {command.keywords[0] && (
                <kbd className="rounded border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {command.keywords[0]}
                </kbd>
              )}
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-600">{tP('noResults')}</p>
          )}
        </div>
        <p className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">{tP('hint')}</p>
      </div>
    </div>
  );
}
