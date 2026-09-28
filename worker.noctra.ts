interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ASSETS: AssetsBinding
}

const APP_PREFIX = '/noctra'

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
    if (path !== APP_PREFIX && !path.startsWith(`${APP_PREFIX}/`)) {
      return new Response('Not Found', { status: 404 })
    }

    return env.ASSETS.fetch(requestForAsset(request))
  },
}
