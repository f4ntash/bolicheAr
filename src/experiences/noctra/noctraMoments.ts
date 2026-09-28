export type NoctraMomentKind = 'normal' | 'special' | 'secret'

export type NoctraEdition = {
  id: string
  label: string
  eventDate: string
  dateLabel: string
  shortName: string
}

export type NoctraStationVariant = {
  id: string
  editionId: string
  title: string
  kind: NoctraMomentKind
  effect: 'amber-tunnel' | 'blue-stage' | 'sunset-stage' | 'secret-signal' | 'nova-gold' | 'backstage'
  badge: string
  reward: string
  description: string
}

export type NoctraMomentRecord = {
  id: string
  stationId: string
  stationName: string
  createdAt: string
  editionId: string
  editionLabel: string
  eventDate: string
  variantId: string
  kind: NoctraMomentKind
  badge: string
  reward: string
  mediaSource?: 'camera' | 'selected' | 'demo'
  photo?: Blob
}

export type NoctraMomentView = Omit<NoctraMomentRecord, 'photo'> & { photoUrl?: string }

export const NOCTRA_EDITIONS: Record<string, NoctraEdition> = {
  'night-03': { id: 'night-03', label: 'NIGHT 03', shortName: 'NOCTRA 03', eventDate: '2026-09-28', dateLabel: '28 SEP 2026' },
  'night-02': { id: 'night-02', label: 'NIGHT 02', shortName: 'NOCTRA 02', eventDate: '2026-08-22', dateLabel: '22 AGO 2026' },
  'sunset-special': { id: 'sunset-special', label: 'SUNSET EDITION', shortName: 'NOCTRA · SPECIAL', eventDate: '2026-09-28', dateLabel: '28 SEP 2026' },
}

export const DEFAULT_NOCTRA_EDITION = NOCTRA_EDITIONS['night-03']

const STATION_VARIANTS: Record<string, NoctraStationVariant[]> = {
  entrance: [
    { id: 'first-pulse-night-03', editionId: 'night-03', title: 'FIRST PULSE', kind: 'normal', effect: 'amber-tunnel', badge: 'FIRST PULSE', reward: 'Frame NOCTRA', description: 'La noche empezó acá.' },
    { id: 'first-pulse-night-02', editionId: 'night-02', title: 'FIRST PULSE · NIGHT 02', kind: 'normal', effect: 'amber-tunnel', badge: 'NIGHT 02 · FIRST PULSE', reward: 'Frame NOCTRA', description: 'El primer pulso de otra edición.' },
    { id: 'first-pulse-sunset', editionId: 'sunset-special', title: 'FIRST PULSE · SUNSET', kind: 'special', effect: 'sunset-stage', badge: 'SUNSET EDITION', reward: 'Frame SUNSET', description: 'La noche empezó antes de caer el sol.' },
  ],
  'main-stage': [
    { id: 'main-stage-night-03', editionId: 'night-03', title: 'MAIN STAGE · NIGHT 03', kind: 'special', effect: 'blue-stage', badge: 'SPECIAL · NIGHT 03', reward: 'Frame MAIN STAGE', description: 'La pista entera en un mismo pulso.' },
    { id: 'main-stage-night-02', editionId: 'night-02', title: 'MAIN STAGE · NIGHT 02', kind: 'special', effect: 'blue-stage', badge: 'NIGHT 02 · ARCHIVE', reward: 'Frame MAIN STAGE', description: 'Otra edición. El mismo frente.' },
    { id: 'main-stage-sunset', editionId: 'sunset-special', title: 'MAIN STAGE · SUNSET EDITION', kind: 'special', effect: 'sunset-stage', badge: 'SPECIAL · ONE NIGHT', reward: 'Frame SUNSET STAGE', description: 'Una edición especial que no vuelve igual.' },
  ],
  'hidden-frequency': [
    { id: 'hidden-frequency-night-03', editionId: 'night-03', title: 'HIDDEN FREQUENCY', kind: 'secret', effect: 'secret-signal', badge: 'SECRET SIGNAL · NIGHT 03', reward: 'I WAS HERE · Secret Badge', description: 'No todas las señales aparecen dos veces.' },
    { id: 'hidden-frequency-night-02', editionId: 'night-02', title: 'HIDDEN FREQUENCY · 02', kind: 'secret', effect: 'secret-signal', badge: 'SECRET SIGNAL · ARCHIVE', reward: 'I WAS HERE · Secret Badge', description: 'Una frecuencia guardada de otra noche.' },
    { id: 'hidden-frequency-sunset', editionId: 'sunset-special', title: 'HIDDEN FREQUENCY · SPECIAL SIGNAL', kind: 'secret', effect: 'secret-signal', badge: 'SPECIAL SIGNAL', reward: 'I WAS HERE · Special Badge', description: 'La señal especial apareció fuera del mapa.' },
  ],
  'nova-drop': [
    { id: 'nova-night-03', editionId: 'night-03', title: 'NOVA DROP', kind: 'normal', effect: 'nova-gold', badge: 'NOVA · NIGHT 03', reward: '+1 oportunidad para Backstage Access', description: 'Una luz cálida te encontró en medio de la pista.' },
    { id: 'nova-night-02', editionId: 'night-02', title: 'NOVA DROP · NIGHT 02', kind: 'normal', effect: 'nova-gold', badge: 'NOVA · ARCHIVE', reward: '+1 oportunidad para Backstage Access', description: 'Un destello de otra edición.' },
    { id: 'nova-sunset', editionId: 'sunset-special', title: 'NOVA DROP · SUNSET', kind: 'special', effect: 'nova-gold', badge: 'NOVA · SPECIAL EDITION', reward: '+1 oportunidad para Backstage Access', description: 'Una activación marcada por el último sol.' },
  ],
  'final-drop': [
    { id: 'backstage-night-03', editionId: 'night-03', title: 'BACKSTAGE ACCESS', kind: 'special', effect: 'backstage', badge: 'BACKSTAGE · NIGHT 03', reward: 'Backstage Access', description: 'El cierre de tu noche, guardado para vos.' },
    { id: 'backstage-night-02', editionId: 'night-02', title: 'BACKSTAGE ACCESS · 02', kind: 'special', effect: 'backstage', badge: 'BACKSTAGE · ARCHIVE', reward: 'Backstage Access', description: 'El cierre de otra edición.' },
    { id: 'backstage-sunset', editionId: 'sunset-special', title: 'BACKSTAGE · SUNSET EDITION', kind: 'special', effect: 'backstage', badge: 'BACKSTAGE · SPECIAL', reward: 'Backstage Access', description: 'Una edición especial, una puerta distinta.' },
  ],
}

export function resolveNoctraEdition(search = typeof window === 'undefined' ? '' : window.location.search) {
  const id = new URLSearchParams(search).get('edition')
  return id && NOCTRA_EDITIONS[id] ? NOCTRA_EDITIONS[id] : DEFAULT_NOCTRA_EDITION
}

export function getNoctraStationVariant(stationId: string, edition: NoctraEdition) {
  const variants = STATION_VARIANTS[stationId] ?? []
  return variants.find((variant) => variant.editionId === edition.id) ?? variants[0] ?? {
    id: `${stationId}-${edition.id}`,
    editionId: edition.id,
    title: stationId.toUpperCase(),
    kind: 'normal' as const,
    effect: 'amber-tunnel' as const,
    badge: `${stationId.toUpperCase()} · ${edition.label}`,
    reward: 'Momento guardado',
    description: 'Un fragmento de esta noche.',
  }
}

const DATABASE_NAME = 'corsteno-noctra-moments-v1'
const STORE_NAME = 'moments'
const METADATA_KEY = 'corsteno-stations:v1:noctra-moments'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no está disponible'))
      return
    }
    const request = window.indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el archivo de recuerdos'))
  })
}

function readMetadataFallback(): NoctraMomentRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(METADATA_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is NoctraMomentRecord => Boolean(item && typeof item.id === 'string')) : []
  } catch {
    return []
  }
}

function writeMetadataFallback(records: NoctraMomentRecord[]) {
  try {
    const metadata = records.slice(0, 80).map(({ photo: _photo, ...record }) => record)
    window.localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
  } catch {
    // Keep the app usable if browser storage is restricted.
  }
}

export function createNoctraMomentDraft(input: Omit<NoctraMomentRecord, 'id' | 'createdAt'>): NoctraMomentRecord {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `noctra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { ...input, id, createdAt: new Date().toISOString() }
}

export async function saveNoctraMoment(record: NoctraMomentRecord) {
  const metadataRecords = readMetadataFallback().filter((item) => item.id !== record.id)
  writeMetadataFallback([record, ...metadataRecords])
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar el recuerdo'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló el guardado del recuerdo'))
    })
    database.close()
    return true
  } catch {
    return false
  }
}

export async function attachNoctraMomentPhoto(momentId: string, photo: Blob, source: NonNullable<NoctraMomentRecord['mediaSource']>) {
  const records = await listNoctraMoments()
  const current = records.find((item) => item.id === momentId)
  if (!current) return false
  return saveNoctraMoment({ ...current, photo, mediaSource: source })
}

export async function listNoctraMoments(): Promise<NoctraMomentRecord[]> {
  const fallback = readMetadataFallback()
  try {
    const database = await openDatabase()
    const stored = await new Promise<NoctraMomentRecord[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result as NoctraMomentRecord[])
      request.onerror = () => reject(request.error ?? new Error('No se pudieron leer los recuerdos'))
    })
    database.close()
    const merged = new Map(fallback.map((record) => [record.id, record]))
    stored.forEach((record) => merged.set(record.id, record))
    return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return fallback.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export async function getLatestNoctraMoment(stationId: string, editionId: string) {
  return (await listNoctraMoments()).find((record) => record.stationId === stationId && record.editionId === editionId)
}

export async function loadNoctraMomentViews(): Promise<NoctraMomentView[]> {
  const records = await listNoctraMoments()
  return records.map(({ photo, ...metadata }) => ({ ...metadata, photoUrl: photo ? URL.createObjectURL(photo) : undefined }))
}

export async function resetNoctraMoments() {
  try {
    window.localStorage.removeItem(METADATA_KEY)
  } catch {
    // Storage may be unavailable in private browser contexts.
  }
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo reiniciar el archivo de recuerdos'))
    })
    database.close()
  } catch {
    // The metadata namespace above is still cleared if IndexedDB is unavailable.
  }
}
