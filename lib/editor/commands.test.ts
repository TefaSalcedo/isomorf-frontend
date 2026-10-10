import { describe, expect, it, vi } from 'vitest';
import { buildEditorCommands, matchCommands } from './commands';
import type { EditorCommandContext } from './commands';

function makeContext(): EditorCommandContext {
  return {
    setTool: vi.fn(),
    setSection: vi.fn(),
    setView: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    deleteSelection: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fit: vi.fn(),
    toggleGrid: vi.fn(),
    toggleSnap: vi.fn(),
    togglePolar: vi.fn(),
    toggleCleanMode: vi.fn(),
    exportPng: vi.fn(),
    print: vi.fn(),
    armEdit: vi.fn(),
  };
}

describe('buildEditorCommands', () => {
  it('builds commands that invoke the context', () => {
    const ctx = makeContext();
    const commands = buildEditorCommands(ctx);
    commands.find((command) => command.id === 'tool.beam')?.run();
    expect(ctx.setTool).toHaveBeenCalledWith('beam');
    commands.find((command) => command.id === 'view.fit')?.run();
    expect(ctx.fit).toHaveBeenCalledOnce();
    commands.find((command) => command.id === 'section.layers')?.run();
    expect(ctx.setSection).toHaveBeenCalledWith('layers');
  });

  it('marks mutating commands as requiresEdit', () => {
    const commands = buildEditorCommands(makeContext());
    for (const id of ['tool.wall', 'tool.beam', 'action.undo', 'action.redo', 'action.save', 'action.delete']) {
      expect(commands.find((command) => command.id === id)?.requiresEdit).toBe(true);
    }
    for (const id of ['tool.select', 'view.3d', 'view.fit', 'doc.export']) {
      expect(commands.find((command) => command.id === id)?.requiresEdit).toBeFalsy();
    }
  });

  it('exposes a tool command for every element type', () => {
    const ctx = makeContext();
    const commands = buildEditorCommands(ctx);
    const ids = commands.map((command) => command.id);
    for (const tool of ['wall', 'door', 'window', 'column', 'beam', 'joist', 'grade_beam', 'brace', 'pile', 'slab', 'footing', 'stair', 'ramp', 'opening']) {
      expect(ids).toContain(`tool.${tool}`);
    }
    commands.find((command) => command.id === 'tool.slab')?.run();
    expect(ctx.setTool).toHaveBeenCalledWith('slab');
    commands.find((command) => command.id === 'tool.pile')?.run();
    expect(ctx.setTool).toHaveBeenCalledWith('pile');
  });

  it('routes the table view and catalog section commands', () => {
    const ctx = makeContext();
    const commands = buildEditorCommands(ctx);
    commands.find((command) => command.id === 'view.table')?.run();
    expect(ctx.setView).toHaveBeenCalledWith('table');
    commands.find((command) => command.id === 'section.catalog')?.run();
    expect(ctx.setSection).toHaveBeenCalledWith('catalog');
  });
});

describe('matchCommands', () => {
  const commands = buildEditorCommands(makeContext());
  const label = (id: string) => id;

  it('returns all commands for an empty query', () => {
    expect(matchCommands(commands, '   ', label)).toHaveLength(commands.length);
  });

  it('matches by alias prefix', () => {
    const ids = matchCommands(commands, 'vig', label).map((command) => command.id);
    expect(ids).toContain('tool.beam');
  });

  it('matches a single-letter alias', () => {
    const ids = matchCommands(commands, 'w', label).map((command) => command.id);
    expect(ids).toContain('tool.wall');
  });

  it('matches bilingual aliases of the new tools', () => {
    expect(matchCommands(commands, 'vigueta', label).map((command) => command.id)).toContain('tool.joist');
    expect(matchCommands(commands, 'zapata', label).map((command) => command.id)).toContain('tool.footing');
    expect(matchCommands(commands, 'escalera', label).map((command) => command.id)).toContain('tool.stair');
    expect(matchCommands(commands, 'riostra', label).map((command) => command.id)).toContain('tool.grade_beam');
    expect(matchCommands(commands, 'pilote', label).map((command) => command.id)).toContain('tool.pile');
    expect(matchCommands(commands, 'tabla', label).map((command) => command.id)).toContain('view.table');
    expect(matchCommands(commands, 'catalogo', label).map((command) => command.id)).toContain('section.catalog');
  });

  it('matches by label text', () => {
    const results = matchCommands(commands, 'undo', (id) => (id === 'action.undo' ? 'Undo' : id));
    expect(results.map((command) => command.id)).toContain('action.undo');
  });

  it('returns nothing when nothing matches', () => {
    expect(matchCommands(commands, 'zzzzzz', label)).toHaveLength(0);
  });
});
