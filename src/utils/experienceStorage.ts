import type { ExperienceConfig, ExperienceRuntime } from '../types'

const STORAGE_NAMESPACE = 'corsteno-stations:v1'
const RESET_QUERY_PARAMETER = 'resetDemo'

export type FoundStations = Record<string, boolean>

export type ExperienceProgress = {
  foundStations: FoundStations
  secretRevealSeen: boolean
}

export type PersistedExperienceProgress = {
  experienceId: string
  stations: FoundStations
  secretRevealSeen: boolean
}

export type ExperienceStorageContext = ExperienceRuntime | ExperienceConfig

export type ExperienceStorage = Pick<Storage, 'getItem' | 'setItem'>

const getExperienceConfig = (experience: ExperienceStorageContext): ExperienceConfig =>
  'config' in experience ? experience.config : experience

const createInitialProgress = (): ExperienceProgress => ({
  foundStations: {},
  secretRevealSeen: false,
})

function getBrowserStorage(): ExperienceStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStorage(storage: ExperienceStorage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: ExperienceStorage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFoundStations(value: unknown): FoundStations | null {
  if (!isRecord(value)) return null

  const foundStations: FoundStations = {}
  for (const [stationId, found] of Object.entries(value)) {
    if (typeof found !== 'boolean') return null
    foundStations[stationId] = found
  }

  return foundStations
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function parseNamespacedProgress(raw: string | null, experienceId: string): ExperienceProgress | null {
  if (!raw) return null

  const parsed = parseJson(raw)
  if (!isRecord(parsed) || parsed.experienceId !== experienceId || typeof parsed.secretRevealSeen !== 'boolean') return null

  const foundStations = parseFoundStations(parsed.stations)
  if (!foundStations) return null

  return { foundStations, secretRevealSeen: parsed.secretRevealSeen }
}

function parseLegacyProgress(raw: string | null, experienceId: string): ExperienceProgress | null {
  if (!raw) return null

  const parsed = parseJson(raw)
  if (!isRecord(parsed) || parsed.eventId !== experienceId) return null

  const foundStations = parseFoundStations(parsed.stations)
  if (!foundStations) return null

  const secretRevealSeen = parsed.secretRevealSeen === undefined ? false : parsed.secretRevealSeen
  if (typeof secretRevealSeen !== 'boolean') return null

  return { foundStations, secretRevealSeen }
}

function getLegacyStorageConfig(config: ExperienceConfig) {
  const legacyKey = config.storage?.legacyKey
  if (!legacyKey) return null

  return {
    key: legacyKey,
    experienceId: config.storage?.legacyExperienceId || config.id,
  }
}

function serializeNamespacedProgress(experienceId: string, progress: ExperienceProgress): string | null {
  try {
    const persisted: PersistedExperienceProgress = {
      experienceId,
      stations: progress.foundStations,
      secretRevealSeen: progress.secretRevealSeen,
    }
    return JSON.stringify(persisted)
  } catch {
    return null
  }
}

function serializeLegacyProgress(experienceId: string, progress: ExperienceProgress): string | null {
  try {
    return JSON.stringify({
      eventId: experienceId,
      stations: progress.foundStations,
      secretRevealSeen: progress.secretRevealSeen,
    })
  } catch {
    return null
  }
}

export function getExperienceStorageKey(experience: ExperienceStorageContext): string {
  return `${STORAGE_NAMESPACE}:${getExperienceConfig(experience).slug}`
}

export function migrateLegacyProgress(
  experience: ExperienceStorageContext,
  progress: ExperienceProgress,
  storage: ExperienceStorage | null = getBrowserStorage(),
) {
  if (!storage) return

  const config = getExperienceConfig(experience)
  const serialized = serializeNamespacedProgress(config.id, progress)
  if (serialized) writeStorage(storage, getExperienceStorageKey(experience), serialized)
}

function consumeResetRequest(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get(RESET_QUERY_PARAMETER) !== 'true') return false

    params.delete(RESET_QUERY_PARAMETER)
    const nextQuery = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`)
    return true
  } catch {
    return false
  }
}

export function loadExperienceProgress(
  experience: ExperienceStorageContext,
  storage: ExperienceStorage | null = getBrowserStorage(),
): ExperienceProgress {
  const initialProgress = createInitialProgress()

  if (consumeResetRequest()) {
    saveExperienceProgress(experience, initialProgress, storage)
    return initialProgress
  }

  if (!storage) return initialProgress

  const config = getExperienceConfig(experience)
  const namespacedProgress = parseNamespacedProgress(readStorage(storage, getExperienceStorageKey(experience)), config.id)
  if (namespacedProgress) return namespacedProgress

  const legacyStorage = getLegacyStorageConfig(config)
  if (!legacyStorage) return initialProgress

  const legacyProgress = parseLegacyProgress(readStorage(storage, legacyStorage.key), legacyStorage.experienceId)
  if (!legacyProgress) return initialProgress

  migrateLegacyProgress(experience, legacyProgress, storage)
  return legacyProgress
}

export function saveExperienceProgress(
  experience: ExperienceStorageContext,
  progress: ExperienceProgress,
  storage: ExperienceStorage | null = getBrowserStorage(),
) {
  if (!storage) return

  const config = getExperienceConfig(experience)
  const namespacedProgress = serializeNamespacedProgress(config.id, progress)
  const legacyStorage = getLegacyStorageConfig(config)
  const legacyProgress = legacyStorage ? serializeLegacyProgress(legacyStorage.experienceId, progress) : null

  if (namespacedProgress) writeStorage(storage, getExperienceStorageKey(experience), namespacedProgress)
  if (legacyStorage && legacyProgress) writeStorage(storage, legacyStorage.key, legacyProgress)
}

export function resetExperienceProgress(
  experience: ExperienceStorageContext,
  storage: ExperienceStorage | null = getBrowserStorage(),
): ExperienceProgress {
  const initialProgress = createInitialProgress()
  saveExperienceProgress(experience, initialProgress, storage)
  return initialProgress
}
