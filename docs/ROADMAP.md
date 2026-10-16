# ISOMORF — Roadmap de producto

**Visión:** un AutoCAD + SAP2000 en la web, gratuito y **tan fácil de usar como Canva**: le dices al **asistente de IA** qué quieres en lenguaje natural («un edificio de 7 pisos, placa aligerada en el primero, maciza en el resto») y lo construye como modelo editable. Incluye un **modo de factibilidad / pre-factibilidad** para validar un proyecto en minutos antes de modelar en detalle, y un **modo de enseñanza** que explica cada cálculo paso a paso (cortante, momento, cuantías…). Colaboración de equipos en tiempo real (metodología BIM: todos ven qué está pasando en el modelo). El nivel Revit (BIM arquitectónico completo) queda para una fase futura.

**Leyenda de estados:** ✅ completado · 🟡 parcial / en curso · 📋 planeado · ❓ por definir · 🔴 brecha sin asignar · ⚪ descartado / post-MVP

**Fecha de validación base:** 18 sep 2026 (stack verificado E2E con Docker + Playwright).
**Semana 1 completada:** 21 sep 2026 (CI verde en ambos repos, PRs #2 backend y #3 frontend mergeados).
**Semana 2 completada:** 21 sep 2026 (PRs #3 backend y #4 frontend mergeados; criterio "recargar y deshacer" verificado E2E con Playwright MCP en desktop, tablet y móvil).
**Semana 3 completada:** 22 sep 2026 (EN como idioma principal con ES vía diccionario `next-intl`; axe sin violaciones críticas en landing/register/dashboard/editor; warnings Three.js eliminados; verificado con Playwright MCP en local).
**Semana 4 completada:** 7 oct 2026 (workspaces y roles en backend: `teams`/`team_members`/`project_shares`/`team_invites` vía migración 0006, `access_service` con roles aplicados en todos los servicios, criterio "viewer → 403" verificado en `test_teams.py`; UI de equipos diferida por repriorización).
**Orden revisado:** 7 oct 2026 — tras la investigación externa de SAP2000/AutoCAD/SkyCiv/Onshape/ClearCalcs, el orden de ejecución queda: **pulido funcional/visual → herramientas CAD (Fase 2) → teams/colaboración → migración del modelo de cargas → paramétricos (Fase 3) → análisis (Fase 4) → entregables (Fase 5)**. Las semanas mantienen su contenido; cambia el orden entre bloques.
**Semana 8 completada:** 8 oct 2026 (rama `feat/week8-cad-primitives`: 7 primitivas CAD persistidas vía migración 0008 — línea, polilínea, arco, círculo, elipse, rectángulo, hatch; modos de dibujo multi-punto/3-puntos/centro-radio; input numérico `x,y` / `@dx,dy` / `L<ángulo` / `WxH` / `c` para cerrar; snaps perpendicular+nearest+quadrantes+vértices con prioridad estilo AutoCAD; exclusión de 3D y cálculos; criterio "planta 6×4m solo teclado" verificado en `e2e/cad-primitives.spec.ts` y con Playwright MCP; demo grabado en `videos/isomorf-cad-primitives-demo.webm`).
**Bloque A completado:** 8 oct 2026 (PR #7 `feat/block-a-editor-polish`: página `/invites/[token]`, command palette `Ctrl+K` con aliases deterministas EN/ES, polar tracking + dynamic input, modo solo-lectura para viewers vía `access_role`).
**Semana 5 completada:** 8 oct 2026 (PR #6 `feat/week5-teams-ui`: página de equipo, carpeta Teams en dashboard, flujo de aceptación de invitaciones).
**Semana 9 completada:** 9 oct 2026 (PR #10 `feat/week9-edit-tools`: move/copy/rotate/mirror/array/offset/trim/extend/fillet/scale con máquina de sesión, selección window/crossing + grips arrastrables; 56 tests unitarios en `edit-ops.test.ts` + e2e `cad-edit-tools.spec.ts`).
**Actualización de visión:** 16 oct 2026 — investigación de asistentes IA estructurales (Structon.AI, StructureClaw, Text2BIM, IFC-Copilot) y de herramientas de factibilidad (TestFit, Autodesk Forma); se añade la **Fase 6 — IA, factibilidad y enseñanza** (§3) con sus decisiones ❓ por definir, y se corrige el estado real (Bloque A y semanas 5 y 9 completadas).

## Contenido

- [1. Estado actual](#1-estado-actual-ya-existe-y-funciona)
- [2. Brechas detectadas (validación E2E)](#2-brechas-detectadas-validación-e2e)
- [3. Plan por semanas](#3-plan-por-semanas-24-semanas--fase-6-por-programar)
- [4. Dependencias y decisiones clave](#4-dependencias-y-decisiones-clave)
- [5. Riesgos principales](#5-riesgos-principales)
- [6. Inventario de brechas vs. AutoCAD y SAP2000](#6-inventario-de-brechas-vs-autocad-y-sap2000)
- [7. Referencias de investigación](#7-referencias-de-investigación)

---

## 1. Estado actual (ya existe y funciona)

| Capacidad | Estado | Detalle |
|---|---|---|
| Auth + sesiones por dispositivo | ✅ | Registro/login, JWT + device-bound sessions (WebCrypto, `device_sessions`, `device_nonces`) + hint cookie |
| Proyectos / carpetas / elementos | ✅ | CRUD completo, slug público (`public_id`) + UUID interno |
| Editor 2D | ✅ | Canvas Konva: columna, eje de viga, muro/losa, abertura, cota, texto; zoom/grid/snap; undo/redo **persistido en servidor**; guardado atómico del documento |
| Historial versionado | ✅ | `project_documents` (snapshots) + `element_revisions` (diff por elemento); `GET /projects/{id}/history`, undo/redo/restore por API; panel de historial en el editor |
| Vista 3D | ✅ | Three.js/R3F: renderiza geometría del modelo, selección de elementos |
| Inspector de diseño de viga | ✅ | Geometría, concreto/acero, refuerzo, cargas; **memoria de cálculo local** (D/C, Mu/φMn, Vu/φVn) |
| Cargas estructurales | ✅ | Panel Dead/Live/Wind/Point/Distributed/Snow/Seismic/Self weight + endpoints `load-cases`/`loads` |
| Capas 2D | ✅ | `design_settings.layers` persistido, panel de capas en el editor |
| Responsive móvil | ✅ | Layout compacto <1024px, hoja de propiedades, selección táctil |
| Persistencia | ✅ | PostgreSQL + Alembic (6 migraciones), auto-migrate al arranque |
| Tests + CI | ✅ | pytest + vitest + Playwright e2e; GitHub Actions en cada PR; cobertura ≥40% en services |
| Teams / roles | ✅ | `teams`, `team_members`, `project_shares`, invites por token (`accept_url`); `access_service` resuelve rol efectivo (owner/editor/viewer) en todos los servicios; **UI** de equipo + aceptación de invitaciones + viewer solo-lectura |
| Edición CAD | ✅ | move/copy/rotate/mirror/array(rect/polar)/offset/trim/extend/fillet/scale, selección window/crossing, grips arrastrables |
| Command palette + polar tracking | ✅ | `Ctrl+K` con aliases deterministas EN/ES, dynamic input junto al cursor |

## 2. Brechas detectadas (validación E2E)

| Brecha | Severidad | Estado |
|---|---|---|
| Sin tests automatizados ni CI | 🔴 | ✅ Resuelto (semana 1) |
| Doble-submit en registro → 409 tras éxito | 🟡 | ✅ Resuelto |
| Poll redundante a `/api/auth/me` | 🟡 | ✅ Resuelto (hint cookie) |
| Sin solver FEM ni endpoints de análisis | 🔴 Core de la visión | Pendiente (Fase 4) |
| Modelo de cargas mezcla pattern/case (sin combinaciones) | 🔴 Arquitectura | Pendiente (Bloque M — antes de Fase 4). `load_cases` actual = Load Pattern de SAP2000; faltan `analysis_cases` y `load_combinations` |
| Sin colaboración realtime (presencia, concurrencia, comentarios) | 🔴 Core de la visión | 🟡 Backend ✅ (sem. 4) + UI de equipos ✅ (sem. 5); falta realtime (sem. 6-7) |
| Link de invitación `/invites/{token}` sin página (404) | 🟠 Funcional | ✅ Resuelto (Bloque A, 8 oct 2026) |
| Frontend no consume `access_role` (viewer ve editor editable) | 🟡 Funcional | ✅ Resuelto (Bloque A — modo solo-lectura) |
| Herramientas CAD limitadas (sin edición: trim, offset, array…) | 🟠 Producto | ✅ Resuelto (semana 9) |
| Sin asistente IA (texto → modelo) | 🔴 Diferenciador de la visión | Pendiente (Fase 6 / IA-1–IA-2). La command palette actual solo interpreta keywords deterministas |
| Sin modo factibilidad / pre-factibilidad | 🟠 Adopción | Pendiente (Fase 6 / FEA-1) |
| Cálculos sin capa de enseñanza | 🟡 Educación | Pendiente (Fase 6 / EDU-1). La memoria ya lista pasos; faltan explicación, glosario y ejemplos guiados |
| Elementos estructurales no paramétricos (sin secciones/materiales completos) | 🟠 Producto | Pendiente (Fase 3) |
| Sin import/export DXF ni PDF | 🟠 Adopción | Pendiente (Fase 5) |
| OAuth (Google/Microsoft) deshabilitado | 🟡 Adopción | Pendiente (semana 24) |
| i18n inconsistente (EN/ES mezclado) | 🟡 Pulido | ✅ Resuelto (semana 3) |
| Memoria de cálculo solo en cliente (sin trazabilidad servidor) | 🟡 Confianza | Pendiente (Fase 4) |
| Warnings Three.js (`THREE.Clock`, `PCFSoftShadowMap` deprecados) | ⚪ Menor | ✅ Resuelto (semana 3) |

---

## 3. Plan por semanas (24 semanas + Fase 6 por programar)

### Fase 0 — Cimientos de ingeniería (Semanas 1–3)

> Sin calidad ni datos versionados, todo lo demás se rompe al crecer.

**Semana 1 — Tests + CI** ✅ *completada*
- `pytest` + fixtures para backend (auth, CRUD, device sessions); `vitest`/Playwright para frontend
- GitHub Actions: lint + typecheck + tests + build + e2e en cada PR
- Fix: doble-submit en registro (409) y polling a `/api/auth/me`
- **Criterio cumplido:** CI verde, cobertura base ≥40% en services

**Semana 2 — Modelo de documento versionado** ✅ *completada*
- Migración: `project_documents`/`element_revisions` (snapshot + diff por elemento)
- Undo/redo persistido; endpoint `GET /projects/{id}/history`
- **Criterio cumplido:** recargar y deshacer restaura estados anteriores (E2E: guardar → undo → reload → redo; truncado del futuro y restore desde panel validados)

**Semana 3 — i18n + accesibilidad base** ✅ *completada*
- Unificar idioma (decisión: **EN primero**, ES vía diccionario) con `next-intl` — sin rutas de locale, persistencia en cookie/localStorage
- Roles/labels ARIA en canvas 2D/3D, focus states, tooltips accesibles (hover + teclado); warnings Three.js eliminados (`THREE.Clock` vía patch de `@react-three/fiber`, `PCFSoftShadowMap` → `PCFShadowMap`)
- **Criterio cumplido:** cero strings hardcodeados mezclados; axe sin violaciones críticas (landing, register, dashboard, editor)

---

### Bloque A — Pulido funcional/visual ✅ *completado* (8 oct 2026, PR #7)

> Repriorización aprobada: antes de teams y de la Fase 2 se pulen los flujos que ya existen.

- **Página `/invites/[token]`** ✅: preview + aceptar; sin gestión de equipos.
- **Command palette / línea de comandos** ✅: sistema de comandos con aliases deterministas tipo AutoCAD + texto libre (`lib/editor/commands.ts`, `Ctrl+K`).
- **Polar tracking + dynamic input** ✅: ángulos incrementales y cotas junto al cursor.
- **Modo solo-lectura** ✅: `access_role` consumido; viewer ve el editor bloqueado.
- Pulido general del editor ✅: estados vacíos, paneles, tooltips, responsive.
- **Criterio cumplido:** link de invitación funciona; viewer ve editor bloqueado; comandos por teclado activan herramientas sin mouse.

### Fase 1 — Colaboración (Semanas 4–7)

> La promesa "que todos vean qué está pasando" exige realtime + roles.
> **Nota de orden:** el backend de semana 4 ya existe; el resto de esta fase se ejecuta después del Bloque A y la Fase 2.

**Semana 4 — Workspaces y roles (backend)** ✅ *completada*
- Migración: `teams`, `team_members` (owner/editor/viewer), `project_shares` — aplicada (0006)
- Endpoints: `POST/GET /teams`, `POST /teams/{id}/invites`, `PATCH /members/{id}/role` + delete/leave/share/unshare
- **Criterio cumplido:** viewer no puede mutar (403 verificado en `test_teams.py`: elementos, documento, historial, load-cases)

**Semana 5 — Invitaciones + UI de equipo** ✅ *completada* (8 oct 2026, PR #6)
- Backend ya implementado: invites por token/email con preview, accept, revoke, expiración y uso único ✅
- Frontend ✅: página de equipo (`app/teams`), carpeta "Teams" en dashboard, api-client de teams (`lib/teams`)
- La página `/invites/[token]` se cubrió en el Bloque A ✅
- **Criterio cumplido:** usuario B acepta invitación y ve proyecto compartido

**Semana 6 — Presencia y edición concurrente**
- WebSocket endpoint (`/ws/projects/{id}`) con auth por sesión
- Presencia: cursores/selecciones en vivo; resolución de conflictos por elemento (last-writer-wins con campo `updated_by`)
- Evaluar CRDT (Yjs + y-websocket) si se requiere edición simultánea del mismo elemento
- **Criterio:** dos navegadores ven cambios del otro <300ms

**Semana 7 — Comentarios y actividad**
- `comments` anclados a elementos/vista; activity feed por proyecto
- **Criterio:** comentario en una viga notifica al equipo en vivo

### Bloque M — Modelo de cargas correcto (antes de la Fase 4)

> El `load_cases` actual es en realidad un *Load Pattern* (terminología SAP2000 verificada en doc. CSI): una colección nombrada de cargas con categoría que por sí sola no produce resultados. Faltan los niveles *analysis case* y *combination*. Corregir antes de construir el solver encima (~10 archivos hoy; mucho más si se hace después).

- Migración: `load_cases` → `load_patterns` + `pattern_type` (dead/live/wind/seismic/snow/self_weight — el tipo alimenta auto-combos)
- Nuevo `analysis_cases`: tipo (static / modal / response_spectrum), parámetros, `depends_on`
- Nuevo `load_combinations`: lista patrón+factor + presets NSR-10 B.2.4
- Alcance: `models/structural_load.py`, `schemas`, `api/loads.py`, `load_service.py`, migración Alembic, tests (`test_loads`, `test_teams`, `test_documents`) + `api-client.ts`, `load-editor.tsx`, `types/structural-load.ts`, i18n
- Regla vigente desde ya: **nada nuevo se construye sobre `load_cases`**
- **Criterio:** `POST /load-combinations` con preset NSR-10 genera 1.4D, 1.2D+1.6L, 1.2D+1.0E+L, 0.9D+1.0E

---

### Fase 2 — Nivel CAD (AutoCAD-like) (Semanas 8–11)

**Semana 8 — Primitivas de dibujo** ✅ *completada*
- Línea, polilínea, arco, círculo, rectángulo, elipse, hatch básico ✅
- Input numérico directo (coordenadas, longitudes, ángulos) + snaps (endpoint, midpoint, center, intersection, perpendicular) ✅ (+ nearest, quadrant, vertex)
- Command palette con aliases + lenguaje natural; polar tracking + dynamic input (iniciados en Bloque A, aquí se completan) ✅
- **Criterio:** dibujar una planta 6×4m solo con teclado ✅ (`e2e/cad-primitives.spec.ts`)

**Semana 9 — Herramientas de edición** ✅ *completada*
- Move, copy, rotate, mirror, array (rectangular/polar), offset, trim, extend, fillet, scale ✅ (`lib/editor/edit-ops.ts` + máquina de sesión en `use-editor-state.ts`)
- Selección múltiple (window/crossing) + grips ✅ (caja azul sólida=window, verde punteada=crossing; grips cuadrados arrastrables por elemento)
- **Criterio:** suite de edición pasa pruebas geométricas unitarias ✅ (56 tests en `edit-ops.test.ts`) + e2e `cad-edit-tools.spec.ts`
- Extra: fix ranking de la paleta de comandos (substring `escalera`/`scale` armaba Draw stair), race de teclado con closures obsoletos (stateRef), rects/hatches rotados renderizan con `rotation` real

**Semana 10 — Capas, bloques y estilos** 🟡
- ✅ Layer manager completo: visibilidad, bloqueo y color ya existían; se añaden **tipo de línea** (`solid/dashed/dotted/dashdot/center/hidden`) y **grosor** (lineweight en mm → stroke) en `design_settings.layers`, con resolución **ByLayer + override por elemento** (`resolveLineStyle` en `lib/editor/layers.ts`)
- ✅ **Bloques/símbolos reutilizables**: biblioteca por proyecto en backend (`project_blocks` + API firmada), panel *Blocks* con buscar/crear-desde-selección/insertar/renombrar/importar-exportar JSON, inserción con preview fantasma y click único (INSERT repetido hasta Esc), explode selección→elementos (`explodeBlockRef`), refs escalables/rotables por grips
- ✅ `block_ref` como elemento canónico (`rect` mode → transformaciones CAD gratis); items como snapshots sin id (keys `ref:index`); 3D expande refs a geometría real
- ✅ Tests: `blocks.test.ts` (12) + `layers.test.ts` resolveLineStyle (5) + comandos explode/blocks + e2e `blocks.spec.ts`
- **Criterio:** importar/exportar bloque como JSON desde el panel ✅
- 🔴 Pendiente dentro de la semana: purge/audit de bloques sin uso (Semana 24), plot styles CTB/STB (Semana 22), linetypes personalizados con texto/formas complejas

**Semana 11 — Acotación y anotación profesional**
- Cotas lineales/alineadas/angulares/radiales, leaders, estilos de cota (DIM-style)
- Tablas básicas, campos de texto con formato
- **Criterio:** plano acotado legible a escala 1:50

---

### Fase 3 — Entidades estructurales paramétricas (Semanas 12–14)

> El mínimo "BIM estructural" que SAP2000 necesita: geometría + material + sección.
> Puertas/ventanas solo como vanos simples; familias e IFC quedan para el futuro.

**Semana 12 — Niveles, retículas y planos de trabajo**
- Datums: niveles editables y ejes de retícula (grid lines); generación de vistas por nivel
- Diafragma rígido/semirrígido por nivel (constraint sobre `story_id`) — sin esto losas/muros no participan del análisis sísmico (verificado: *diaphragm constraints* en doc. CSI)
- Plantillas paramétricas: retícula N×M × H pisos → pórtico completo generado (verificado: *New Model templates* de SAP2000)
- **Criterio:** alzar un nivel propaga alturas de columnas/muros asociados

**Semana 13 — Elementos estructurales con sección y material**
- Columnas, vigas, viguetas, losas (maciza y **aligerada**), muros portantes
- `materials` y `sections` como **entidades propias** (tablas + catálogo; f'c/densidad/E, fy/fu/E / A, I, J, dims + perfiles AISC), referenciadas por `element.section_id`/`material_id` — no valores sueltos en `properties` JSONB
- Migración + endpoints; parámetros tipo/instancia
- **Criterio:** definir un pórtico completo (columnas + vigas + losa aligerada) con materiales reales

**Semana 14 — Vanos y elementos arquitectónicos mínimos**
- Muros con vanos; puertas/ventanas como aberturas paramétricas simples (ancho/alto/antepecho)
- **Criterio:** muro con puerta actualiza el hueco al moverla

> **Spike de solver (en cualquier punto de semanas 12–14):** evaluar PyNite vs. numpy/scipy propio vs. servicio externo — verificar licencia, madurez y soporte de secciones no prismáticas/P-Δ/placas. El resultado decide la implementación de la Semana 17.

---

### Fase 4 — Análisis estructural (SAP2000-like, NSR-10) (Semanas 15–21)

> El corazón del producto: cargas reales, norma colombiana, resultados verificables.

**Semana 15 — Modelo analítico**
- Auto-generación de nodos/barras desde la geometría; apoyos (empotrado, articulado, rodillo), articulaciones (releases), rigid offsets
- Persistencia: `analysis_models`, `analysis_nodes`, `analysis_members`
- Panel de validación del modelo (nudos sin apoyo, barras sin sección/material) antes de analizar — patrón "repair model" (referencia: SkyCiv)
- **Criterio:** pórtico 2D produce modelo analítico correcto

**Semana 16 — Casos y combinaciones de carga (NSR-10 cap. B)**
- **Depende del Bloque M:** con `load_patterns`/`analysis_cases`/`load_combinations` ya en el esquema, esta semana es presets + distribución + UI, no diseño de datos
- Combinations con presets NSR-10: 1.4D, 1.2D+1.6L, 1.2D+1.0E+L, 0.9D+1.0E; auto-combos sugeridos por `pattern_type`
- Cargas de área con distribución tributaria automática a vigas/viguetas; cargas por elemento (viga y columna)
- **Criterio:** combinación 1.2D+1.6L genera envolvente correcta

**Semana 17 — Solver FEM (backend)**
- Servicio de análisis: stiffness method pórtico 3D — motor decidido por el spike de semanas 12–14 (`numpy`/`scipy` propio vs. PyNite vs. servicio externo); soporta armaduras planas y pórticos espaciales
- Endpoint `POST /projects/{id}/analysis` asíncrono (job + polling/WebSocket)
- **Criterio:** pórtico de referencia reproduce resultados publicados (benchmark vs. solución manual)

**Semana 18 — Análisis sísmico NSR-10 (cap. A)**
- Zonas de amenaza sísmica de Colombia (Aa, Av por municipio), espectro de diseño elástico (Fa, Fv, Ss, S1, Sd1)
- Método de fuerzas laterales equivalentes; verificación de deriva de piso (límites NSR-10)
- **Criterio:** edificio de referencia en Bogotá produce cortante basal y derivas correctas

**Semana 19 — Resultados y diagramas**
- Diagramas de momento/cortante/axial, deformada, reacciones, envolventes; mapa de derivas
- Vista de resultados en 3D y por elemento
- Vista de **tabla interactiva del modelo** (nodos, barras, cargas, resultados) — "Interactive Database Editing" (SAP2000) / Datasheets (SkyCiv): selección y edición desde la tabla
- Evaluar split view 2D+3D simultáneo (SAP2000 permite hasta 4 ventanas)
- **Criterio:** diagramas interactivos con valores al hover

**Semana 20 — Diseño en concreto reforzado (NSR-10 cap. C / ACI 318)**
- Vigas: flexión y cortante (Mu/φMn, Vu/φVn); columnas: diagrama de interacción P-M; losas aligeradas: refuerzo por nervio
- Chequeos D/C por elemento, cuantías mínimas/máximas, requisitos de ductilidad sísmica según DMO/DMI/DES
- **Criterio:** memoria de cálculo de una viga real coincide con diseño manual

**Semana 21 — Diseño en acero + memoria en servidor**
- Perfiles AISC: tensión, compresión (pandeo), flexión, interacción (H1-1); conexiones básicas
- Resultados y memoria de cálculo persistidos en servidor (trazabilidad, ya no solo cliente)
- **Criterio:** memoria exportable reproducible desde servidor

---

### Fase 5 — Entregables y producto (Semanas 22–24)

**Semana 22 — Láminas (sheets)**
- Layouts con cajetín, viewports a escala, numeración
- **Criterio:** PDF de lámina A1 con 3 viewports a escalas distintas

**Semana 23 — Reportes y exportación**
- Memoria de cálculo → PDF/Markdown; paquete de entrega (planos + memoria + modelo)
- Export **DXF** (parser propio o `dxf-parser`); export PDF vectorial con escala
- **Criterio:** un clic genera entrega técnica completa

**Semana 24 — Endurecimiento**
- OAuth (Google/Microsoft) activado; onboarding/tutoriales
- Performance: lazy loading de editor, WebGL budget, rate limiting backend
- Auditoría de seguridad (cookies, CORS, device proofs)
- **Criterio:** release candidate publicado

---

### Fase 6 — IA, factibilidad y enseñanza (fechas ❓ por definir)

> Actualización de visión (16 oct 2026): el producto debe sentirse como **Canva para estructuras** — le dices a la IA qué quieres y lo construye — con validación temprana de factibilidad y un modo que enseña a calcular. Referencias externas en §7.
>
> **Nota de orden:** IA-1 y EDU-1 pueden empezar temprano porque se apoyan en piezas que ya existen (`commands.ts`, `edit-ops.ts`, memoria de `member-design.ts`). IA-2 y la versión completa de FEA-1 dependen de las semanas 12–13 (niveles, secciones, tipos de losa). La programación exacta queda ❓ por definir según repriorización.

#### IA-1 · Intérprete de lenguaje natural → acciones del editor ❓ por definir

- Backend `POST /projects/{id}/ai/interpret`: prompt → plan de acciones en JSON (tool-calling sobre la superficie de comandos ya determinista — `commands.ts`, `edit-ops.ts`, plantillas paramétricas de la semana 12)
- Frontend: previsualización del plan + confirmación del usuario antes de mutar el documento — patrón *draft → validate → apply* (verificado en StructureClaw, §7)
- La IA **nunca** escribe directo al documento: todo cambio pasa por el modelo versionado (semana 2) y es deshacer
- ❓ Por definir: proveedor LLM (Anthropic / OpenAI / modelo local), streaming vs. request/response, UX (chat lateral vs. command palette extendida), coste por proyecto, privacidad (datos del proyecto a un tercero)
- **Criterio:** «dibuja una viga de 6 m y duplícala cada 3 m» produce el plan correcto, el usuario confirma y el undo restaura el estado

#### IA-2 · Generador paramétrico de edificios (depende de semanas 12–13)

- «Crea un edificio de 7 pisos, retícula 4×3 @ 5 m, primer piso placa aligerada y los demás placa maciza» → niveles + ejes + columnas + vigas + losas con el tipo correcto por piso
- Model checker basado en reglas (ref. Text2BIM, §7) que valida conectividad, secciones asignadas y vanos antes de aplicar el plan
- **Criterio:** el prompt de ejemplo genera el modelo correcto y editable en <30 s

#### FEA-1 · Modo factibilidad / pre-factibilidad

- Panel «¿Es viable?» con reglas de pulgar verificables: luz/peralte (aligerada vs. maciza), áreas tributarias y pre-dimensionamiento de columnas, cortante basal estimado (método estático NSR-10), deriva de piso estimada, carga por uso
- **MVP temprano** (inputs manuales, sin Fase 3) → **versión completa** lee el modelo real (tras semanas 12–13 + Fase 4)
- Comparador de esquemas A/B y resumen exportable de una página para el cliente — patrón de producto verificado en TestFit/Forma (§7)
- ❓ Por definir: fuente normativa exacta de cada regla de pulgar (validar con ingeniero); si vive como modo del editor o página independiente
- **Criterio:** con 5 inputs (pisos, luces, uso, ciudad, sistema) el panel devuelve semáforo de factibilidad + lista de riesgos

#### EDU-1 · Modo enseñanza («Aprende a calcular»)

- `member-design.ts` ya produce pasos (título, fórmula, sustitución, resultado) — extender cada paso con el *porqué*, referencia NSR-10/ACI y glosario (cortante, momento, cuantía, φ, D/C…)
- Ejemplos guiados interactivos: el usuario cambia una carga y ve cómo cambia el diagrama de cortante
- ❓ Por definir: formato de contenido (MDX estático vs. JSON estructurado en la app), dentro del editor vs. sección `/learn` separada
- **Criterio:** desde una viga real el usuario abre «¿cómo se calculó esto?» y recorre el cálculo de cortante paso a paso con explicación

---

### Futuro (post-MVP) — Nivel BIM (Revit-like)

- Modelo paramétrico completo: familias editables (2D+3D), techos, escaleras, catálogo de tipos
- Documentación BIM: cortes, elevaciones, marcos de corte, vistas 3D acotadas
- **IFC4** export/import (openBIM) — única opción realista de interoperabilidad BIM
- Modelado 3D avanzado: extrusión, booleanos, edición de caras/aristas
- Import DWG nativo (LibreDWG/ODA o servicio externo)
- Análisis avanzado: P-Delta, no lineal, diseño de cimentaciones, muros de corte

---

## 4. Dependencias y decisiones clave

| Decisión | Opciones | Cuándo decidir |
|---|---|---|
| Edición concurrente | Last-writer-wins vs. CRDT (Yjs) | Semana 6 |
| Solver FEM | Python in-process (`numpy`/`scipy`) vs. PyNite vs. worker/servicio externo | Spike semanas 12–14 → implementa semana 17 |
| Idioma UI | ES primero + i18n preparado | Semana 3 |
| Formato intercambio | DXF ahora; IFC4 cuando llegue BIM | Semana 23 / futuro |
| Infra realtime | WebSocket en FastAPI vs. servicio dedicado | Semana 6 |
| Norma de diseño | NSR-10 Colombia primero; ACI 318/AISC parametrizable después | Semana 16 |
| Monetización futura | Gratis con límites vs. open-core | Post-MVP |
| Proveedor LLM del asistente | Anthropic vs. OpenAI vs. modelo local/self-hosted | ❓ Por definir — antes de IA-1 |
| UX del asistente | Chat lateral vs. command palette extendida vs. ambas | ❓ Por definir — mockup antes de IA-1 |
| Guardarraíles IA | Preview + confirmación obligatoria; la IA nunca «aprueba» un diseño | IA-1 |
| Fuente de reglas de factibilidad | NSR-10 + reglas de pulgar clásicas (luz/peralte, áreas tributarias) — requiere validación de ingeniero | FEA-1 |
| Contenido educativo | MDX estático vs. JSON estructurado dentro de la app | EDU-1 |

## 5. Riesgos principales

1. **Solver FEM** es el componente técnico más complejo: validar contra casos de referencia publicados antes de construir UI encima.
2. **NSR-10** es norma viva: los cálculos deben ser revisados por un ingeniero estructural matriculado; la app asiste el diseño, no reemplaza la firma profesional.
3. **Realtime + CRDT**: prototipar en semana 6 antes de comprometer el modelo de datos.
4. **DWG** es formato cerrado: DXF primero; DWG vía conversor externo en fase futura.
5. **Alcance**: AutoCAD+SAP2000 completos son años de trabajo — este plan llega a un **MVP funcional** por disciplina, no a paridad total.
6. **Precisión del LLM**: el modelo puede alucinar geometría o propiedades — mitigar con plan JSON validado por reglas + preview obligatorio antes de aplicar (patrón *checker* de Text2BIM).
7. **Coste/latencia de inferencia**: presupuesto por proyecto ❓ por definir; la paleta determinista sigue funcionando sin IA.
8. **Privacidad**: datos del proyecto hacia un LLM de terceros — definir consentimiento explícito y opción local antes de IA-1.
9. **Enseñanza ≠ certificación**: el modo educativo ilustra el método; la responsabilidad profesional sigue en el ingeniero (ver riesgo 2).

---

## 6. Inventario de brechas vs. AutoCAD y SAP2000

Funciones que los productos de referencia tienen y ISOMORF aún no. Cada fila indica si ya está cubierta por una semana del plan o es una brecha nueva que requiere fase adicional.

### 6.1 Nivel CAD (referencia: AutoCAD)

| Función | Estado | Fase destino |
|---|---|---|
| Primitivas: línea, polilínea, arco, círculo, rectángulo, elipse, hatch | ✅ Hecho (semana 8) | Semana 8 |
| Input numérico directo + snaps (endpoint, midpoint, center, intersection, perpendicular) | ✅ Hecho (semana 8) | Semana 8 |
| Edición: move, copy, rotate, mirror, array, offset, trim, extend, fillet, scale | ✅ Hecho (semana 9) | Semana 9 |
| Selección window/crossing + grips | ✅ Hecho (semana 9) | Semana 9 |
| Capas completas (visibilidad, bloqueo, color, tipo de línea, grosor) + bloques/símbolos | � En progreso (implementado; e2e/integración por verificar) | Semana 10 |
| Cotas profesionales (alineadas, angulares, radiales), leaders, estilos DIM, tablas | 📋 Planeado | Semana 11 |
| **Línea de comandos** (command line con autocompletado y alias) | 🔴 Brecha | Bloque A (inicia como command palette) + Semana 8 |
| **Ortho / polar tracking** (modos ORTHO/POLAR con ángulos incrementales) | 🔴 Brecha | Bloque A + Semana 8 |
| **Snap adicionales**: tangent, nearest, apparent intersection, node | 🔴 Brecha | Semana 8-9 |
| **Dynamic input** (tooltip de cotas junto al cursor) | 🔴 Brecha | Bloque A + Semana 8 |
| **Xrefs / referencias externas** (vincular otro proyecto como fondo) | 🔴 Brecha | Post-MVP (requiere permisos entre proyectos — Semana 4-5 primero) |
| **Linetypes personalizados + plot styles (CTB/STB)** | 🔴 Brecha | Semana 10 / 22 |
| **Markup / redline / revisión con nubes** | 🔴 Brecha | Semana 7 (comentarios) o 22 (láminas) |
| **Restricciones paramétricas** (geométricas y dimensionales) | 🔴 Brecha | Post-MVP |
| **Medición** (distancia, área, ID de punto, listado de propiedades) | 🔴 Brecha | Semana 11 |
| **Purge / audit del documento** (limpiar capas/bloques sin uso) | 🔴 Brecha | Semana 24 (endurecimiento) |
| **Layout/paperspace con viewports** | 📋 Planeado | Semana 22 |
| Import/export DXF, PDF vectorial | 📋 Planeado | Semana 23 |
| **Import DWG nativo** | ⚪ Descartado para MVP | Futuro (riesgo #4) |

### 6.2 Nivel análisis (referencia: SAP2000)

| Función | Estado | Fase destino |
|---|---|---|
| Modelo analítico auto-generado (nodos/barras), apoyos, releases, rigid offsets | 📋 Planeado | Semana 15 |
| Combinaciones NSR-10 + distribución tributaria de cargas de área | 📋 Planeado | Semana 16 |
| Solver FEM pórticos 3D (stiffness method) | 📋 Planeado | Semana 17 |
| Análisis sísmico fuerzas laterales equivalentes + derivas NSR-10 | 📋 Planeado | Semana 18 |
| Diagramas M/V/N, deformada, reacciones, envolventes | 📋 Planeado | Semana 19 |
| Diseño concreto (vigas, columnas P-M, losas aligeradas) | 📋 Planeado | Semana 20 |
| Diseño acero AISC + memoria en servidor | 📋 Planeado | Semana 21 |
| **Elementos shell/área en el solver** (muros y losas mallados, no solo pórticos) | 🔴 Brecha | Semana 17 extendida o semana nueva — el solver actual solo prevé barras |
| **Análisis modal + espectro de respuesta** (más allá del método estático equivalente) | 🔴 Brecha | Semana 18 extendida |
| **Time history** (registros sísmicos) | 🔴 Brecha | Post-MVP |
| **P-Delta** | ⚪ Ya en post-MVP | Futuro |
| **Análisis de pandeo (buckling)** | 🔴 Brecha | Semana 17/21 extendida |
| **Cargas móviles / vehiculares** (puentes) | 🔴 Brecha | Post-MVP |
| **Diafragmas rígidos/semirrígidos** por nivel | 🔴 Brecha | Semana 12 (niveles) + 18 |
| **Tablas de base de datos** (vista/edición tabular del modelo — firma de SAP2000) | 🔴 Brecha | Semana 19 (resultados) o semana nueva |
| **Plantillas paramétricas** (retículas, pórticos, tanques pre-armados) | 🔴 Brecha | Semana 12 |
| **Section designer** (secciones compuestas/arbitrarias) | 🔴 Brecha | Semana 13 extendida |
| **Cables, tendones, elementos no lineales (bisagras, pushover)** | 🔴 Brecha | Post-MVP |
| **Staged construction** (análisis por etapas constructivas) | 🔴 Brecha | Post-MVP |
| **API pública / scripting** (equivalente al Open API de SAP2000) | 🔴 Brecha | Post-MVP |

### 6.3 Priorización sugerida para las brechas nuevas

1. **Impacto inmediato en MVP**: medición + capas completas + cotas (semanas 10-11) — lo que un usuario de CAD extraña después de dibujar y editar (ORTHO/polar + dynamic input ya resueltos en Bloque A).
2. **Diferenciador de visión**: IA-1 temprano (intérprete sobre los comandos que ya existen) entrega el «momento Canva» antes de que exista el modelo paramétrico completo.
3. **Corazón estructural**: shell/área en solver, análisis modal/espectro, diafragmas (semanas 15-21) — sin ellos los muros y losas no participan del análisis.
4. **Diferenciadores de producto**: tablas de base de datos, plantillas paramétricas, modo factibilidad, modo enseñanza.
5. **Post-MVP confirmado**: xrefs, restricciones paramétricas, time history, pushover, staged construction, API pública.

### 6.4 Asistente IA y UX (referencia: Structon.AI / StructureClaw / Canva)

| Función | Estado | Fase destino |
|---|---|---|
| Intérprete NL → acciones (tool-calling + preview/confirm) | 🔴 Brecha | Fase 6 (IA-1) |
| Generador paramétrico de edificios por prompt | 🔴 Brecha | Fase 6 (IA-2, tras semanas 12-13) |
| Chat con contexto de selección/modelo | 🔴 Brecha | Fase 6 (IA-1) |
| Modo factibilidad/pre-factibilidad con semáforo | 🔴 Brecha | Fase 6 (FEA-1) |
| Modo enseñanza: explicación paso a paso + glosario | 🔴 Brecha | Fase 6 (EDU-1) |
| Memoria de cálculo paso a paso | 🟡 Parcial | existe en `member-design.ts`; falta capa pedagógica (EDU-1) |
| Onboarding tipo plantilla («elige un edificio ejemplo y modifícalo») | 🔴 Brecha | Fase 6 / semana 24 |

---

## 7. Referencias de investigación

### Productos y plataformas

- [Structon.AI](https://structon.ai/) — software estructural *agent-native*: chat → modelo → análisis → chequeos → reporte. Referencia directa de la visión IA.
- [StructureClaw](https://github.com/structureclaw/structureclaw) — workspace open source: `describe → draft model → validate → analyze → code-check → report` con LLM y motores de análisis reales.
- [TestFit](https://www.testfit.io/) — plataforma de factibilidad: iterar esquemas y validar el negocio antes de modelar en detalle.
- [Autodesk Forma](https://www.autodesk.com/products/forma-building-design/overview) — diseño esquemático en la nube con análisis temprano y comparación de opciones.
- [Zookeeper (Zoo)](https://zoo.dev/docs/zoo-design-studio/zookeeper) — agente IA para CAD sobre un lenguaje legible por LLM.

### Investigación

- [Text2BIM](https://arxiv.org/html/2408.08054v2) — framework multi-agente LLM que genera modelos BIM editables desde lenguaje natural, con *model checker* basado en reglas.
- [IFC-Copilot](https://show2instruct.github.io/ifc-copilot/) — tools JSON invocables por LLM (MCP-compatible) para crear/editar modelos de edificio.
- [Agent-Driven Parametric 3D Building Generation](https://papers.cumincad.org/data/works/att/caadria2025_420.pdf) — NL → parámetros → modelo 3D; ~78% menos tiempo de modelado.
