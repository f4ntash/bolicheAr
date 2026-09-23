import { laEstacionRuntime } from '../config/events/laEstacion'
import { laFabricaRuntime } from '../config/events/laFabrica'
import type { ExperienceRuntime } from '../types'

const EXPERIENCE_DEFAULT = 'la-estacion'
const EXPERIENCE_RUNTIMES: Record<string, ExperienceRuntime> = {
  'la-estacion': laEstacionRuntime,
  'la-fabrica': laFabricaRuntime,
}

export function resolveExperience(): ExperienceRuntime {
  const requestedExperience = import.meta.env.VITE_EXPERIENCE?.trim() || EXPERIENCE_DEFAULT
  const experience = EXPERIENCE_RUNTIMES[requestedExperience]
  if (!experience) {
    const availableExperiences = Object.keys(EXPERIENCE_RUNTIMES).join(', ')
    throw new Error(`Experiencia inválida "${requestedExperience}". Usá uno de: ${availableExperiences}.`)
  }

  return experience
}
