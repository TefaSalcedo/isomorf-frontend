'use client';

import { useState } from 'react';
import {
  Home,
  FolderOpen,
  Pencil,
  LayoutTemplate,
  Calculator,
  Settings,
  ChevronRight,
  ChevronLeft,
  MousePointer2,
  Minus,
  Square,
  Columns3,
  GripVertical,
} from 'lucide-react';
import type { EditorState, Tool, ActiveSection } from '@/hooks/use-editor-state';

const SECTIONS: { id: ActiveSection; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'structure', label: 'Structure', icon: Columns3 },
  { id: 'calculations', label: 'Calculations', icon: Calculator },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const DRAW_TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'wall', label: 'Wall', icon: Minus },
  { id: 'door', label: 'Door', icon: Square },
  { id: 'window', label: 'Window', icon: GripVertical },
];

const STRUCTURE_TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'column', label: 'Column', icon: Square },
  { id: 'beam', label: 'Beam', icon: Minus },
];

export function EditorSidebar({
  state,
  actions,
}: {
  state: EditorState;
  actions: { setSection: (section: ActiveSection) => void; setTool: (tool: Tool) => void };
}) {
  const [expanded, setExpanded] = useState(true);
  const { activeSection, tool } = state;

  const tools =
    activeSection === 'draw' ? DRAW_TOOLS : activeSection === 'structure' ? STRUCTURE_TOOLS : [];

  return (
    <div className={`flex h-full shrink-0 border-r border-slate-200 bg-white ${expanded ? 'w-60' : 'w-14'}`}>
      <nav className="flex h-full w-14 flex-col items-center border-r border-slate-100 py-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => actions.setSection(section.id)}
              className={`my-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={section.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <div className="mt-auto">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            title={expanded ? 'Collapse menu' : 'Expand menu'}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </nav>
      {expanded && (
        <div className="flex h-full w-full flex-col p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {SECTIONS.find((s) => s.id === activeSection)?.label}
          </h2>
          {activeSection === 'home' && (
            <a
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              Go to Dashboard
            </a>
          )}
          {activeSection === 'projects' && (
            <a
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FolderOpen className="h-4 w-4" />
              Open projects
            </a>
          )}
          {(activeSection === 'draw' || activeSection === 'structure') && (
            <div className="mt-4 space-y-1">
              {tools.map((t) => {
                const Icon = t.icon;
                const active = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => actions.setTool(t.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
                      active
                        ? 'bg-slate-100 font-medium text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
          {activeSection === 'calculations' && (
            <p className="mt-4 text-sm text-slate-500">Select walls on the canvas to see the calculations panel on the right.</p>
          )}
          {activeSection === 'settings' && (
            <p className="mt-4 text-sm text-slate-500">Project settings are in the right-side panel.</p>
          )}
        </div>
      )}
    </div>
  );
}
