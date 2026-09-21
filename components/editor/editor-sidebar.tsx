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
  Ruler,
  MoveDiagonal,
  Grid3X3,
  Tag,
  Type,
  PanelTop,
  DoorOpen,
  Circle,
  ArrowDown,
  Wind,
  Snowflake,
  Zap,
  Trash2,
  Layers3,
  History,
} from 'lucide-react';
import type { EditorState, Tool, ActiveSection } from '@/hooks/use-editor-state';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

const SECTIONS: { id: ActiveSection; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'structure', label: 'Structure', icon: Columns3 },
  { id: 'layers', label: 'Capas', icon: Layers3 },
  { id: 'calculations', label: 'Calculations', icon: Calculator },
  { id: 'history', label: 'Historial', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const DRAW_TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'wall', label: 'Wall', icon: Minus },
  { id: 'door', label: 'Door', icon: DoorOpen },
  { id: 'window', label: 'Window', icon: GripVertical },
];

const STRUCTURE_TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'column', label: 'Column', icon: Square },
  { id: 'beam', label: 'Beam', icon: Minus },
];

const LOAD_TOOLS = [
  { label: 'Dead', icon: ArrowDown, className: 'bg-slate-100 text-slate-600' },
  { label: 'Live', icon: ArrowDown, className: 'bg-blue-50 text-blue-600' },
  { label: 'Point', icon: Circle, className: 'bg-red-50 text-red-500' },
  { label: 'Distributed', icon: MoveDiagonal, className: 'bg-orange-50 text-orange-500' },
  { label: 'Wind', icon: Wind, className: 'bg-cyan-50 text-cyan-600' },
  { label: 'Snow', icon: Snowflake, className: 'bg-slate-100 text-slate-500' },
  { label: 'Seismic', icon: Zap, className: 'bg-violet-50 text-violet-600' },
  { label: 'Self weight', icon: PanelTop, className: 'bg-emerald-50 text-emerald-600' },
];

export function EditorSidebar({
  state,
  actions,
  view,
  onOpenLoads,
  compact = false,
  onClose,
}: {
  state: EditorState;
  actions: { setSection: (section: ActiveSection) => void; setTool: (tool: Tool) => void };
  view: EditorView;
  onOpenLoads: () => void;
  compact?: boolean;
  onClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const expanded = compact || !collapsed;
  const { activeSection, tool } = state;

  return (
    <div className={`flex shrink-0 bg-white ${compact ? 'h-full w-full' : `h-full border-r border-slate-200 ${expanded ? 'w-72' : 'w-14'}`}`}>
      <nav className="flex h-full w-14 flex-col items-center border-r border-slate-100 py-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button key={section.id} onClick={() => actions.setSection(section.id)} className={`my-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title={section.label}>
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <div className={compact ? 'hidden' : 'mt-auto'}>
          <button onClick={() => setCollapsed((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-900" title={expanded ? 'Collapse menu' : 'Expand menu'}>
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </nav>
      {expanded && (
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {view === '2d' ? (
            <TwoDSidebar state={state} tool={tool} actions={{ ...actions, onClose }} activeSection={activeSection} />
          ) : view === '3d' ? (
            <ThreeDSidebar onOpenLoads={onOpenLoads} />
          ) : (
            <FallbackSidebar activeSection={activeSection} />
          )}
        </div>
      )}
    </div>
  );
}

function TwoDSidebar({ state, tool, actions: rawActions, activeSection }: { state: EditorState; tool: Tool; actions: { setTool: (tool: Tool) => void; onClose?: () => void }; activeSection: ActiveSection }) {
  const actions = {
    setTool: (nextTool: Tool) => {
      rawActions.setTool(nextTool);
      rawActions.onClose?.();
    },
  };
  return (
    <>
      <SidebarHeading title="2D plan" subtitle="Draw and annotate your structural plan" />
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-slate-400">+</span>
        <input placeholder="Describe an element or command" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
      </div>
      <button type="button" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white"><Pencil className="h-3.5 w-3.5" />Generate</button>
      <SidebarSection title="Recently used"><div className="grid grid-cols-3 gap-2"><RecentTool icon={Square} label="Column" onClick={() => actions.setTool('column')} /><RecentTool icon={Minus} label="Beam" onClick={() => actions.setTool('beam')} /><RecentTool icon={PanelTop} label="Slab" onClick={() => actions.setTool('select')} /></div></SidebarSection>
      <SidebarSection title="Annotation & dimensions"><div className="grid grid-cols-2 gap-2"><ToolCard icon={Type} label="Linear dimension" active={tool === 'select'} onClick={() => actions.setTool('select')} /><ToolCard icon={MoveDiagonal} label="Continuous" onClick={() => actions.setTool('select')} /><ToolCard icon={Grid3X3} label="Grid axis" onClick={() => actions.setTool('select')} /><ToolCard icon={Tag} label="Tag / mark" onClick={() => actions.setTool('select')} /><ToolCard icon={Ruler} label="Level" onClick={() => actions.setTool('select')} /><ToolCard icon={Type} label="Text" onClick={() => actions.setTool('select')} /></div></SidebarSection>
      <SidebarSection title="Structural elements 2D"><div className="grid grid-cols-2 gap-2"><ToolCard icon={Square} label="Column" active={tool === 'column'} onClick={() => actions.setTool('column')} /><ToolCard icon={Minus} label="Beam axis" active={tool === 'beam'} onClick={() => actions.setTool('beam')} /><ToolCard icon={PanelTop} label="Wall / slab" active={tool === 'wall'} onClick={() => actions.setTool('wall')} /><ToolCard icon={LayoutTemplate} label="Floor slab" onClick={() => actions.setTool('select')} /><ToolCard icon={Circle} label="Opening" onClick={() => actions.setTool('select')} /><ToolCard icon={DoorOpen} label="Section" onClick={() => actions.setTool('select')} /></div></SidebarSection>
      {activeSection === 'calculations' && <p className="mt-4 text-xs text-slate-500">Select structural elements to review calculations in the right panel.</p>}
      {state.error && <p className="mt-4 rounded-lg bg-red-50 p-2 text-xs text-red-600">{state.error}</p>}
    </>
  );
}

function ThreeDSidebar({ onOpenLoads }: { onOpenLoads: () => void }) {
  return (
    <>
      <SidebarHeading title="3D loads" subtitle="Explore and apply structural loads" />
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">+</span><input placeholder="Search structural elements or load types" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>
      <SidebarSection title="Recently used"><div className="grid grid-cols-3 gap-2"><RecentTool icon={ArrowDown} label="Dead" onClick={onOpenLoads} /><RecentTool icon={ArrowDown} label="Live" onClick={onOpenLoads} /><RecentTool icon={Wind} label="Wind" onClick={onOpenLoads} /></div></SidebarSection>
      <SidebarSection title="Explore loads"><div className="grid grid-cols-2 gap-2">{LOAD_TOOLS.map(({ label, icon: Icon, className }) => <button key={label} type="button" onClick={onOpenLoads} className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-[11px] font-semibold transition hover:scale-[1.02] ${className}`}><Icon className="h-5 w-5" />{label}</button>)}</div></SidebarSection>
      <button type="button" onClick={onOpenLoads} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-xs font-semibold text-red-500"><Trash2 className="h-4 w-4" />Remove load</button>
    </>
  );
}

function SidebarHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-sm font-bold text-slate-800">{title}</h2><p className="mt-1 text-[11px] text-slate-400">{subtitle}</p></div>;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3><span className="text-[10px] text-violet-600">View all</span></div>{children}</section>;
}

function RecentTool({ icon: Icon, label, onClick }: { icon: typeof Square; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[10px] text-slate-600 hover:border-violet-300"><Icon className="h-5 w-5 text-violet-600" />{label}</button>;
}

function ToolCard({ icon: Icon, label, active, onClick }: { icon: typeof Square; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[10px] transition ${active ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function FallbackSidebar({ activeSection }: { activeSection: ActiveSection }) {
  return <><SidebarHeading title={activeSection === 'settings' ? 'Settings' : 'Workspace'} subtitle="Use the view controls to continue" /><p className="mt-4 text-xs leading-5 text-slate-500">Switch to 2D or 3D to access the contextual editor menu.</p></>;
}
