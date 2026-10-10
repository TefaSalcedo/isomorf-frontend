import type { ActiveSection, Tool } from '@/hooks/use-editor-state';
import type { EditOp } from '@/lib/editor/edit-ops';

export type EditorView = '2d' | '3d' | 'table' | 'loads' | 'fem';

export type EditorCommand = {
  id: string;
  keywords: string[];
  requiresEdit?: boolean;
  run: () => void;
};

export type EditorCommandContext = {
  setTool: (tool: Tool) => void;
  setSection: (section: ActiveSection) => void;
  setView: (view: EditorView) => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  deleteSelection: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  togglePolar: () => void;
  toggleCleanMode: () => void;
  exportPng: () => void;
  print: () => void;
  armEdit: (op: EditOp) => void;
};

const TOOL_COMMANDS: { id: Tool; keywords: string[] }[] = [
  { id: 'select', keywords: ['select', 'sel', 'seleccionar', 'escape', 'pointer'] },
  { id: 'wall', keywords: ['wall', 'w', 'muro', 'muro cortante'] },
  { id: 'door', keywords: ['door', 'puerta', 'd'] },
  { id: 'window', keywords: ['window', 'ventana', 'win'] },
  { id: 'column', keywords: ['column', 'columna', 'col', 'c', 'pillar', 'pilar'] },
  { id: 'beam', keywords: ['beam', 'viga', 'b', 'beam axis', 'eje de viga'] },
  { id: 'joist', keywords: ['joist', 'vigueta', 'j', 'vigueta bovedilla'] },
  { id: 'grade_beam', keywords: ['grade beam', 'viga de riostra', 'riostra', 'gb', 'tie beam', 'viga de amarre'] },
  { id: 'brace', keywords: ['brace', 'arriostre', 'bracing', 'diagonal', 'templador', 'cruceta'] },
  { id: 'pile', keywords: ['pile', 'pilote', 'pi', 'piling'] },
  { id: 'slab', keywords: ['slab', 'losa', 'loseta', 's', 'floor slab', 'placa'] },
  { id: 'footing', keywords: ['footing', 'zapata', 'cimentacion', 'cimentación', 'foundation', 'z', 'spread footing'] },
  { id: 'stair', keywords: ['stair', 'escalera', 'stairs', 'esc', 'escaleras'] },
  { id: 'ramp', keywords: ['ramp', 'rampa', 'rm'] },
  { id: 'opening', keywords: ['opening', 'hueco', 'abertura', 'o', 'shaft', 'ducto'] },
  { id: 'line', keywords: ['line', 'l', 'linea', 'línea', 'segment', 'segmento'] },
  { id: 'polyline', keywords: ['polyline', 'pline', 'pl', 'polilinea', 'polilínea'] },
  { id: 'arc', keywords: ['arc', 'arco', 'a', 'curve', 'curva'] },
  { id: 'circle', keywords: ['circle', 'circulo', 'círculo', 'ci'] },
  { id: 'ellipse', keywords: ['ellipse', 'elipse', 'el'] },
  { id: 'rectangle', keywords: ['rectangle', 'rectangulo', 'rectángulo', 'rec', 'rect'] },
  { id: 'hatch', keywords: ['hatch', 'hachura', 'sombreado', 'h', 'fill pattern'] },
];

/** Week 9 modify suite — AutoCAD command aliases ride as keywords so typing
 *  ``m``/``co``/``tr`` in the palette arms the same session as the buttons. */
const EDIT_COMMANDS: { id: EditOp; keywords: string[] }[] = [
  { id: 'move', keywords: ['move', 'm', 'mover', 'desplazar', 'trasladar'] },
  { id: 'copy', keywords: ['copy', 'co', 'cp', 'copiar', 'copia', 'duplicate', 'duplicar'] },
  { id: 'rotate', keywords: ['rotate', 'ro', 'rotar', 'girar'] },
  { id: 'mirror', keywords: ['mirror', 'mi', 'espejo', 'simetria', 'simetría', 'reflect'] },
  { id: 'scale', keywords: ['scale', 'sc', 'escalar', 'escala', 'resize'] },
  { id: 'arrayRect', keywords: ['array', 'ar', 'arrayrect', 'rectangular array', 'matriz', 'matriz rectangular', 'multiple copies'] },
  { id: 'arrayPolar', keywords: ['arraypolar', 'polar array', 'polar', 'matriz polar', 'matriz circular', 'circular array', 'ring'] },
  { id: 'offset', keywords: ['offset', 'o', 'desfase', 'paralela', 'equidistancia', 'parallel copy'] },
  { id: 'trim', keywords: ['trim', 'tr', 'recortar', 'recorte', 'cut'] },
  { id: 'extend', keywords: ['extend', 'ex', 'extender', 'prolongar', 'lengthen'] },
  { id: 'fillet', keywords: ['fillet', 'f', 'empalme', 'redondeo', 'round corner', 'fil'] },
];

export function buildEditorCommands(ctx: EditorCommandContext): EditorCommand[] {
  return [
    ...TOOL_COMMANDS.map(({ id, keywords }) => ({
      id: `tool.${id}`,
      keywords,
      requiresEdit: id !== 'select',
      run: () => ctx.setTool(id),
    })),
    ...EDIT_COMMANDS.map(({ id, keywords }) => ({
      id: `edit.${id}`,
      keywords,
      requiresEdit: true,
      run: () => ctx.armEdit(id),
    })),
    { id: 'action.undo', keywords: ['undo', 'deshacer', 'u', 'ctrl+z'], requiresEdit: true, run: ctx.undo },
    { id: 'action.redo', keywords: ['redo', 'rehacer', 'ctrl+y'], requiresEdit: true, run: ctx.redo },
    { id: 'action.save', keywords: ['save', 'guardar', 'ctrl+s'], requiresEdit: true, run: ctx.save },
    { id: 'action.delete', keywords: ['delete', 'eliminar', 'borrar', 'del', 'erase'], requiresEdit: true, run: ctx.deleteSelection },
    { id: 'view.fit', keywords: ['fit', 'zoom extents', 'extents', 'encajar', 'ze'], run: ctx.fit },
    { id: 'view.zoomIn', keywords: ['zoom in', 'zoomin', 'acercar', 'z+'], run: ctx.zoomIn },
    { id: 'view.zoomOut', keywords: ['zoom out', 'zoomout', 'alejar', 'z-'], run: ctx.zoomOut },
    { id: 'view.grid', keywords: ['grid', 'rejilla', 'grilla', 'f7'], run: ctx.toggleGrid },
    { id: 'view.snap', keywords: ['snap', 'osnap', 'ajuste', 'f3'], run: ctx.toggleSnap },
    { id: 'view.polar', keywords: ['polar', 'polar tracking', 'f10', 'rastreo polar'], run: ctx.togglePolar },
    { id: 'view.clean', keywords: ['clean', 'clean mode', 'presentation', 'modo limpio'], run: ctx.toggleCleanMode },
    { id: 'view.2d', keywords: ['2d', 'plan', 'planta', 'plan view'], run: () => ctx.setView('2d') },
    { id: 'view.3d', keywords: ['3d', 'model', 'modelo', 'isometric'], run: () => ctx.setView('3d') },
    { id: 'view.table', keywords: ['table', 'tabla', 'spreadsheet', 'hoja', 'database', 'tabular'], run: () => ctx.setView('table') },
    { id: 'view.loads', keywords: ['loads', 'cargas', 'load editor'], run: () => ctx.setView('loads') },
    { id: 'view.fem', keywords: ['fem', 'analysis', 'analisis', 'análisis', 'finite element'], run: () => ctx.setView('fem') },
    { id: 'section.layers', keywords: ['layers', 'capas', 'layer', 'la'], run: () => ctx.setSection('layers') },
    { id: 'section.catalog', keywords: ['catalog', 'catalogo', 'catálogo', 'materials', 'materiales', 'sections', 'secciones'], run: () => ctx.setSection('catalog') },
    { id: 'section.history', keywords: ['history', 'historial', 'versions', 'versiones'], run: () => ctx.setSection('history') },
    { id: 'section.settings', keywords: ['settings', 'configuracion', 'configuración', 'options', 'opciones'], run: () => ctx.setSection('settings') },
    { id: 'section.calculations', keywords: ['calculations', 'calculos', 'cálculos', 'summary', 'resumen'], run: () => ctx.setSection('calculations') },
    { id: 'doc.export', keywords: ['export', 'exportar', 'png', 'download', 'descargar'], run: ctx.exportPng },
    { id: 'doc.print', keywords: ['print', 'imprimir', 'plot', 'ctrl+p'], run: ctx.print },
  ];
}

/** Rank matches so exact keywords and prefixes beat incidental substring
 *  hits — otherwise typing ``scale`` arms Draw stair because the Spanish
 *  keyword ``escalera`` merely *contains* "scale". Declaration order breaks
 *  ties, keeping tool/edit commands ahead of view/section ones. */
function matchScore(command: EditorCommand, q: string, text: string): number {
  if (text === q || command.keywords.some((keyword) => keyword === q)) return 3;
  if (text.startsWith(q) || command.keywords.some((keyword) => keyword.startsWith(q))) return 2;
  if (text.includes(q) || command.keywords.some((keyword) => keyword.includes(q))) return 1;
  return 0;
}

export function matchCommands(commands: EditorCommand[], query: string, label: (id: string) => string): EditorCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands
    .map((command, order) => ({ command, order, score: matchScore(command, q, label(command.id).toLowerCase()) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.command);
}
