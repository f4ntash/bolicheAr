interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ASSETS: AssetsBinding
  CORSTENO_ANALYTICS_APPLICATION_SECRET?: string
}

const APP_PREFIX = '/la-fabrica'
const ANALYTICS_ENDPOINT = 'https://api.corsteno.com/v1/events'

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function proxyAnalyticsEvent(request: Request, env: Env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  if (!env.CORSTENO_ANALYTICS_APPLICATION_SECRET) {
    console.warn('Analytics disabled for La Fábrica: application secret is unavailable')
    return jsonResponse({ status: 'analytics_pending' }, 202)
  }

  const body = await request.text()
  if (body.length > 32768) {
    return jsonResponse({ error: 'Payload Too Large' }, 413)
  }

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.CORSTENO_ANALYTICS_APPLICATION_SECRET}`,
        'Content-Type': 'application/json',
      },
      body,
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      },
    })
  } catch {
    return jsonResponse({ error: 'Analytics upstream unavailable' }, 502)
  }
}

function requestForAsset(request: Request) {
  const url = new URL(request.url)

  if (url.pathname === APP_PREFIX) {
    url.pathname = '/'
  } else if (url.pathname.startsWith(`${APP_PREFIX}/`)) {
    url.pathname = url.pathname.slice(APP_PREFIX.length) || '/'
  }

  return new Request(url, request as unknown as RequestInit)
}

export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname
    if (path === `${APP_PREFIX}/api/events`) {
      return proxyAnalyticsEvent(request, env)
    }

    if (path !== APP_PREFIX && !path.startsWith(`${APP_PREFIX}/`)) {
      return new Response('Not Found', { status: 404 })
    }

    return env.ASSETS.fetch(requestForAsset(request))
  },
}
