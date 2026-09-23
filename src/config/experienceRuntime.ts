import type { ExperienceConfig, ExperienceRuntime } from '../types'

export function createExperienceRuntime(config: ExperienceConfig): ExperienceRuntime {
  const stations = [...config.stations]
  const stationById = Object.fromEntries(stations.map((station) => [station.id, station]))
  const photoStudio = {
    ...config.photoStudio,
    filterEffects: Object.fromEntries(config.photoStudio.filters.map((filter) => [filter.id, filter.effect])),
    filterBackgrounds: Object.fromEntries(config.photoStudio.filters.map((filter) => [filter.id, filter.background])),
    filterCompositeEffects: Object.fromEntries(config.photoStudio.filters.filter((filter) => filter.compositeEffect).map((filter) => [filter.id, filter.compositeEffect as string])),
    filterMediaEffects: Object.fromEntries(config.photoStudio.filters.filter((filter) => filter.mediaEffect).map((filter) => [filter.id, filter.mediaEffect as string])),
    filterOverlayColors: Object.fromEntries(config.photoStudio.filters.filter((filter) => filter.overlayColor).map((filter) => [filter.id, filter.overlayColor as string])),
  }

  return {
    config,
    stations,
    stationById,
    permanentStations: stations.filter((station) => station.type === 'permanent'),
    eventStations: stations.filter((station) => station.type === 'event'),
    secretStations: stations.filter((station) => station.type === 'secret'),
    eventStation: stations.find((station) => station.type === 'event'),
    secretStation: stations.find((station) => station.type === 'secret'),
    explorationStationIds: [...config.explorationStationIds],
    qrStationIds: [...config.qrStationIds],
    photoStudio,
  }
}
