# Corsteno Stations — visual system

## Product context

`corsteno-stations` is a mobile-first commercial demo for discovering collectible AR stations at a night event. The first event configuration is La Estación, but the UI must consume event configuration data and stay reusable for future events. The flow contains three views: home, stations list, and the detail of Sunset '26. No backend, authentication, real camera, router, or additional features.

## Art direction

Editorial nocturnal premium: night club, fashion magazine, contemporary art, analog photography, and minimalism. Quiet, tactile, spacious, and slightly mysterious. Use large type, thin rules, rectangular cards, monochrome or desaturated imagery, and restrained champagne accents. No neon, cyberpunk, gamer UI, colorful gradients, HUDs, particles, 3D, glassmorphism, or childish iconography.

## Palette

- Warm charcoal background: `#171716`
- Deep black panel: `#10100F`
- Ivory primary text: `#F1EEE7`
- Muted stone text: `#9D9A91`
- Champagne accent: `#B8A37A`
- Hairline border: `rgba(241, 238, 231, 0.17)`

## Typography

- Display: `Cormorant Garamond`, fallback `Georgia`, elegant serif, regular weight, tight line-height, used for experience names and hero statements.
- Interface: `DM Sans`, fallback `Arial`, used for labels, navigation, metadata, buttons, and supporting copy.
- Labels are uppercase, 0.16em tracking, small and calm. Avoid all-caps body copy.

## Layout

- Mobile-first single-column composition with generous vertical rhythm.
- Desktop max-width around 1180px, centered with a restrained two-column detail layout.
- Rectangular media blocks with slight radius (2px) or square corners; no floating pill UI.
- Thin rules separate content sections. Use negative space as a primary design element.

## Imagery and motion

- Use local CSS-generated abstract night imagery when no real assets exist: low-contrast grain, horizon lines, blurred moon/landscape silhouettes, and desaturated tones.
- CSS-only motion: fade, slide, and subtle scale on view changes and CTA feedback. Keep motion slow and understated.

## Components

- Minimal top bar with event name and a small page index.
- Primary CTA is an ivory outlined or filled rectangular button with dark text; champagne only for tiny accents.
- Station cards show image, name, type, and found count. Locked secret card is intentionally obscured and monochrome.
- Preserve a clear hierarchy between permanent stations, tonight's edition, and secret stations.

## Responsive behavior

The phone layout is the source of truth. On wider screens, increase margins, use a two-column detail view, and let the station list become a two-column grid while preserving order, type labels, spacing, and quiet editorial tone.

## Hard constraints

Only use the fonts, colors, spacing, and component styles defined here. Do not introduce gradients, neon colors, 3D effects, external image URLs, extra features, or additional screens.
