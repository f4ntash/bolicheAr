export type StationType = 'permanent' | 'event' | 'secret' | 'artist' | 'sponsor'

export type Station = {
  id: string
  name: string
  type: StationType
  status: 'found' | 'available' | 'locked'
  count: number
  description: string
  image: string
  location?: string
}

export type PhotoStudioFilter = {
  id: string
  name: string
  image: string
  effect: string
  background: string
  compositeEffect?: string
  mediaEffect?: string
  overlayColor?: string
}

export type PhotoStudioConfig = {
  defaultFilterId: string
  segmentationBackgroundId: string
  filters: PhotoStudioFilter[]
}

export type EngagementProgress = {
  unlockedMicroRewardIds: string[]
  unlockedPhotoFrameIds: string[]
  finalRewardClaimed: boolean
}

export type EngagementMicroReward = {
  id: string
  stationId: string
  title: string
  message: string
  photoFrameIds?: string[]
  progressBonus?: number
}

export type EngagementConfig = {
  enabled: boolean
  goal: {
    title: string
    description: string
    requiredUnlocks: number
    progressStationIds?: string[]
  }
  finalReward: {
    id: string
    title: string
    description: string
    readyDescription: string
    unlockedDescription: string
    claimLabel: string
    lockedLabel: string
    readyLabel: string
    unlockedLabel: string
    disclaimer: string
    image: string
    passportStationId?: string
    photoStudioFilterId?: string
    photoActionLabel?: string
  }
  progressMessages: {
    zero: string
    progress: string
    halfway: string
    oneLeft: string
    complete: string
  }
  feedback: {
    title: string
    continueLabel: string
  }
  microRewards: EngagementMicroReward[]
  photoStudioUnlocks?: {
    filterId: string
    requiredStationId?: string
  }[]
  secretHints?: {
    showDetectedAfter: number
    showNearAfter?: number
    lockedTitle: string
    lockedMessage: string
    detectedTitle: string
    detectedMessage: string
    nearTitle?: string
    nearMessage?: string
    foundTitle: string
    foundMessage: string
  }
  drop?: {
    stationId: string
    title: string
    description: string
  }
}

export type ExperienceTheme = {
  background: string
  screen: string
  foreground: string
  accent: string
  border: string
  borderSubtle: string
  borderStrong: string
  buttonBackground: string
  buttonForeground: string
  activeForeground: string
  cardRadius?: string
  contentPadding?: string
  stationCardHeight?: string
  homeCopyBottom?: string
  homeHeroPosition?: string
  detailHeroHeight?: string
  navBackground?: string
}

export type ExperienceContent = {
  navigation: {
    explore: string
    camera: string
    passport: string
    upcoming: string
    info: string
    sponsors: string
    reset: string
  }
  home: {
    tagLines: string[]
    titleLines: string[]
    demoLabel: string
    startLabel: string
    demoNoteTitle: string
    demoNote: string
    demoDisclosureTitle?: string
    demoDisclosureBody?: string
    demoDisclosureNote?: string
    secondaryStartLabel?: string
  }
  discover: {
    title: string
    descriptionLines: string[]
    logoLabel: string
    searchingLabel: string
    detectedLabel: string
    unlockingLabel: string
    completionHint: string
  }
  stations: {
    headerSuffix: string
    tabs: { all: string; permanent: string; special: string }
    permanentLabel: string
    eventLabel: string
    foundLabel: string
    notFoundLabel: string
    eventAvailability: string
    secretFoundLabel: string
    secretLockedLabel: string
    tileTimesSingular: string
    tileTimesPlural: string
    explorationTitle: string
    explorationRemaining: string
    explorationComplete: string
    explorationIntro?: string
  }
  detail: {
    page: string
    brandLabel: string
    subtitle: string
    descriptionSuffix: string
    usePhotoLabel: string
  }
  unlocked: {
    brandLabel: string
    page: string
    unlockedLabel: string
    specialEditionLabel: string
    detailsLabel: string
    photoLabel: string
  }
  secretReveal: {
    brandLabel: string
    page: string
    revealedLabel: string
    subtitle: string
    title: string
    descriptionLines: string[]
    unlockLabel: string
  }
  passport: {
    eyebrow: string
    title: string
    statLabels: { nights: string; stations: string; specials: string }
    ticketLines: string[]
    secretLockedStatus: string
    secretFoundStatus: string
    notFoundStatus: string
    closingLines: string[]
  }
  upcoming: {
    eyebrow: string
    title: string
    closingLines: string[]
  }
  photoStudio: {
    title: string
    subtitle: string
    lockedNotice: string
    newUnlockNotice: string
    controls: { photo: string; repeatPhoto: string; takePhoto: string; publish: string }
    tabs: string[]
    overlayLines: string[]
  }
  sharing: {
    filenamePrefix: string
    navigatorTitle: string
    fallbackText: string
    imageAlt: string
    instagramLines: string[]
    downloadLines: string[]
    otherNetworksLines: string[]
    editLabel: string
    creditLabel: string
  }
}

export type ExperienceConfig = {
  id: string
  slug: string
  name: string
  experienceName: string
  tagline: string
  secondaryPhrase: string
  closingPhrase: string
  logo: string
  heroImage: string
  cameraImage: string
  eventImage: string
  eventDate: string
  location: string
  upcomingEvents: { name: string; date: string; image: string }[]
  passportHistory: { stationId: string; name: string; date: string; image: string; requiresUnlock?: boolean; requiredExplorationCount?: number }[]
  passportTotals: { nights: number; stations: number; specials: number }
  discovery?: {
    allowDemoTapUnlock?: boolean
    demoTapStationIds?: string[]
  }
  storage?: {
    legacyKey?: string
    legacyExperienceId?: string
  }
  theme: ExperienceTheme
  content: ExperienceContent
  stations: Station[]
  explorationStationIds: string[]
  qrStationIds: string[]
  photoStudio: PhotoStudioConfig
  engagement?: EngagementConfig
}

export type ExperienceRuntime = {
  config: ExperienceConfig
  stations: Station[]
  stationById: Record<string, Station>
  permanentStations: Station[]
  eventStations: Station[]
  secretStations: Station[]
  eventStation?: Station
  secretStation?: Station
  explorationStationIds: string[]
  qrStationIds: string[]
  photoStudio: PhotoStudioConfig & {
    filterEffects: Record<string, string>
    filterBackgrounds: Record<string, string>
    filterCompositeEffects: Record<string, string>
    filterMediaEffects: Record<string, string>
    filterOverlayColors: Record<string, string>
  }
}
