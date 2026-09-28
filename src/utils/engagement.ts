import type { EngagementConfig, EngagementProgress, ExperienceConfig } from '../types'
import type { FoundStations } from './experienceStorage'

export type FinalRewardState = 'locked' | 'ready' | 'unlocked'

export function getEngagementStationIds(config: ExperienceConfig): string[] {
  return config.engagement?.goal.progressStationIds ?? config.explorationStationIds
}

export function getEngagementCount(config: ExperienceConfig, foundStations: FoundStations, progress?: EngagementProgress): number {
  const engagement = config.engagement
  if (!engagement?.enabled) return 0

  const foundCount = getEngagementStationIds(config).filter((stationId) => foundStations[stationId] === true).length
  const bonusCount = engagement.microRewards
    .filter((reward) => progress?.unlockedMicroRewardIds.includes(reward.id))
    .reduce((total, reward) => total + (reward.progressBonus ?? 0), 0)
  return Math.min(foundCount + bonusCount, engagement.goal.requiredUnlocks)
}

export function getFinalRewardState(config: ExperienceConfig, progress: EngagementProgress, foundStations: FoundStations): FinalRewardState | null {
  const engagement = config.engagement
  if (!engagement?.enabled || !engagement.finalReward) return null
  if (getEngagementCount(config, foundStations, progress) < engagement.goal.requiredUnlocks) return 'locked'
  return progress.finalRewardClaimed ? 'unlocked' : 'ready'
}

export function getEngagementProgressMessage(config: ExperienceConfig, count: number): string {
  const engagement = config.engagement
  if (!engagement?.enabled) return ''

  const required = engagement.goal.requiredUnlocks
  const remaining = Math.max(0, required - count)
  const messages = engagement.progressMessages
  const message = count === 0
    ? messages.zero
    : remaining === 0
      ? messages.complete
      : remaining === 1
        ? messages.oneLeft
        : count >= Math.ceil(required / 2)
          ? messages.halfway
          : messages.progress

  return message.replace(/\{count\}/g, String(count)).replace(/\{remaining\}/g, String(remaining))
}

export function applyStationEngagementUnlock(
  config: ExperienceConfig,
  progress: EngagementProgress,
  stationId: string,
): EngagementProgress {
  const engagement = config.engagement
  if (!engagement?.enabled) return progress

  const microRewardIds = engagement.microRewards
    .filter((reward) => reward.stationId === stationId)
    .map((reward) => reward.id)
  const rewardFrameIds = engagement.microRewards
    .filter((reward) => reward.stationId === stationId)
    .flatMap((reward) => reward.photoFrameIds ?? [])
  const configuredFrameIds = (engagement.photoStudioUnlocks ?? [])
    .filter((frame) => frame.requiredStationId === stationId)
    .map((frame) => frame.filterId)
  const photoFrameIds = [...rewardFrameIds, ...configuredFrameIds]

  return {
    ...progress,
    unlockedMicroRewardIds: [...new Set([...progress.unlockedMicroRewardIds, ...microRewardIds])],
    unlockedPhotoFrameIds: [...new Set([...progress.unlockedPhotoFrameIds, ...photoFrameIds])],
  }
}

export function reconcileEngagementProgress(
  config: ExperienceConfig,
  foundStations: FoundStations,
  progress: EngagementProgress,
): EngagementProgress {
  const engagement = config.engagement
  if (!engagement?.enabled) return progress

  const initiallyAvailableFrames = (engagement.photoStudioUnlocks ?? [])
    .filter((frame) => !frame.requiredStationId)
    .map((frame) => frame.filterId)
  let next = {
    ...progress,
    unlockedPhotoFrameIds: [...new Set([...progress.unlockedPhotoFrameIds, ...initiallyAvailableFrames])],
  }

  for (const stationId of Object.keys(foundStations)) {
    if (foundStations[stationId]) next = applyStationEngagementUnlock(config, next, stationId)
  }

  return next
}

export function getNewMicroRewards(config: ExperienceConfig, stationId: string, before: EngagementProgress): NonNullable<EngagementConfig['microRewards']> {
  const engagement = config.engagement
  if (!engagement?.enabled) return []

  return engagement.microRewards.filter((reward) =>
    reward.stationId === stationId && !before.unlockedMicroRewardIds.includes(reward.id),
  )
}
