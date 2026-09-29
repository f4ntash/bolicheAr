# NOCTRA — Sistema visual y biblioteca de assets

Este documento es la referencia visual aprobada para las próximas etapas de NOCTRA. Reemplaza, para el trabajo futuro, la dirección oscura descrita en `.superdesign/noctra-design-system.md`; ese archivo se conserva como registro de una etapa anterior. Este paquete prepara recursos y reglas. No cambia pantallas ni comportamiento de la app.

## Dirección visual

NOCTRA se presenta como un archivo personal de una noche: editorial, vibrante y coleccionable. La referencia aprobada combina fotografía de nightlife, papel rasgado, pinceladas, lettering grande, stickers y anotaciones manuales dentro de una interfaz móvil clara.

- Usar papel `#F8F4E9` como superficie habitual. El negro es tinta, texto y contraste; reservar las superficies oscuras para Hidden Frequency, fotos nocturnas y recompensas especiales.
- Acentuar con azul eléctrico, hot pink, coral, neon lime, rojo y cian. Una pieza suele tener uno o dos acentos dominantes; no repartir todos los colores con el mismo peso.
- Combinar fotografía a sangre con recortes vectoriales. Desalinear y rotar etiquetas unos pocos grados, conservar márgenes de lectura y dejar zonas tranquilas sobre caras.
- Hacer que NOCTRA sea grande y gráfico en portadas y momentos. El logotipo no tiene que repetirse en cada sticker.
- Mantener el ritmo de collage en móvil: una imagen protagonista, una etiqueta o anotación, y una acción clara por grupo. El collage decora la lectura, no la reemplaza.
- El resultado debe sentirse joven y premium por la dirección de arte y el cuidado del crop, no por materiales oscuros o efectos de lujo.

## Paleta y combinaciones

| Token | Hex | Uso principal |
|---|---|---|
| Paper | `#F8F4E9` | Fondo editorial y sticker claro |
| Paper shadow | `#EEE7D9` | Segunda capa de papel |
| Ink | `#111111` | Texto, trazo y contraste |
| Electric blue | `#174AFF` | Bloques, enlaces y momentos |
| Hot pink | `#FF2F92` | Señal, sticker y acento |
| Coral | `#FF6038` | Pincelada, sunset y acción secundaria |
| Neon lime | `#D7FF2F` | Acción primaria, progreso y estado activo |
| Bright red | `#F4313F` | Interferencia o alerta narrativa |
| Cyan | `#2BD8E8` | Acento frío puntual |
| Muted ink | `#6A625B` | Microcopy de apoyo sobre papel |

Usar tinta sobre lime, pink, coral, cyan o papel. Usar papel sobre blue o ink. Evitar texto pequeño en blanco sobre lime, coral sobre pink y blue sobre black. El token fuente vive en `src/experiences/noctra/noctraDesignTokens.css`.

## Tipografía

- **Display / hero:** `Impact`, `Arial Black`, `Arial Narrow`, sans-serif; mayúsculas, ancho apretado, altura de línea corta y cortes expresivos.
- **Headings:** `Arial Black`, `Impact`, system-ui; tamaños grandes con salto de línea deliberado.
- **Body:** `Inter`, system-ui, `Segoe UI`, sans-serif; frases breves, lectura cómoda y tono directo.
- **Microcopy / metadata:** `Courier New`, ui-monospace; fecha, coordenadas, estado y número de colección.
- **Acento manual:** usar los doodles SVG o el fallback `Bradley Hand`, `Comic Sans MS`, cursive. No se incluyen fuentes externas ni archivos con licencias no verificadas.

Las marcas dibujadas deben permanecer como SVG; no simular handwriting con una fuente decorativa en párrafos largos.

## Estructura del paquete

Los recursos nuevos están en `public/experiences/noctra/`:

| Carpeta | Contenido y uso |
|---|---|
| `brand/` | Logo principal y alternativo, wordmarks, isotipo, favicon y app icon |
| `textures/` | Grano, halftone, fotocopia, spray, ink bleed, papel arrugado, borde roto y masking tape |
| `doodles/` | Sprite SVG escalable; flechas, corazón, smiley, estrella, globo, spark, corona, candado, onda, círculo, underline, ubicación, cámara, señal y asterisco |
| `stickers/` | 12 mensajes de progreso, noche, señal y cultura |
| `shapes/` | Bloques de pintura, círculo, splash, estrella, flecha y subrayado |
| `blobs/` | Dos objetos glossy transparentes para usar ocasionalmente |
| `photos/` | Cuatro escenas conceptuales en recortes portrait, square y landscape |
| `moments/` | Cinco composiciones iniciales: First Pulse, Main Stage, Hidden Frequency, NOVA Drop y Final Drop |
| `signals/` | Waveform, ruido, glitch, Secret Found, coordenadas y borde interferido |
| `badges/`, `rewards/`, `passes/` | Estados coleccionables, premios y credenciales de backstage |
| `frames/` | Siete overlays Photo Studio SVG, lienzo transparente 720×1280 |
| `overlays/` | Ruido, esquina rasgada, wash sunset y trazo marcador |
| `ui/` | Sprite y elementos de navegación, botón, lock, check, progreso, foto y separador |
| `backgrounds/` | Seis fondos vectoriales modulares; oscuro solo para la señal especial |

El inventario fila por fila está en `public/experiences/noctra/asset-inventory.csv`. Los logos existentes en la raíz pública se conservaron para el Home aprobado. Los archivos de `art/` también se dejaron intactos y figuran como placeholders de la etapa anterior.

## Fotografía y blob glossy

Las fotografías fueron generadas como escenas ficticias originales: crowd, amistades, sunset con palmeras y pasillo backstage. Cada escena tiene recortes `portrait` (720×1280), `square` (1000×1000) y `landscape` (1440×960), optimizados en WebP. Son **CONCEPTUAL**: no representan asistentes reales, artistas, venues ni marcas.

Los dos blobs tienen transparencia alpha real y están optimizados en WebP. Se pueden girar, espejar o reducir mediante CSS; conviene usar uno por composición como máximo y no convertirlo en el identificador de cada pantalla.

## Principios de collage y composición

1. Partir de papel claro o una foto; sumar una sola forma grande y dos detalles pequeños como máximo en el primer foco.
2. Superponer etiquetas sobre huecos de la foto, nunca sobre ojos o caras. Mantener una zona limpia de al menos 48 px alrededor del rostro principal en un arte 720×1280.
3. Usar contornos de tinta, tape o bordes rotos para relacionar piezas. Evitar sombras de tarjeta de dashboard.
4. Limitar a dos rotaciones pequeñas por composición y evitar mosaicos regulares de muchas cards.
5. Usar textura en baja opacidad; no aplicar simultáneamente photocopy, grano fuerte y spray sobre la misma imagen.
6. Asegurar contraste de lectura antes de añadir anotaciones. El CTA debe conservar texto y estado comprensibles sin depender del color.

## Tratamiento por tipo de experiencia

- **Momentos:** foto editorial, nombre grande, un acento de color y metadata corta. First Pulse introduce la noche; Main Stage lleva el crowd; Sunset usa coral/lime; NOVA Drop mantiene el sistema NOCTRA aunque sea una activación ficticia; Final Drop lleva al pass.
- **Hidden Frequency:** permitir una superficie oscura localizada. Usar una onda rosa, señal azul/lime y un solo glitch breve; evitar estética cyberpunk, scanlines permanentes o ruido sobre texto largo.
- **Rewards:** presentar el nombre como sticker o badge coleccionable. Separar con claridad locked/unlocked, progreso y la acción que desbloquea; no convertirlo en un panel SaaS.
- **Passport / Backstage:** credencial recortada, perforación/lanyard y una jerarquía legible de acceso, noche y estado. Los passes actuales son **CONCEPTUAL** hasta aplicarlos a la pantalla.
- **Photo Studio:** usar los SVG `frames/noctra-frame-*-9x16.svg` como overlay transparente 720×1280. El centro queda abierto; los labels se mantienen arriba o abajo y evitan cubrir caras. Verificar después con fotos reales cuando Photo Studio se rediseñe.

## Fondos, texturas y movimiento

Los SVG de `backgrounds/` son bases modulares: se pueden usar completos o recortar con `background-size: cover`. Las formas, doodles y texturas son assets separados para permitir variar la composición sin exportar una imagen gigante. Mantener un único fondo dominante; reservar `hidden-signal` y `blackwhite-grunge` para un momento o estado.

El movimiento futuro debe sentirse como intervención manual: aparición, leve offset, giro corto o revelación de una anotación. Duraciones base: 140 ms, 260 ms y 520 ms. Respetar `prefers-reduced-motion`; los assets no requieren animación para comunicar estado.

## Estados de inventario

- **FINAL:** pieza vectorial o token lista para reutilizar dentro del lenguaje definido.
- **CONCEPTUAL:** fotografía generada o arte específico de un momento, pase, recompensa o frame; requiere aprobación visual al aplicarse a pantallas.
- **PLACEHOLDER:** arte anterior conservado por compatibilidad o referencia. No se considera parte de la dirección collage aprobada.

## Fuentes y licencias

No se agregan dependencias ni fuentes externas. La fotografía y los blobs son imágenes generadas para este sistema. NOVA, fechas, premios, nombres de momentos y coordenadas son contenido ficticio de la demo.

## Alcance de esta etapa

Se entregan assets, tokens, guía e inventario. No se aplican estos recursos a Home, Explorar, Passport, Photo Studio, Tu Noche, rewards, Hidden Frequency, NOVA ni a las otras estaciones. Los archivos en `src/experiences/noctra/NoctraTheme/` y la lógica existente quedan fuera de este paquete.
