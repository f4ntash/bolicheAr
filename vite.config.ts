import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const EXPERIENCE_BASES: Record<string, string> = {
  'la-estacion': '/la-estacion/',
  'la-fabrica': '/la-fabrica/',
  dahaus: '/dahaus/',
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const requestedExperience = env.VITE_EXPERIENCE?.trim() || 'la-estacion'
  const base = EXPERIENCE_BASES[requestedExperience]
  if (!base) {
    const availableExperiences = Object.keys(EXPERIENCE_BASES).join(', ')
    throw new Error(`Experiencia inválida "${requestedExperience}". Usá uno de: ${availableExperiences}.`)
  }

  return {
    base,
    plugins: [
      {
        name: 'experience-base-redirect',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const pathname = (request as { url?: string }).url?.split('?')[0]
            const slashlessBase = base.slice(0, -1)
            if (pathname === slashlessBase) {
              response.statusCode = 302
              response.setHeader('Location', base)
              response.end()
              return
            }

            next()
          })
        },
        configurePreviewServer(server) {
          server.middlewares.use((request, response, next) => {
            const pathname = (request as { url?: string }).url?.split('?')[0]
            const slashlessBase = base.slice(0, -1)
            if (pathname === slashlessBase) {
              response.statusCode = 302
              response.setHeader('Location', base)
              response.end()
              return
            }

            next()
          })
        },
      },
      react(),
    ],
  }
})
