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
  Circle,
  ArrowDown,
  Wind,
  Snowflake,
  Zap,
  Trash2,
  Layers3,
  History,
  BookMarked,
  CircleDot,
  SquareDashed,
  TrendingUp,
  MoveUpRight,
  Footprints,
  DoorOpen,
  ArrowDownToLine,
  Equal,
  StretchHorizontal,
  Box,
} from 'lucide-react';
import type { EditorState, Tool, ActiveSection } from '@/hooks/use-editor-state';
import type { LoadType } from '@/types/structural-load';
import type { EditorView } from '@/lib/editor/commands';
import { Tooltip } from '@/components/ui/tooltip';

const SECTIONS: { id: ActiveSection; icon: typeof Home }[] = [
  { id: 'home', icon: Home },
  { id: 'projects', icon: FolderOpen },
  { id: 'draw', icon: Pencil },
  { id: 'structure', icon: Columns3 },
  { id: 'layers', icon: Layers3 },
  { id: 'catalog', icon: BookMarked },
  { id: 'calculations', icon: Calculator },
  { id: 'history', icon: History },
  { id: 'settings', icon: Settings },
];

type ToolEntry = { id: Tool; icon: typeof MousePointer2 };

const TOOL_GROUPS: { id: string; tools: ToolEntry[] }[] = [
  {
    id: 'select',
    tools: [{ id: 'select', icon: MousePointer2 }],
  },
  {
    id: 'structure',
    tools: [
      { id: 'column', icon: Square },
      { id: 'beam', icon: Minus },
      { id: 'joist', icon: Equal },
      { id: 'grade_beam', icon: StretchHorizontal },
      { id: 'brace', icon: MoveUpRight },
    ],
  },
  {
    id: 'foundation',
    tools: [
      { id: 'footing', icon: Box },
      { id: 'pile', icon: ArrowDownToLine },
    ],
  },
  {
    id: 'floors',
    tools: [
      { id: 'slab', icon: LayoutTemplate },
      { id: 'stair', icon: Footprints },
      { id: 'ramp', icon: TrendingUp },
      { id: 'opening', icon: SquareDashed },
    ],
  },
  {
    id: 'envelope',
    tools: [
      { id: 'wall', icon: Minus },
      { id: 'door', icon: DoorOpen },
      { id: 'window', icon: GripVertical },
    ],
  },
];

const LOAD_TOOLS: { type: LoadType; icon: typeof ArrowDown; className: string }[] = [
  { type: 'dead', icon: ArrowDown, className: 'bg-slate-800 text-slate-300' },
  { type: 'live', icon: ArrowDown, className: 'bg-blue-950 text-blue-400' },
  { type: 'point', icon: Circle, className: 'bg-red-950 text-red-400' },
  { type: 'distributed', icon: MoveUpRight, className: 'bg-orange-950 text-orange-400' },
  { type: 'wind', icon: Wind, className: 'bg-cyan-950 text-cyan-400' },
  { type: 'snow', icon: Snowflake, className: 'bg-slate-800 text-slate-400' },
  { type: 'seismic', icon: Zap, className: 'bg-violet-950 text-violet-400' },
  { type: 'self_weight', icon: CircleDot, className: 'bg-emerald-950 text-emerald-400' },
];

export function EditorSidebar({
  state,
  actions,
  view,
  onOpenLoads,
  compact = false,
  onClose,
  readOnly,
  onOpenPalette,
}: {
  state: EditorState;
  actions: { setSection: (section: ActiveSection) => void; setTool: (tool: Tool) => void };
  view: EditorView;
  onOpenLoads: () => void;
  compact?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
  onOpenPalette?: () => void;
}) {
  const t = useTranslations('editor.sidebar');
  const [collapsed, setCollapsed] = useState(false);
  const expanded = compact || !collapsed;
  const { activeSection, tool } = state;

  return (
    <div className={`flex shrink-0 bg-slate-950 ${compact ? 'h-full w-full' : `h-full border-r border-slate-800 ${expanded ? 'w-72' : 'w-14'}`}`}>
      <nav className="flex h-full w-14 flex-col items-center border-r border-slate-800 py-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          const label = t(`sections.${section.id}`);
          return (
            <Tooltip key={section.id} label={label} position="right">
              <button onClick={() => actions.setSection(section.id)} aria-label={label} aria-current={active ? 'true' : undefined} className={`my-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors ${active ? 'bg-cyan-950 text-cyan-300' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'}`}>
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          );
        })}
        <div className={compact ? 'hidden' : 'mt-auto'}>
          <Tooltip label={expanded ? t('collapse') : t('expand')} position="right">
            <button onClick={() => setCollapsed((value) => !value)} aria-label={expanded ? t('collapse') : t('expand')} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900 hover:text-slate-200">
              {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </Tooltip>
        </div>
      </nav>
      {expanded && (
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {view === '2d' ? (
            <TwoDSidebar state={state} tool={tool} actions={{ ...actions, onClose }} activeSection={activeSection} readOnly={readOnly} onOpenPalette={onOpenPalette} />
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

function TwoDSidebar({ state, tool, actions: rawActions, activeSection, readOnly, onOpenPalette }: { state: EditorState; tool: Tool; actions: { setTool: (tool: Tool) => void; onClose?: () => void }; activeSection: ActiveSection; readOnly?: boolean; onOpenPalette?: () => void }) {
  const t = useTranslations('editor.sidebar');
  const tt = useTranslations('editor.tools');
  const actions = {
    setTool: (nextTool: Tool) => {
      rawActions.setTool(nextTool);
      rawActions.onClose?.();
    },
  };
  return (
    <>
      <SidebarHeading title={t('planTitle')} subtitle={t('planSubtitle')} />
      <div className="relative mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 transition-colors hover:border-cyan-700">
        <span className="text-slate-500">+</span>
        <input
          type="text"
          readOnly
          value=""
          onFocus={onOpenPalette}
          onClick={onOpenPalette}
          placeholder={t('commandPlaceholder')}
          aria-label={t('commandPlaceholder')}
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600"
        />
        <kbd className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[9px] font-medium text-slate-400">⌘K</kbd>
      </div>
      {TOOL_GROUPS.map((group) => (
        <SidebarSection key={group.id} title={t(`toolGroups.${group.id}`)}>
          <div className="grid grid-cols-3 gap-1.5">
            {group.tools.map(({ id, icon: Icon }) => (
              <ToolButton key={id} icon={Icon} label={tt(id)} active={tool === id} disabled={readOnly && id !== 'select'} onClick={() => actions.setTool(id)} />
            ))}
          </div>
        </SidebarSection>
      ))}
      {activeSection === 'calculations' && <p className="mt-4 text-xs text-slate-500">{t('calculationsHint')}</p>}
      {state.error && <p className="mt-4 rounded-lg bg-red-950/60 p-2 text-xs text-red-300" role="alert">{state.error}</p>}
    </>
  );
}

function ThreeDSidebar({ onOpenLoads }: { onOpenLoads: () => void }) {
  const t = useTranslations('editor.sidebar');
  const tl = useTranslations('editor.loadTypes');
  return (
    <>
      <SidebarHeading title={t('loadsTitle')} subtitle={t('loadsSubtitle')} />
      <SidebarSection title={t('exploreLoads')}><div className="grid grid-cols-2 gap-2">{LOAD_TOOLS.map(({ type, icon: Icon, className }) => <button key={type} type="button" onClick={onOpenLoads} className={`flex h-20 flex-col items-center justify-center gap-2 rounded-xl text-[11px] font-semibold transition hover:scale-[1.02] ${className}`}><Icon className="h-5 w-5" />{tl(type)}</button>)}</div></SidebarSection>
      <button type="button" onClick={onOpenLoads} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-950/60 py-3 text-xs font-semibold text-red-400"><Trash2 className="h-4 w-4" />{t('removeLoad')}</button>
    </>
  );
}

function SidebarHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-sm font-bold text-slate-100">{title}</h2><p className="mt-1 text-[11px] text-slate-500">{subtitle}</p></div>;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5"><div className="mb-2"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h3></div>{children}</section>;
}

function ToolButton({ icon: Icon, label, active, onClick, disabled }: { icon: typeof Square; label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip label={label} position="top">
      <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active === undefined ? undefined : active} className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-cyan-600 bg-cyan-950/60 text-cyan-300' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
        <Icon className="h-4 w-4" />
        <span className="line-clamp-2 leading-tight">{label}</span>
      </button>
    </Tooltip>
  );
}

function FallbackSidebar({ activeSection }: { activeSection: ActiveSection }) {
  const t = useTranslations('editor.sidebar');
  return <><SidebarHeading title={activeSection === 'settings' ? t('settingsTitle') : t('workspaceTitle')} subtitle={t('fallbackSubtitle')} /><p className="mt-4 text-xs leading-5 text-slate-500">{t('fallbackBody')}</p></>;
}
