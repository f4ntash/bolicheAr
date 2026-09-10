import type { EventConfig } from '../../types'

const sunsetClaptoneImage = '/demo/sunset-claptone-crop.png'

export const laEstacion: EventConfig = {
  id: 'la-estacion',
  name: 'La Estación',
  experienceName: 'Tus Estaciones',
  tagline: 'Cada noche es distinta. Algunas no vuelven.',
  secondaryPhrase: 'No coleccionás premios. Coleccionás tus noches.',
  closingPhrase: 'Momentos que viviste. Lugares que descubriste. Noches que no vuelven.',
  logo: '/assets/la-estacion-logo.svg',
  heroImage: '/demo/event-hero.png',
  cameraImage: '/demo/camera-event.png',
  eventImage: '/demo/lago-sunset.png',
  eventDate: '09 · 09 · 26',
  location: 'Córdoba',
  upcomingEvents: [
    { name: 'La Estación Córdoba', date: '09 · 09 · 26', image: '/demo/event-hero.png' },
    { name: 'La Estación Buenos Aires', date: '21 · 11 · 26', image: '/demo/lago-sunset.png' },
    { name: 'La Estación Punta del Este', date: '15 · 01 · 27', image: '/demo/montana-sunset.png' },
  ],
  passportHistory: [
    { stationId: 'sunset-26', name: "Sunset '26", date: '09.09.26', image: sunsetClaptoneImage },
    { stationId: 'noche', name: 'Noche', date: '23.08.26', image: '/demo/noche-moon.png' },
    { stationId: 'fuego', name: 'Fuego', date: '12.07.26', image: '/demo/fuego-event.png' },
    { stationId: 'lago', name: 'Lago', date: '15.06.26', image: '/demo/lago-sunset.png' },
  ],
  passportTotals: { nights: 8, stations: 17, specials: 3 },
  theme: { background: '#121212', foreground: '#f2eee6', accent: '#c8a979' },
  stations: [
    { id: 'lago', name: 'Lago', type: 'permanent', status: 'found', count: 3, description: 'El agua, la calma y la energía de un lugar único.', image: '/demo/lago-sunset.png', location: 'Hall oeste' },
    { id: 'montana', name: 'Montaña', type: 'permanent', status: 'found', count: 2, description: 'Una presencia que aparece sobre el ruido.', image: '/demo/montana-sunset.png', location: 'Andén 03' },
    { id: 'fuego', name: 'Fuego', type: 'permanent', status: 'found', count: 4, description: 'Un pulso tibio debajo de la pista.', image: '/demo/fuego-event.png', location: 'Túnel sur' },
    { id: 'noche', name: 'Noche', type: 'permanent', status: 'found', count: 1, description: 'La pieza que aparece cuando todo se apaga.', image: '/demo/noche-moon.png', location: 'Nivel bajo' },
    { id: 'sunset-26', name: "Sunset '26", type: 'event', status: 'available', count: 0, description: 'Esta estación existe únicamente esta noche.', image: sunsetClaptoneImage, location: 'Hasta el cierre' },
    { id: 'secret', name: '???', type: 'secret', status: 'locked', count: 0, description: 'Algunas estaciones no se anuncian.', image: '/demo/noche-moon.png' },
  ],
}
