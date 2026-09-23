import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const EXPERIENCE_BASES: Record<string, string> = {
  'la-estacion': '/la-estacion/',
  'la-fabrica': '/la-fabrica/',
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
    plugins: [react()],
  }
})
