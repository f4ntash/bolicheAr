export type StationType = 'permanent' | 'event' | 'secret' | 'artist' | 'sponsor'

export type Station = {
  id: string
  name: string
  type: StationType
  status: 'found' | 'available' | 'locked'
  count: number
  description: string
  image: string
  location?: string
}

export type EventConfig = {
  id: string
  name: string
  experienceName: string
  tagline: string
  secondaryPhrase: string
  closingPhrase: string
  logo: string
  heroImage: string
  cameraImage: string
  eventImage: string
  eventDate: string
  location: string
  upcomingEvents: { name: string; date: string; image: string }[]
  passportHistory: { stationId: string; name: string; date: string; image: string }[]
  passportTotals: { nights: number; stations: number; specials: number }
  theme: {
    background: string
    foreground: string
    accent: string
  }
  stations: Station[]
}
