import { assetUrl } from './assets'

const ANONYMOUS_USER_ID_KEY = 'corsteno_anon_id'
const SESSION_ID_KEY = 'corsteno_session_id'
const ANALYTICS_ENDPOINT = assetUrl('api/events')
const EXPERIENCE_ID = import.meta.env.VITE_EXPERIENCE?.trim() || 'la-estacion'

export type AnalyticsEventName =
  | 'app_opened'
  | 'session_started'
  | 'experience_started'
  | 'image_target_detected'
  | 'camera_permission_granted'
  | 'camera_permission_denied'
  | 'button_clicked'
  | 'experience_finished'

type AnalyticsProperties = Record<string, unknown>

function createId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // Fall through to the browser-compatible fallback below.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function readStorage(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function getOrCreateId(kind: 'local' | 'session', key: string) {
  const storage = readStorage(kind)
  if (!storage) return { id: createId(), isNew: true }

  try {
    const existingId = storage.getItem(key)
    if (existingId) return { id: existingId, isNew: false }
    const id = createId()
    storage.setItem(key, id)
    return { id, isNew: true }
  } catch {
    return { id: createId(), isNew: true }
  }
}

function isAnalyticsProperties(value: unknown): value is AnalyticsProperties {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function createAnalyticsTracker() {
  const anonymousUser = getOrCreateId('local', ANONYMOUS_USER_ID_KEY)
  const session = getOrCreateId('session', SESSION_ID_KEY)

  const track = (event: AnalyticsEventName, properties: AnalyticsProperties = {}) => {
    const payload = {
      event,
      userId: anonymousUser.id,
      sessionId: session.id,
      occurredAt: Date.now(),
      properties: {
        ...(isAnalyticsProperties(properties) ? properties : {}),
        experience: EXPERIENCE_ID,
      },
    }

    try {
      void fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error(`Analytics request failed: ${response.status}`)
      }).catch(() => {
        // Analytics must never interrupt the demo experience.
      })
    } catch {
      // Analytics must never interrupt the demo experience.
    }
  }

  return {
    anonymousUserId: anonymousUser.id,
    sessionId: session.id,
    isNewSession: session.isNew,
    track,
  }
}

export const analytics = createAnalyticsTracker()
