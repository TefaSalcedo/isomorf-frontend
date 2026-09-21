# Modelo de documento versionado en el editor — por qué importa

> Semana 2 del roadmap. Explica qué cambió en el frontend, por qué se eligió
> este diseño y cómo afecta a la experiencia del usuario.

## El problema que resuelve

El undo/redo vivía en arrays `past`/`future` dentro del reducer de React: al
recargar la página, cerrar la pestaña o abrir el proyecto en otro dispositivo,
**el historial desaparecía**. Además, el guardado hacía N peticiones (una por
elemento creado/editado/borrado + una por el proyecto): si la red fallaba a la
mitad, el documento quedaba parcialmente guardado y sin registro.

## Qué cambió

- **Guardado atómico**: `save()` ahora llama una sola vez a
  `PUT /projects/{id}/document` con nombre + `design_settings` + todos los
  elementos. El servidor decide la nueva revisión — o todo se guarda o nada.
- **Undo/redo server-authoritative**: los botones (y los nuevos atajos
  `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`) llaman a `POST /history/undo|redo`.
  El servidor mueve `current_revision` y devuelve el documento resultante, que
  se aplica con la acción `applyDocument`. Como la historia vive en la base de
  datos, **deshacer funciona después de recargar o desde otro dispositivo**.
- **Panel de historial** (`history-panel.tsx`, sección "Historial" del
  sidebar): lista las revisiones con hora y resumen de cambios por elemento, y
  permite restaurar cualquier revisión con un clic (`POST /history/{rev}/restore`).
- **`Saved · v{N}`** en la barra superior hace visible la revisión actual.

## Decisiones de UX

- **Flush antes de deshacer**: si hay cambios sin guardar cuando el usuario
  pulsa deshacer, primero se completa el guardado pendiente y luego se mueve el
  puntero. La edición queda registrada como revisión y `Redo` la recupera —
  nada se pierde silenciosamente.
- **Estados deshabilitados honestos**: undo se deshabilita en la revisión 1
  (baseline), redo cuando no hay futuro, y ambos mientras una operación de
  historial está en vuelo (`historyBusy`), evitando doble-clics que corrompan
  el puntero.
- **Granularidad por guardado**: un undo restaura el estado del guardado
  anterior, no cada micro-gesto (las ediciones dentro de la ventana de debounce
  de ~700ms se agrupan). Es el modelo de Google Docs y mantiene la historia
  legible en el panel.
- **Race de guardado corregida**: si el usuario edita mientras un save está en
  vuelo, `markSaved` conserva `dirty` (comparando la referencia del array de
  elementos enviado vs. el actual) y el autosave vuelve a dispararse — antes,
  esa edición podía quedar marcada como guardada sin haberse persistido.

## Qué habilita

- **Colaboración (Fase 1)**: con el servidor como autoridad del documento, dos
  clientes pueden sincronizar por número de revisión; el panel ya muestra el
  mismo historial que verán los compañeros de equipo.
- **Confianza del usuario**: el historial visible + `Saved · v{N}` comunica que
  el trabajo no se pierde — requisito implícito de cualquier herramienta CAD.
