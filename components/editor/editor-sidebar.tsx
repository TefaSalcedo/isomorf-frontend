'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import type { LoadType } from '@/types/structural-load';
import { Tooltip } from '@/components/ui/tooltip';

type EditorView = '2d' | '3d' | 'loads' | 'fem';

const SECTIONS: { id: ActiveSection; icon: typeof Home }[] = [
  { id: 'home', icon: Home },
  { id: 'projects', icon: FolderOpen },
  { id: 'draw', icon: Pencil },
  { id: 'structure', icon: Columns3 },
  { id: 'layers', icon: Layers3 },
  { id: 'calculations', icon: Calculator },
  { id: 'history', icon: History },
  { id: 'settings', icon: Settings },
];

const DRAW_TOOLS: { id: Tool; icon: typeof MousePointer2 }[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'wall', icon: Minus },
  { id: 'door', icon: DoorOpen },
  { id: 'window', icon: GripVertical },
];

const STRUCTURE_TOOLS: { id: Tool; icon: typeof MousePointer2 }[] = [
  { id: 'column', icon: Square },
  { id: 'beam', icon: Minus },
];

const LOAD_TOOLS: { type: LoadType; icon: typeof ArrowDown; className: string }[] = [
  { type: 'dead', icon: ArrowDown, className: 'bg-slate-100 text-slate-600' },
  { type: 'live', icon: ArrowDown, className: 'bg-blue-50 text-blue-600' },
  { type: 'point', icon: Circle, className: 'bg-red-50 text-red-500' },
  { type: 'distributed', icon: MoveDiagonal, className: 'bg-orange-50 text-orange-500' },
  { type: 'wind', icon: Wind, className: 'bg-cyan-50 text-cyan-600' },
  { type: 'snow', icon: Snowflake, className: 'bg-slate-100 text-slate-500' },
  { type: 'seismic', icon: Zap, className: 'bg-violet-50 text-violet-600' },
  { type: 'self_weight', icon: PanelTop, className: 'bg-emerald-50 text-emerald-600' },
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
  const t = useTranslations('editor.sidebar');
  const [collapsed, setCollapsed] = useState(false);
  const expanded = compact || !collapsed;
  const { activeSection, tool } = state;

  return (
    <div className={`flex shrink-0 bg-white ${compact ? 'h-full w-full' : `h-full border-r border-slate-200 ${expanded ? 'w-72' : 'w-14'}`}`}>
      <nav className="flex h-full w-14 flex-col items-center border-r border-slate-100 py-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          const label = t(`sections.${section.id}`);
          return (
            <Tooltip key={section.id} label={label} position="right">
              <button onClick={() => actions.setSection(section.id)} aria-label={label} aria-current={active ? 'true' : undefined} className={`my-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          );
        })}
        <div className={compact ? 'hidden' : 'mt-auto'}>
          <Tooltip label={expanded ? t('collapse') : t('expand')} position="right">
            <button onClick={() => setCollapsed((value) => !value)} aria-label={expanded ? t('collapse') : t('expand')} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </Tooltip>
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
  const t = useTranslations('editor.sidebar');
  const tt = useTranslations('editor.tools');
  const tc = useTranslations('common');
  const actions = {
    setTool: (nextTool: Tool) => {
      rawActions.setTool(nextTool);
      rawActions.onClose?.();
    },
  };
  return (
    <>
      <SidebarHeading title={t('planTitle')} subtitle={t('planSubtitle')} />
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-slate-400">+</span>
        <input placeholder={t('commandPlaceholder')} aria-label={t('commandPlaceholder')} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
      </div>
      <button type="button" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white"><Pencil className="h-3.5 w-3.5" />{t('generate')}</button>
      <SidebarSection title={t('recentlyUsed')}><div className="grid grid-cols-3 gap-2"><RecentTool icon={Square} label={tt('column')} onClick={() => actions.setTool('column')} /><RecentTool icon={Minus} label={tt('beam')} onClick={() => actions.setTool('beam')} /><RecentTool icon={PanelTop} label={tt('slab')} onClick={() => actions.setTool('select')} /></div></SidebarSection>
      <SidebarSection title={t('annotation')}><div className="grid grid-cols-2 gap-2"><ToolCard icon={Type} label={tt('linearDimension')} active={tool === 'select'} onClick={() => actions.setTool('select')} /><ToolCard icon={MoveDiagonal} label={tt('continuous')} onClick={() => actions.setTool('select')} /><ToolCard icon={Grid3X3} label={tt('gridAxis')} onClick={() => actions.setTool('select')} /><ToolCard icon={Tag} label={tt('tagMark')} onClick={() => actions.setTool('select')} /><ToolCard icon={Ruler} label={tt('level')} onClick={() => actions.setTool('select')} /><ToolCard icon={Type} label={tt('text')} onClick={() => actions.setTool('select')} /></div></SidebarSection>
      <SidebarSection title={t('structural2d')}><div className="grid grid-cols-2 gap-2"><ToolCard icon={Square} label={tt('column')} active={tool === 'column'} onClick={() => actions.setTool('column')} /><ToolCard icon={Minus} label={tt('beamAxis')} active={tool === 'beam'} onClick={() => actions.setTool('beam')} /><ToolCard icon={PanelTop} label={tt('wallSlab')} active={tool === 'wall'} onClick={() => actions.setTool('wall')} /><ToolCard icon={LayoutTemplate} label={tt('floorSlab')} onClick={() => actions.setTool('select')} /><ToolCard icon={Circle} label={tt('opening')} onClick={() => actions.setTool('select')} /><ToolCard icon={DoorOpen} label={tt('section')} onClick={() => actions.setTool('select')} /></div></SidebarSection>
      {activeSection === 'calculations' && <p className="mt-4 text-xs text-slate-500">{t('calculationsHint')}</p>}
      {state.error && <p className="mt-4 rounded-lg bg-red-50 p-2 text-xs text-red-600" role="alert">{state.error}</p>}
    </>
  );
}

function ThreeDSidebar({ onOpenLoads }: { onOpenLoads: () => void }) {
  const t = useTranslations('editor.sidebar');
  const tl = useTranslations('editor.loadTypes');
  return (
    <>
      <SidebarHeading title={t('loadsTitle')} subtitle={t('loadsSubtitle')} />
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">+</span><input placeholder={t('loadsSearch')} aria-label={t('loadsSearch')} className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>
      <SidebarSection title={t('recentlyUsed')}><div className="grid grid-cols-3 gap-2"><RecentTool icon={ArrowDown} label={tl('dead')} onClick={onOpenLoads} /><RecentTool icon={ArrowDown} label={tl('live')} onClick={onOpenLoads} /><RecentTool icon={Wind} label={tl('wind')} onClick={onOpenLoads} /></div></SidebarSection>
      <SidebarSection title={t('exploreLoads')}><div className="grid grid-cols-2 gap-2">{LOAD_TOOLS.map(({ type, icon: Icon, className }) => <button key={type} type="button" onClick={onOpenLoads} className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-[11px] font-semibold transition hover:scale-[1.02] ${className}`}><Icon className="h-5 w-5" />{tl(type)}</button>)}</div></SidebarSection>
      <button type="button" onClick={onOpenLoads} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-xs font-semibold text-red-500"><Trash2 className="h-4 w-4" />{t('removeLoad')}</button>
    </>
  );
}

function SidebarHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-sm font-bold text-slate-800">{title}</h2><p className="mt-1 text-[11px] text-slate-400">{subtitle}</p></div>;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  const tc = useTranslations('common');
  return <section className="mt-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3><span className="text-[10px] text-violet-600">{tc('viewAll')}</span></div>{children}</section>;
}

function RecentTool({ icon: Icon, label, onClick }: { icon: typeof Square; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[10px] text-slate-600 hover:border-violet-300"><Icon className="h-5 w-5 text-violet-600" />{label}</button>;
}

function ToolCard({ icon: Icon, label, active, onClick }: { icon: typeof Square; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[10px] transition ${active ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function FallbackSidebar({ activeSection }: { activeSection: ActiveSection }) {
  const t = useTranslations('editor.sidebar');
  return <><SidebarHeading title={activeSection === 'settings' ? t('settingsTitle') : t('workspaceTitle')} subtitle={t('fallbackSubtitle')} /><p className="mt-4 text-xs leading-5 text-slate-500">{t('fallbackBody')}</p></>;
}
