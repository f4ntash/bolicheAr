# Auditoría UX/UI de NOCTRA en producción

- **Fecha:** 1 de octubre de 2026
- **Referencia:** <https://corsteno.com/noctra/>
- **Resoluciones revisadas:** 390×844, 430×932, 768×1024 y 1280×720
**Método:** recorrido de estados y DOM/computed styles; contraste y medidas cotejados con el código local y el sistema visual aprobado. No se generaron screenshots. No se concedió permiso de cámara.

## Lista priorizada previa a los cambios

Se agrupan hallazgos por causa raíz; una misma familia tipográfica cuenta como un problema, aunque aparezca en varias pantallas.

### P0 — 3 problemas

| ID | Pantallas | Hallazgo y evidencia | Causa técnica |
|---|---|---|---|
| P0-1 | Explorar, Passport, Hidden Frequency | Al completar los descubrimientos de la demo, el recorrido queda en `4/4`, pero Hidden Frequency conserva el estado «ESTÁS CERCA» y no ofrece una acción para desbloquearla. No se llega al reveal oculto por la ruta normal. | `completeStationDiscovery` marca `secretRevealSeen` antes de mostrar el reveal; la última estación NOVA continúa a `sponsor`. `unlockSecretStation` solo se ejecuta desde el reveal que queda omitido (`src/App.tsx`). |
| P0-2 | Reveal de Main Stage; responsive | El panel se sale horizontalmente: a 390 px llega a x=417 y a 430 px a x=460. En 1280×720, el titular escala hasta 72 px dentro del shell de 390 px, ocupa la zona de acciones y la página hereda 844 px de alto. | `.noctra-reveal__copy` conserva `width:min(100%, 570px)` pese a `left/right`; el reveal hereda `min-height:844px` de `.motion-layer.incoming`, y el tamaño del titular usa `vw` del navegador completo. |
| P0-3 | Reveal de Main Stage | «DESBLOQUEASTE», encima del bloque lime, queda en tinta blanca translúcida y resulta de bajo contraste. | Regla heredada de `.noctra-reveal__reward span` (`color:rgba(243,238,231,.56)`) gana al color de texto del reward lime. |

### P1 — 8 problemas

| ID | Pantallas | Hallazgo y evidencia | Causa técnica |
|---|---|---|---|
| P1-1 | Home, Explorar, Discover, Detail, Passport, reward y Photo Studio | Se muestran imágenes de `experiences/noctra/art/*.webp`, que el inventario aprobado marca explícitamente `PLACEHOLDER` y describe como arte de una etapa anterior. | `src/config/events/noctra.ts` deriva hero, estaciones, historial, filtros, cámara y reward de `art(name)`. |
| P1-2 | Menú, Explorar, Discover, Momentos, Edición, Fechas, Line Up, La Experiencia, Passport, Tu Noche, Reward, Photo Studio y reveal | Metadatos y controles bajan a 6–10 px; hay labels de botones de 7–10 px y texto secundario de 10–12 px. No respetan los mínimos mobile del brief. | Reglas tipográficas dispersas en CSS NOCTRA y herencia de `.phone-screen`, `.menu-screen`, `.stations-screen`, `.detail-screen` y componentes compartidos. |
| P1-3 | Discover, error de cámara | El mensaje de error de cámara aparece junto a «Buscando señal», dejando dos estados incompatibles en pantalla. | El estado de error se añade sin reemplazar `searchingLabel` en el componente compartido Discover. |
| P1-4 | Home, Edición, Detail, Tu Noche, Momentos y assets | La noche activa aparece como 29.09.26 en Home/Edición, 28 SEP 2026 en Detail/Tu Noche y 01 OCT 2026 en recuerdos creados durante la revisión; los SVG también imprimen 29.09.26. | Fecha de `night-03` configurada como 28 de septiembre; UI de Momentos mezcla fecha de edición y timestamp de guardado. |
| P1-5 | Reward listo/desbloqueado y Passport | El estado superior dice que el acceso está listo/desbloqueado mientras el pase interno todavía ordena «Completá 4 momentos y desbloqueá Backstage Access». | `FinalRewardScreen` muestra siempre `definition.goal.description`, sin adaptar el texto al estado. |
| P1-6 | Home → Explorar | Home presenta progreso fijo `03/04 · BACKSTAGE`; al entrar en una demo limpia, Explorar muestra `1 / 4`. | El progreso de portada es texto estático y no deriva del estado persistido. |
| P1-7 | Explorar, Passport, Detail, Share y navegación | Algunos botones de icono del Header compartido tienen nombre accesible vacío; la navegación inferior sigue usando texto de 11 px. | `Header` y `BottomNav` compartidos no reciben labels específicos en varias rutas NOCTRA; override tipográfico inferior queda por debajo de 14 px. |
| P1-8 | Resultado de Photo Studio / compartir | La columna de acciones rebasa 2 px el ancho de 390 px (borde derecho x=392); el screen reporta `scrollWidth=392`. | Ancho/padding del layout compartido `share-card` no se reduce con el wrapper NOCTRA. |

**Total previo:** 11 issues (3 P0, 8 P1, 0 P2). Los problemas se cuentan por causas raíz independientes, no por cada repetición visual.

## Inventario de pantallas y estados recorridos

| Vista / estado | Resultado de la revisión previa a fixes |
|---|---|
| Home | Collage y paleta aprobada presentes; progreso no coincide con una demo limpia (P1-6); usa hero placeholder (P1-1). |
| Menú | Variante editorial NOCTRA. Labels demasiado pequeños; navegación agrupada y operativa (P1-2). |
| Explorar | Reutiliza `Stations` y clases `.stations-screen`; funciona, pero presenta tipografía micro y progreso de 1/4; el estado final de secreto queda bloqueado (P0-1, P1-2). |
| Discover | Idle, fallback de cámara, error y demo CTA revisados. Permiso no concedido. Error funcional con copy de búsqueda residual (P1-3); usa arte placeholder (P1-1). |
| Detail / First Pulse | Detail compartido operativo y con scroll; botón Photo Studio alcanzable al desplazar. Hero y miniaturas usan arte placeholder; metadatos chicos (P1-1, P1-2). |
| Reveal / Main Stage | Reveal visual activo; overflow horizontal, en 1280×720 el panel invade acciones, y el rótulo sobre lime tiene bajo contraste (P0-2, P0-3). |
| NOVA Drop | Vista inicial, detección demo, reveal y estado completado revisados; controles operativos, con parte de los labels demasiado pequeños (P1-2). |
| Hidden Frequency | Estado catalogado como secreto/near; no se pudo alcanzar su reveal por el flujo normal, que es el P0-1. |
| Final Drop / Backstage | Locked, ready y unlocked revisados mediante reward compartido; instrucción interna contradictoria en ready/unlocked (P1-5). |
| Passport | Parcial y 4/4 revisados; historial aún muestra placeholder; estado oculto se queda en «ESTÁS CERCA»; texto muy pequeño (P0-1, P1-1, P1-2). |
| Photo Studio | Cámara unavailable/fallback y generación demo revisadas. Foto, Story y Post no desbordan en las medidas revisadas; resultado de compartir excede 2 px (P1-8). Labels secundarios pequeños (P1-2). |
| Tu Noche | Resumen y scroll revisados; fecha actual discrepante con Home/Edición. |
| Próximas Fechas | Pósters de collage específicos NOCTRA; metadata inferior a 11 px (P1-2). |
| Line Up | Póster collage; horas/roles/stage y copy secundarios bajan hasta 6–10 px (P1-2). |
| Momentos | Catálogo de cinco piezas y estados partial/locked/unlocked revisados; metadata de 6–10 px; fecha de colección inconsistente (P1-2, P1-4). |
| Edición | Composición específica NOCTRA, con fecha distinta de Detail/Tu Noche y metadata pequeña (P1-2, P1-4). |
| La Experiencia | Página NOCTRA específica; labels y texto de apoyo requieren aumento (P1-2). |
| Carga, demo y confirmación | Loading de Photo Studio, CTA de detección demo y confirmación de reinicio identificados. El reinicio no se confirmó ni ejecutó. No se observó un modal viejo activo. |

## Correcciones aplicadas y validación posterior

Los 11 hallazgos quedaron corregidos dentro del alcance NOCTRA. La composición collage, los colores y los assets aprobados de `photos/` se mantienen.

- **P0-1:** la última estación NOVA conserva su activación; al volver al recorrido, se abre Hidden Frequency si ya se completaron las señales. El pase de Explore también permite reabrir el reveal en sesiones antiguas que quedaron completas pero no lo vieron.
- **P0-2:** el ancho del copy vuelve a respetar el shell; el titular queda limitado al ancho de la experiencia. Se corrigió la altura heredada del reveal y se adaptó su posición a ventanas bajas.
- **P0-3:** el texto de reward usa tinta oscura sobre el bloque lime.
- **P1-1:** las referencias de runtime usan fotografías aprobadas de `photos/` en vez de placeholders de `art/`.
- **P1-2:** controles visibles usan 14 px; metadata, 11 px como mínimo. Revisé menú, Explore, páginas editoriales y compartir sin encontrar texto visible menor a 11 px.
- **P1-3:** en fallback de cámara, Discover muestra «CÁMARA NO DISPONIBLE» y oculta la línea de búsqueda.
- **P1-4:** Night 03 usa 29.09.26 / 29 SEP 2026; Momentos toma la fecha de la edición, no la de guardado.
- **P1-5:** el pase de la recompensa cambia su descripción al estado listo o desbloqueado solo para NOCTRA.
- **P1-6:** Home muestra conteo y estado de progreso reales.
- **P1-7:** los iconos de navegación NOCTRA tienen nombre accesible; la navegación inferior usa 14 px.
- **P1-8:** el resultado de compartir cabe en el ancho disponible y no crea overflow horizontal.

| Viewport / flujo | Resultado local posterior |
|---|---|
| Home · 390×844, 430×932, 768×1024 y 1280×720 | Sin overflow horizontal; cada layout usa el ancho disponible. Con el estado persistido 4/4, portada y reward muestran `04 / 04` y `READY TO OPEN`; el disclaimer queda al final del scroll. |
| Reveal · 390×844 | Panel y reward dentro del shell; 24 px entre reward y acciones; sin overflow. |
| Reveal · 430×932 | 46 px entre reward y acciones; sin overflow. |
| Reveal · 768×1024 | Shell centrado de 390×1024; 84 px entre reward y acciones; sin scroll sobrante. |
| Reveal · 1280×720 | Titular limitado a 48 px; 95 px entre reward y acciones; shell de 390×720 y documento de 1280×720. |
| Hidden Frequency | Completar First Pulse, Main Stage y NOVA llega a 4/4; volver desde NOVA abre Hidden Frequency; desbloquearla persiste `hidden-frequency` y permite crear un momento. |
| Camera fallback | Sin permiso de cámara; no quedan señales de «Buscando» junto al mensaje de error y el reticle de demo sigue disponible. |
| Photo Studio / compartir | Share card sin overflow horizontal en 390, 430, 768 y 1280 px; botones de acción a 14 px. |
| Edición, Fechas, Line Up, Momentos, La Experiencia y NOVA | Navegación operativa a 390×844; no hay texto visible menor a 11 px. Momentos, Edición y La Experiencia conservan scroll vertical para su contenido. |

La revisión fue por DOM y estilos computados; no se capturaron screenshots ni se concedió permiso de cámara. No se ejecutó la acción de reiniciar demo.

### Verificaciones solicitadas

- `npm run typecheck` — correcto.
- `npm run build:noctra` — correcto. Vite mantiene avisos no bloqueantes para referencias absolutas `/noctra/...` que se resuelven en runtime; confirmé que los tres archivos de foto seleccionados existen en `public/`.
- `git diff --check` — correcto; Git solo informó la conversión habitual LF→CRLF en archivos modificados.

## Herencia técnica identificada

- **Estructura compartida:** `Stations`, `Discover`, `StationDetail`, `Passport`, `Upcoming`, `PhotoStudio`, `ShareResult` y `FinalRewardScreen` permanecen en `src/App.tsx`/`src/engagement/EngagementUI.tsx`. Runtime conserva clases como `.phone-screen`, `.stations-screen`, `.detail-screen`, `.passport-screen`, `.studio-screen` y `.share-screen`, estilizadas por CSS global y retocadas por wrappers `.noctra-app`.
- **Reglas heredadas que aún ganan:** anchura de `.noctra-reveal__copy`; color bajo contraste de `.noctra-reveal__reward span`; layout del `share-card`; labels globales y compartidos por debajo del mínimo.
- **Assets heredados:** todas las referencias visibles del config a `art/*.webp` están marcadas PLACEHOLDER en `asset-inventory.csv`; no son parte del sistema collage aprobado.
- **Copy:** no se encontró copy de La Estación renderizado en las pantallas recorridas. La frase de progreso fija de Home y el estado Discover sí son copy/cálculo incongruentes dentro de NOCTRA.
- **Límite de seguridad de alcance:** los componentes compartidos necesarios se ajustaron con guardas `isNoctra` / `experience.config.id === 'noctra'`; los overrides visuales se limitan a `.noctra-app`. La Estación, La Fábrica y Dahaus no reciben cambios de comportamiento.

## Referencias de sistema visual

- `.superdesign/noctra-visual-system.md`: papel `#F8F4E9`, tinta, collage, fotografía, recortes, tipografía grande; evita texto pequeño blanco sobre lime y declara los assets `art/` como placeholders.
- `public/experiences/noctra/asset-inventory.csv`: escenas aprobadas en `photos/`, composiciones en `moments/`, badges, rewards, passes y frames.
- `src/experiences/noctra/noctraDesignTokens.css`: tokens de color/tipografía del wrapper NOCTRA.
