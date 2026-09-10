# Design QA — Tus Estaciones

## Viewport

- 390 × 844 px in Chrome.
- Reference: `C:/Users/Matu/Desktop/Mockup de La Estación_ estaciones y recuerdos.png`.

## Verified flows

- Home → Mis estaciones.
- Mis estaciones → Buscar estación / cámara.
- Retículo de detección → Estación desbloqueada.
- Estación desbloqueada → Detalle de estación.
- Detalle → Cámara / crear foto.
- Cámara → Resultado / compartir.
- Menú → Próximas fechas.
- Bottom navigation → Mi pasaporte.

## Visual checks

- Full-bleed event photography and dark photo overlays.
- 390 px mobile composition with centered desktop presentation above 600 px.
- Bottom navigation, rectangular cards, thin borders, warm cream CTA, and champagne selected states.
- Realistic local demo imagery for event, lake, mountain, fire, moon, and camera scenes.
- Event content and image paths sourced from `src/config/events/laEstacion.ts`.

## Scope checks

- Fake local navigation only.
- No backend, auth, real camera, AR, QR, API, upload, map, PWA, or admin features.

## Motion QA

- Screen transitions use a layered 400ms crossfade with subtle translateY and scale.
- Station cards, event card, secret card, result, and unlocked content use short staggered reveals.
- Buttons, cards, tabs, and selectors use subtle active feedback without resizing.
- Search sequence verified: `BUSCANDO` → `LOGO DETECTADO` → `DESBLOQUEANDO` → unlocked screen.
- Menu uses a short lateral entrance and overlay fade.
- Reduced-motion fallback is included.

## Functional loop QA

- `?resetDemo=true` clears the namespaced demo state and removes the query parameter.
- Reset state: Passport shows 17 stations, Sunset is available in My Stations, and the Photo Studio option is locked.
- Discovery completion persists Sunset as found and updates Passport to 18 stations.
- Refresh preserves the found state and keeps Sunset enabled in the Photo Studio selector.

final result: passed
