'use client';

import type { ElementType } from '@/types/project';

export function ToolPalette({ activeTool, onChange }: { activeTool: ElementType | 'select'; onChange: (tool: ElementType | 'select') => void }) {
  return (
    <aside className="border-b border-slate-800 bg-slate-950/70 p-4 lg:border-b-0 lg:border-r">
      <p className="font-mono text-[10px] uppercase tracking-[.25em] text-slate-500">Tools</p>
      <div className="mt-4 space-y-2">
        {(['select', 'wall', 'door', 'window'] as const).map((tool) => (
          <button key={tool} onClick={() => onChange(tool)} className={`block w-full rounded-md px-3 py-2 text-left text-sm capitalize ${activeTool === tool ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>{tool}</button>
        ))}
      </div>
      <p className="mt-8 text-xs leading-5 text-slate-500">Choose a drawing tool, then click two points on the canvas. Coordinates are stored in world units.</p>
    </aside>
  );
}
