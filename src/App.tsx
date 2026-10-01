import { Fragment, Suspense, createContext, lazy, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Camera, CalendarDays, Grid2X2, Image as ImageIcon, Info, Menu as MenuIcon, MoreHorizontal, Music2, ScanLine, Share2, Sparkles, Ticket, X } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import type { ExperienceRuntime, Station } from './types'
import { EngagementCard, EngagementContext, EngagementUnlockFeedback, FinalRewardScreen, useEngagementView, type EngagementUnlockFeedbackState, type EngagementViewModel } from './engagement/EngagementUI'
import NoctraSponsorActivation from './experiences/noctra/NoctraSponsorActivation/NoctraSponsorActivation'
import { NoctraEditionSection, NoctraExperienceInfo, NoctraLineup, NoctraMomentsCatalog, NoctraUpcomingDates } from './experiences/noctra/NoctraEditorialSections'
import './experiences/noctra/NoctraTheme/NoctraTheme.css'
import './experiences/noctra/NoctraCollageSystem/NoctraCollageSystem.css'
const VirtualBackgroundTest = lazy(() => import('./VirtualBackgroundTest'))
const NoctraExperienceUI = lazy(() => import('./experiences/noctra/NoctraMomentsExperience'))
import { parseStationQr } from './utils/stationQr'
import { assetUrl } from './utils/assets'
import type { AnalyticsEventName } from './utils/analytics'
import { loadExperienceProgress, resetExperienceProgress, saveExperienceProgress, type ExperienceProgress } from './utils/experienceStorage'
import { applyStationEngagementUnlock, getEngagementCount, getEngagementProgressMessage, getFinalRewardState, getNewMicroRewards, reconcileEngagementProgress } from './utils/engagement'

type View = 'home' | 'discover' | 'unlocked' | 'secret-reveal' | 'stations' | 'studio' | 'share' | 'detail' | 'passport' | 'upcoming' | 'lineup' | 'moments' | 'edition' | 'experience-info' | 'menu' | 'sponsor' | 'reward' | 'noctra-reveal' | 'noctra-night'
type NoctraRevealState = {
  station: Station
  variant: import('./experiences/noctra/noctraMoments').NoctraStationVariant
  progress: number
  required: number
  rewards: string[]
  continueTo: View
}

const ExperienceContext = createContext<ExperienceRuntime | null>(null)

function useExperienceRuntime() {
  const experience = useContext(ExperienceContext)
  if (!experience) throw new Error('ExperienceRuntime no disponible')
  return experience
}

function requireStation(station: Station | undefined, label: string) {
  if (!station) throw new Error(`La experiencia requiere ${label}`)
  return station
}

function ContentLines({ lines }: { lines: string[] }) {
  return <>{lines.map((line, index) => <Fragment key={`${line}-${index}`}>{line}{index < lines.length - 1 && <br />}</Fragment>)}</>
}

const SEGMENTATION_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_PATH = assetUrl('models/selfie_segmenter.tflite')
const COMPOSITE_OUTPUT_WIDTH = 360
const COMPOSITE_OUTPUT_HEIGHT = 640
const MASK_FEATHER_PX = 2
const LIGHT_WRAP_OPACITY = 0.055

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

function loadImageAsset(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = .92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto')), type, quality)
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo preparar la foto final'))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la foto final'))
    reader.readAsDataURL(blob)
  })
}

function isCameraPermissionDenied(error: unknown) {
  return error instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)
}

function trackExperienceEvent(enabled: boolean, event: AnalyticsEventName, properties: Record<string, unknown> = {}) {
  if (!enabled) return
  void import('./utils/analytics').then(({ analytics }) => analytics.track(event, properties))
}

function scrollToDemoDisclosure() {
  const disclosure = document.getElementById('noctra-home-disclosure')
  disclosure?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

function App({ experience }: { experience: ExperienceRuntime }) {
  const experienceRuntime = experience
  const experienceConfig = experience.config
  const isNoctra = experienceConfig.id === 'noctra'
  const [noctraEditionId] = useState(() => {
    const requestedEdition = new URLSearchParams(window.location.search).get('edition')
    return requestedEdition === 'night-02' || requestedEdition === 'sunset-special' ? requestedEdition : 'night-03'
  })
  const resetNoctraMomentsOnMount = useRef(isNoctra && new URLSearchParams(window.location.search).get('resetDemo') === 'true')
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const explorationStationIds = experienceRuntime.explorationStationIds
  const qrStationIds = new Set(experienceRuntime.qrStationIds)
  const vbTest = import.meta.env.DEV && new URLSearchParams(window.location.search).get('vbTest') === 'true'
  const [view, setView] = useState<View>('home')
  const [outgoingView, setOutgoingView] = useState<View | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station>(eventStation)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [initialProgress] = useState<ExperienceProgress>(() => loadExperienceProgress(experienceRuntime))
  const [foundStations, setFoundStations] = useState(initialProgress.foundStations)
  const [secretRevealSeen, setSecretRevealSeen] = useState(initialProgress.secretRevealSeen)
  const [engagementProgress, setEngagementProgress] = useState(() => reconcileEngagementProgress(experienceConfig, initialProgress.foundStations, initialProgress.engagement))
  const [unlockFeedback, setUnlockFeedback] = useState<EngagementUnlockFeedbackState | null>(null)
  const [selectedOverlay, setSelectedOverlay] = useState(experienceRuntime.photoStudio.defaultFilterId)
  const [studioTab, setStudioTab] = useState('story')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [capturedFilter, setCapturedFilter] = useState(experienceRuntime.photoStudio.defaultFilterId)
  const [activeNoctraMomentId, setActiveNoctraMomentId] = useState<string | null>(null)
  const [activeNoctraStationId, setActiveNoctraStationId] = useState<string | null>(null)
  const [noctraReveal, setNoctraReveal] = useState<NoctraRevealState | null>(null)
  const [pendingDiscoveryStationId, setPendingDiscoveryStationId] = useState<string | null>(null)
  const [pendingDiscoveryReturnView, setPendingDiscoveryReturnView] = useState<View | null>(null)
  const [sponsorReturnView, setSponsorReturnView] = useState<View>('stations')
  const [studioNotice, setStudioNotice] = useState<string | null>(null)
  const [newUnlockNoticePending, setNewUnlockNoticePending] = useState(false)
  const transitionTimer = useRef<number | undefined>(undefined)
  const unlockFeedbackKey = useRef(0)
  const noticeTimer = useRef<number | undefined>(undefined)
  const analyticsInitializedRef = useRef(false)
  const isStationFound = (stationId: string) => foundStations[stationId] === true
  const eventStationFound = isStationFound(eventStation.id)
  const secretStationFound = isStationFound(secretStation.id)
  const eventStations = experienceRuntime.eventStations
  const eventFoundCount = eventStations.filter((station) => isStationFound(station.id)).length
  const explorationFoundCount = explorationStationIds.filter((stationId) => isStationFound(stationId)).length
  const engagementCount = getEngagementCount(experienceConfig, foundStations, engagementProgress)
  const finalRewardState = getFinalRewardState(experienceConfig, engagementProgress, foundStations)
  const progressMessage = finalRewardState === 'unlocked' && experienceConfig.engagement
    ? experienceConfig.engagement.finalReward.unlockedDescription
    : getEngagementProgressMessage(experienceConfig, engagementCount)
  const unlockedMicroRewards = (experienceConfig.engagement?.microRewards ?? []).filter((reward) => engagementProgress.unlockedMicroRewardIds.includes(reward.id))
  const stationTotal = isNoctra
    ? explorationFoundCount + Number(secretStationFound)
    : experienceConfig.passportTotals.stations + (eventStationFound ? 1 : 0) + (secretStationFound ? 1 : 0)

  useEffect(() => {
    if (analyticsInitializedRef.current) return
    analyticsInitializedRef.current = true
    if (isNoctra) return
    void import('./utils/analytics').then(({ analytics }) => {
      analytics.track('app_opened', { surface: 'web', experience: experienceConfig.id, language: 'es' })
      if (analytics.isNewSession) analytics.track('session_started', { surface: 'web', experience: experienceConfig.id })
    })
  }, [experienceConfig, isNoctra])

  useEffect(() => {
    document.title = `${experienceConfig.experienceName} — Demo`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', experienceConfig.theme.background)
  }, [experienceConfig])

  useEffect(() => {
    const normalizedEngagement = reconcileEngagementProgress(experienceConfig, initialProgress.foundStations, initialProgress.engagement)
    if (JSON.stringify(normalizedEngagement) !== JSON.stringify(initialProgress.engagement)) {
      saveExperienceProgress(experienceRuntime, { ...initialProgress, engagement: normalizedEngagement })
    }
  }, [experienceConfig, experienceRuntime, initialProgress])

  useEffect(() => {
    if (!isNoctra) return
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const createdIcon = !icon
    if (!icon) {
      icon = document.createElement('link')
      icon.rel = 'icon'
      icon.type = 'image/svg+xml'
      document.head.append(icon)
    }
    const previousHref = icon.href
    const previousType = icon.type
    icon.href = assetUrl('experiences/noctra/noctra-mark.svg')
    icon.type = 'image/svg+xml'
    return () => {
      if (createdIcon) icon?.remove()
      else if (icon) { icon.href = previousHref; icon.type = previousType }
    }
  }, [isNoctra])

  useEffect(() => {
    if (!resetNoctraMomentsOnMount.current) return
    void import('./experiences/noctra/noctraMoments').then(({ resetNoctraMoments }) => resetNoctraMoments())
  }, [])

  if (vbTest) return <Suspense fallback={<main className="phone-screen" aria-label="Cargando prueba de cámara" />}><VirtualBackgroundTest experience={experience} /></Suspense>

  const showStudioNotice = (notice: string) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    setStudioNotice(notice)
    noticeTimer.current = window.setTimeout(() => setStudioNotice(null), 2000)
  }

  const persistProgress = (nextFoundStations: ExperienceProgress['foundStations'], nextSecretRevealSeen: boolean, nextEngagement: ExperienceProgress['engagement']) => {
    setFoundStations(nextFoundStations)
    setSecretRevealSeen(nextSecretRevealSeen)
    setEngagementProgress(nextEngagement)
    saveExperienceProgress(experienceRuntime, {
      foundStations: nextFoundStations,
      secretRevealSeen: nextSecretRevealSeen,
      engagement: nextEngagement,
    })
  }

  const prepareNoctraMoment = async (stationId: string | null | undefined) => {
    if (!isNoctra || !stationId) return null
    const station = experienceRuntime.stationById[stationId]
    if (!station) return null
    const { createNoctraMomentDraft, getLatestNoctraMoment, getNoctraStationVariant, NOCTRA_EDITIONS, saveNoctraMoment } = await import('./experiences/noctra/noctraMoments')
    const edition = NOCTRA_EDITIONS[noctraEditionId]
    const variant = getNoctraStationVariant(station.id, edition)
    const existing = await getLatestNoctraMoment(station.id, edition.id)
    if (existing) {
      setActiveNoctraMomentId(existing.id)
      setActiveNoctraStationId(existing.stationId)
      return existing.id
    }
    const record = createNoctraMomentDraft({
      stationId: station.id,
      stationName: variant.title,
      editionId: edition.id,
      editionLabel: edition.label,
      eventDate: edition.eventDate,
      variantId: variant.id,
      kind: variant.kind,
      badge: variant.badge,
      reward: variant.reward,
    })
    setActiveNoctraMomentId(record.id)
    setActiveNoctraStationId(record.stationId)
    await saveNoctraMoment(record)
    return record.id
  }

  const openStudio = (source: string, stationId = activeNoctraStationId || selectedStationId || experienceRuntime.photoStudio.defaultFilterId) => {
    trackExperienceEvent(!isNoctra, 'button_clicked', { action: 'photo_studio_opened', source })
    if (isNoctra) void prepareNoctraMoment(stationId)
    if (newUnlockNoticePending) {
      setNewUnlockNoticePending(false)
      showStudioNotice(experienceConfig.content.photoStudio.newUnlockNotice)
    }
    go('studio')
  }

  const completeStationDiscovery = async (stationId: string) => {
    const station = experienceRuntime.stationById[stationId]
    if (!station || station.type === 'secret') return

    trackExperienceEvent(!isNoctra, 'image_target_detected', { stationId: station.id, stationName: station.name, source: 'camera' })
    if (isNoctra) {
      setPendingDiscoveryStationId(null)
      setPendingDiscoveryReturnView(null)
    }

    const wasFound = isStationFound(station.id)
    const nextFoundStations = wasFound ? foundStations : { ...foundStations, [station.id]: true }
    const nextEngagementProgress = wasFound ? engagementProgress : applyStationEngagementUnlock(experienceConfig, engagementProgress, station.id)
    const missionComplete = explorationStationIds.every((missionStationId) => nextFoundStations[missionStationId] === true)
    const revealSecretAfterMoment = missionComplete && !secretRevealSeen && !secretStationFound
    if (!wasFound) {
      persistProgress(nextFoundStations, secretRevealSeen, nextEngagementProgress)
      const newRewards = getNewMicroRewards(experienceConfig, station.id, engagementProgress)
      if (isNoctra) {
        if (revealSecretAfterMoment) persistProgress(nextFoundStations, true, nextEngagementProgress)
        const { getNoctraStationVariant, NOCTRA_EDITIONS } = await import('./experiences/noctra/noctraMoments')
        const edition = NOCTRA_EDITIONS[noctraEditionId]
        const variant = getNoctraStationVariant(station.id, edition)
        await prepareNoctraMoment(station.id)
        setNoctraReveal({
          station,
          variant,
          progress: getEngagementCount(experienceConfig, nextFoundStations, nextEngagementProgress),
          required: experienceConfig.engagement?.goal.requiredUnlocks ?? explorationStationIds.length,
          rewards: newRewards.map((reward) => reward.title),
          continueTo: isNoctra && station.id === 'nova-drop' ? 'sponsor' : revealSecretAfterMoment ? 'secret-reveal' : 'stations',
        })
        if (typeof navigator.vibrate === 'function') navigator.vibrate(18)
        setSelectedStation(station)
        setSelectedStationId(station.id)
        if (station.id === eventStation.id) setNewUnlockNoticePending(true)
        go('noctra-reveal')
        return
      }
      setUnlockFeedback({
        key: ++unlockFeedbackKey.current,
        stationName: station.name,
        progress: getEngagementCount(experienceConfig, nextFoundStations, nextEngagementProgress),
        required: experienceConfig.engagement?.goal.requiredUnlocks ?? explorationStationIds.length,
        rewards: newRewards,
      })
    }

    setSelectedStation(station)
    setSelectedStationId(station.id)
    if (station.id === eventStation.id && !wasFound) setNewUnlockNoticePending(true)

    if (missionComplete && !secretRevealSeen && !secretStationFound) {
      persistProgress(nextFoundStations, true, nextEngagementProgress)
      go('secret-reveal')
      return
    }

    if (station.id === eventStation.id && !wasFound) {
      go('unlocked')
      return
    }
    if (isNoctra && station.id === 'nova-drop' && !wasFound) {
      go('sponsor')
      return
    }
    go('detail')
  }

  const unlockSecretStation = () => {
    const nextFoundStations = { ...foundStations, [secretStation.id]: true }
    const nextEngagementProgress = applyStationEngagementUnlock(experienceConfig, engagementProgress, secretStation.id)
    persistProgress(nextFoundStations, true, nextEngagementProgress)
    const newRewards = getNewMicroRewards(experienceConfig, secretStation.id, engagementProgress)
    setSelectedStation(secretStation)
    setSelectedStationId(secretStation.id)
    trackExperienceEvent(!isNoctra, 'button_clicked', { action: 'station_opened', stationId: secretStation.id, stationName: secretStation.name, source: 'secret_unlock' })
    if (isNoctra) {
      void (async () => {
        const { getNoctraStationVariant, NOCTRA_EDITIONS } = await import('./experiences/noctra/noctraMoments')
        const edition = NOCTRA_EDITIONS[noctraEditionId]
        const variant = getNoctraStationVariant(secretStation.id, edition)
        await prepareNoctraMoment(secretStation.id)
        setNoctraReveal({ station: secretStation, variant, progress: getEngagementCount(experienceConfig, nextFoundStations, nextEngagementProgress), required: experienceConfig.engagement?.goal.requiredUnlocks ?? explorationStationIds.length, rewards: newRewards.map((reward) => reward.title), continueTo: 'stations' })
        if (typeof navigator.vibrate === 'function') navigator.vibrate([18, 12, 26])
        go('noctra-reveal')
      })()
      return
    }
    setUnlockFeedback({
      key: ++unlockFeedbackKey.current,
      stationName: secretStation.name,
      progress: getEngagementCount(experienceConfig, nextFoundStations, nextEngagementProgress),
      required: experienceConfig.engagement?.goal.requiredUnlocks ?? explorationStationIds.length,
      rewards: newRewards,
    })
    go('detail')
  }
  const resetDemo = () => {
    if (!window.confirm('¿Querés reiniciar la demo y borrar el progreso?')) return
    const initialProgress = resetExperienceProgress(experienceRuntime)
    setFoundStations(initialProgress.foundStations)
    setSecretRevealSeen(initialProgress.secretRevealSeen)
    setEngagementProgress(initialProgress.engagement)
    setSelectedStation(eventStation)
    setSelectedStationId(null)
    setCapturedPhoto(null)
    setCapturedFilter(experienceRuntime.photoStudio.defaultFilterId)
    setActiveNoctraMomentId(null)
    setActiveNoctraStationId(null)
    setNoctraReveal(null)
    setPendingDiscoveryStationId(null)
    setPendingDiscoveryReturnView(null)
    setSponsorReturnView('stations')
    if (isNoctra) void import('./experiences/noctra/noctraMoments').then(({ resetNoctraMoments }) => resetNoctraMoments())
    setSelectedOverlay(experienceRuntime.photoStudio.defaultFilterId)
    setStudioTab('story')
    setStudioNotice(null)
    setNewUnlockNoticePending(false)
    setUnlockFeedback(null)
    go('home')
  }
  const openStation = (station: Station) => {
    trackExperienceEvent(!isNoctra, 'button_clicked', { action: 'station_opened', stationId: station.id, stationName: station.name, source: 'stations' })
    setSelectedStation(station)
    setSelectedStationId(station.id)
    if (isNoctra && station.type === 'permanent' && !isStationFound(station.id)) {
      go('discover')
      return
    }
    if (isNoctra && station.id === 'nova-drop') {
      setSponsorReturnView('stations')
      go('sponsor')
      return
    }
    go('detail')
  }
  const startExperience = () => {
    trackExperienceEvent(!isNoctra, 'experience_started', { source: 'home' })
    go('stations')
  }
  const openPassport = (source: string) => {
    trackExperienceEvent(!isNoctra, 'button_clicked', { action: 'passport_opened', source })
    go('passport')
  }
  const getDemoDiscoveryStationId = () => {
    if (isNoctra && pendingDiscoveryStationId) return pendingDiscoveryStationId
    const configuredStationIds = experienceConfig.discovery?.demoTapStationIds ?? []
    return configuredStationIds.find((stationId) => experienceRuntime.stationById[stationId] && !isStationFound(stationId))
      || configuredStationIds.find((stationId) => experienceRuntime.stationById[stationId])
  }
  const navigateFromMenu = (next: View) => {
    if (next === 'passport') {
      openPassport('menu')
      return
    }
    if (isNoctra && next === 'sponsor') setSponsorReturnView('menu')
    go(next)
  }
  const startNovaDiscovery = () => {
    setPendingDiscoveryStationId('nova-drop')
    setPendingDiscoveryReturnView('sponsor')
    go('discover')
  }
  const go = (next: View) => {
    if (next === view) return
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    setOutgoingView(view)
    setView(next)
    transitionTimer.current = window.setTimeout(() => setOutgoingView(null), 420)
  }

  const dismissUnlockFeedback = useCallback(() => setUnlockFeedback(null), [])
  const claimFinalReward = () => {
    if (finalRewardState !== 'ready') return
    persistProgress(foundStations, secretRevealSeen, { ...engagementProgress, finalRewardClaimed: true })
  }
  const engagementViewModel: EngagementViewModel | null = experienceConfig.engagement?.enabled && finalRewardState
    ? {
      experience: experienceRuntime,
      progress: engagementProgress,
      progressCount: engagementCount,
      progressMessage,
      rewardState: finalRewardState,
      unlockedMicroRewards,
      feedback: unlockFeedback,
      onOpenReward: () => go('reward'),
      onClaimReward: claimFinalReward,
      onDismissFeedback: dismissUnlockFeedback,
    }
    : null

  const renderView = (screen: View) => {
    if (isNoctra && screen === 'noctra-reveal' && noctraReveal) return <Suspense fallback={<main className="phone-screen" aria-label="Preparando momento" />}><NoctraExperienceUI mode="moment-reveal" stationName={noctraReveal.station.name} stationImage={noctraReveal.station.image} variant={noctraReveal.variant} editionId={noctraEditionId} progress={noctraReveal.progress} required={noctraReveal.required} rewards={noctraReveal.rewards} createLabel={noctraReveal.station.id === 'nova-drop' ? 'VER ACTIVACIÓN NOVA' : undefined} onCreate={() => { if (noctraReveal.station.id === 'nova-drop') { go('sponsor'); return } setSelectedOverlay(noctraReveal.station.id); void openStudio('moment_reveal', noctraReveal.station.id) }} onContinue={() => go(noctraReveal.continueTo)} /></Suspense>
    if (isNoctra && screen === 'noctra-night') return <Suspense fallback={<main className="phone-screen" aria-label="Abriendo tu noche" />}><NoctraExperienceUI mode="night-recap" editionId={noctraEditionId} rewardState={finalRewardState ?? 'locked'} stationImages={Object.fromEntries(experienceRuntime.stations.map((station) => [station.id, station.image]))} fallbackImage={experienceConfig.heroImage} onBack={() => go('passport')} onDiscover={() => go('discover')} /></Suspense>
    if (isNoctra && screen === 'upcoming') return <NoctraUpcomingDates onBack={() => go('menu')} />
    if (isNoctra && screen === 'lineup') return <NoctraLineup onBack={() => go('menu')} />
    if (isNoctra && screen === 'moments') return <NoctraMomentsCatalog onBack={() => go('menu')} onExplore={() => go('stations')} isStationFound={isStationFound} engagementCount={engagementCount} requiredCount={experienceConfig.engagement?.goal.requiredUnlocks ?? 4} rewardState={finalRewardState ?? 'locked'} />
    if (isNoctra && screen === 'edition') return <NoctraEditionSection onBack={() => go('menu')} editionId={noctraEditionId} isStationFound={isStationFound} rewardState={finalRewardState ?? 'locked'} />
    if (isNoctra && screen === 'experience-info') return <NoctraExperienceInfo onBack={() => go('menu')} onExplore={() => go('stations')} />
    if (isNoctra && screen === 'sponsor') return <NoctraSponsorActivation experience={experienceRuntime} editionId={noctraEditionId} isFound={isStationFound('nova-drop')} onBack={() => go(sponsorReturnView)} onFind={startNovaDiscovery} onPhoto={() => { setSelectedOverlay('nova-drop'); openStudio('nova_drop', 'nova-drop') }} onPassport={() => openPassport('nova_drop')} onContinue={() => go('stations')} />
    if (screen === 'reward' && experienceConfig.engagement?.enabled && finalRewardState) {
      const photoFilterId = experienceConfig.engagement.finalReward.photoStudioFilterId
      const canCreatePhoto = Boolean(photoFilterId && engagementProgress.unlockedPhotoFrameIds.includes(photoFilterId))
      return <FinalRewardScreen experience={experienceRuntime} progressCount={engagementCount} state={finalRewardState} onBack={() => go('stations')} onClaim={claimFinalReward} onPhoto={canCreatePhoto && photoFilterId ? () => { setSelectedOverlay(photoFilterId); openStudio('final_reward', isNoctra ? photoFilterId : undefined) } : undefined} />
    }
    if (screen === 'home') return <Home editionId={noctraEditionId} onStart={startExperience} onLearnMore={isNoctra ? scrollToDemoDisclosure : undefined} onCamera={() => go('discover')} onPassport={() => openPassport('home')} onMenu={() => go('menu')} />
    if (screen === 'discover') return <Discover allowDemoTapUnlock={experienceConfig.discovery?.allowDemoTapUnlock === true} demoStationId={getDemoDiscoveryStationId()} onClose={() => { const returnView = pendingDiscoveryReturnView; setPendingDiscoveryStationId(null); setPendingDiscoveryReturnView(null); go(returnView ?? 'home') }} onDetected={completeStationDiscovery} />
    if (screen === 'unlocked') return <Unlocked onBack={() => go('discover')} onDetails={() => openStation(eventStation)} onPhoto={() => openStudio('unlocked')} />
    if (screen === 'secret-reveal') return <SecretReveal onBack={() => go('stations')} onUnlock={unlockSecretStation} />
    if (screen === 'stations') return <Stations selectedStationId={selectedStationId} isStationFound={isStationFound} explorationFoundCount={explorationFoundCount} eventFoundCount={eventFoundCount} eventEditionTotal={eventStations.length} onCamera={() => go('discover')} onPassport={() => openPassport('stations')} onMenu={() => go('menu')} onOpen={openStation} />
    if (screen === 'studio') return <PhotoStudio selectedOverlay={selectedOverlay} isStationFound={isStationFound} isNoctra={isNoctra} editionId={noctraEditionId} notice={studioNotice} tab={studioTab} onSelect={setSelectedOverlay} onCaptured={async (photo, filter, blob, source) => {
      setCapturedPhoto(photo)
      setCapturedFilter(filter)
      if (isNoctra && blob) {
        const stationId = activeNoctraStationId || selectedStationId || filter
        const momentId = activeNoctraMomentId && activeNoctraStationId === stationId ? activeNoctraMomentId : await prepareNoctraMoment(stationId)
        if (momentId) {
          const { attachNoctraMomentPhoto } = await import('./experiences/noctra/noctraMoments')
          const saved = await attachNoctraMomentPhoto(momentId, blob, source ?? 'camera')
          if (!saved) showStudioNotice('No pudimos guardar este momento en el dispositivo.')
        }
      }
    }} onLocked={() => showStudioNotice(experienceConfig.content.photoStudio.lockedNotice)} onTab={setStudioTab} onClose={() => go('stations')} onResult={() => go('share')} />
    if (screen === 'share') return <ShareResult photoSrc={capturedPhoto || experienceConfig.cameraImage} filterId={capturedFilter} isNoctra={isNoctra} onClose={() => go('studio')} onEdit={() => go('studio')} />
    if (screen === 'detail') return <StationDetail station={selectedStation} onBack={() => go('stations')} onPhoto={() => openStudio('station_detail', selectedStation.id)} />
    if (screen === 'passport') return <Passport stationTotal={stationTotal} explorationFoundCount={explorationFoundCount} isStationFound={isStationFound} isNoctra={isNoctra} onOpenNight={() => go('noctra-night')} onExplore={() => go('stations')} onCamera={() => go('discover')} onMenu={() => go('menu')} />
    if (screen === 'upcoming') return <Upcoming onExplore={() => go('stations')} onCamera={() => go('discover')} onPassport={() => openPassport('upcoming')} onMenu={() => go('menu')} />
    return <Menu onClose={() => go('home')} onNavigate={navigateFromMenu} onReset={resetDemo} />
  }

  const themeStyle = {
    '--experience-bg': experienceConfig.theme.background,
    '--experience-screen-bg': experienceConfig.theme.screen,
    '--experience-fg': experienceConfig.theme.foreground,
    '--experience-accent': experienceConfig.theme.accent,
    '--experience-border': experienceConfig.theme.border,
    '--experience-border-subtle': experienceConfig.theme.borderSubtle,
    '--experience-border-strong': experienceConfig.theme.borderStrong,
    '--experience-button-bg': experienceConfig.theme.buttonBackground,
    '--experience-button-fg': experienceConfig.theme.buttonForeground,
    '--experience-active-fg': experienceConfig.theme.activeForeground,
    '--experience-card-radius': experienceConfig.theme.cardRadius,
    '--experience-content-padding': experienceConfig.theme.contentPadding,
    '--experience-station-card-height': experienceConfig.theme.stationCardHeight,
    '--experience-home-copy-bottom': experienceConfig.theme.homeCopyBottom,
    '--experience-home-hero-position': experienceConfig.theme.homeHeroPosition,
    '--experience-detail-hero-height': experienceConfig.theme.detailHeroHeight,
    '--experience-nav-background': experienceConfig.theme.navBackground,
  } as CSSProperties

  return <EngagementContext.Provider value={engagementViewModel}><ExperienceContext.Provider value={experience}><main className={`app-shell${isNoctra ? ' noctra-app' : ''}${isNoctra && view === 'home' ? ' noctra-home-active' : ''}`} style={themeStyle}><div className="motion-stage">
    {outgoingView && <div className="motion-layer outgoing" aria-hidden="true">{renderView(outgoingView)}</div>}
    <div className="motion-layer incoming">{renderView(view)}</div>
  </div><EngagementUnlockFeedback /></main></ExperienceContext.Provider></EngagementContext.Provider>
}

function Header({ page, onBack }: { page?: string; onBack?: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  return <header className="topbar">
    {onBack ? <button className="icon-button" onClick={onBack}><ArrowLeft size={19} /></button> : <span className="brand-lockup"><img src={experienceConfig.logo} alt="" /> {experienceConfig.name}</span>}
    {page ? <span className="topbar-page">{page}</span> : <span className="topbar-spacer" />}
  </header>
}

function BottomNav({ active, onExplore, onCamera, onPassport }: { active: string; onExplore: () => void; onCamera: () => void; onPassport: () => void }) {
  const navigation = useExperienceRuntime().config.content.navigation
  return <nav className="bottom-nav"><button className={active === 'explore' ? 'active' : ''} onClick={onExplore}><Sparkles size={17} /><span>{navigation.explore}</span></button><button className={active === 'camera' ? 'active' : ''} onClick={onCamera}><Camera size={18} /><span>{navigation.camera}</span></button><button className={active === 'passport' ? 'active' : ''} onClick={onPassport}><Grid2X2 size={17} /><span>{navigation.passport}</span></button></nav>
}

function Home({ editionId, onStart, onLearnMore, onCamera, onPassport, onMenu }: { editionId: string; onStart: () => void; onLearnMore?: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const content = experienceConfig.content.home
  const isNoctra = experienceConfig.id === 'noctra'
  const hasDemoDisclosure = Boolean(content.demoDisclosureTitle && content.demoDisclosureBody)
  const [noctraTransitioning, setNoctraTransitioning] = useState(false)
  const [memoryMetaPhase, setMemoryMetaPhase] = useState(false)
  const [memorySignalHovered, setMemorySignalHovered] = useState(false)
  const [memorySignalPinned, setMemorySignalPinned] = useState(false)
  const [memoryCtaActive, setMemoryCtaActive] = useState(false)
  const memorySignalActive = memorySignalHovered || memorySignalPinned
  const entryTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (entryTimer.current !== null) window.clearTimeout(entryTimer.current)
  }, [])
  useEffect(() => {
    if (!isNoctra || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = window.setInterval(() => setMemoryMetaPhase((phase) => !phase), 5400)
    return () => window.clearInterval(interval)
  }, [isNoctra])

  const start = () => {
    if (!isNoctra) {
      onStart()
      return
    }
    if (entryTimer.current !== null) return
    setMemoryCtaActive(true)
    setNoctraTransitioning(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      onStart()
      return
    }
    entryTimer.current = window.setTimeout(() => {
      entryTimer.current = null
      onStart()
    }, 760)
  }

  const cancelEntryAndOpenMenu = () => {
    if (entryTimer.current !== null) {
      window.clearTimeout(entryTimer.current)
      entryTimer.current = null
      setNoctraTransitioning(false)
    }
    onMenu()
  }

  if (isNoctra) {
    const editionLabel = editionId === 'night-02' ? 'NIGHT 02 · MENDOZA' : editionId === 'sunset-special' ? 'SUNSET EDITION · MENDOZA' : 'NIGHT 03 · MENDOZA'
    const nightLabel = editionId === 'night-02' ? 'NIGHT 02' : editionId === 'sunset-special' ? 'SUNSET SPECIAL' : 'NIGHT 03'
    return <section className={`phone-screen home-screen has-demo-disclosure noctra-home-screen${noctraTransitioning ? ' noctra-transition-active' : ''}`}>
      <div
        className={`home-hero noctra-memory${noctraTransitioning ? ' is-entering' : ''}${memorySignalActive ? ' is-signal-active' : ''}${memoryCtaActive ? ' is-cta-active' : ''}`}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = ((event.clientX - bounds.left) / bounds.width - .5) * 12
          const y = ((event.clientY - bounds.top) / bounds.height - .5) * 12
          event.currentTarget.style.setProperty('--pointer-x', `${x.toFixed(1)}px`)
          event.currentTarget.style.setProperty('--pointer-y', `${y.toFixed(1)}px`)
          event.currentTarget.style.setProperty('--pointer-back-x', `${(x * -.48).toFixed(1)}px`)
          event.currentTarget.style.setProperty('--pointer-back-y', `${(y * -.48).toFixed(1)}px`)
          event.currentTarget.style.setProperty('--object-x', `${(x * .76).toFixed(1)}px`)
          event.currentTarget.style.setProperty('--object-y', `${(y * .76).toFixed(1)}px`)
          event.currentTarget.style.setProperty('--halo-angle', `${(x * .38 + y * .16).toFixed(2)}deg`)
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty('--pointer-x', '0px')
          event.currentTarget.style.setProperty('--pointer-y', '0px')
          event.currentTarget.style.setProperty('--pointer-back-x', '0px')
          event.currentTarget.style.setProperty('--pointer-back-y', '0px')
          event.currentTarget.style.setProperty('--object-x', '0px')
          event.currentTarget.style.setProperty('--object-y', '0px')
          event.currentTarget.style.setProperty('--halo-angle', '0deg')
          setMemorySignalHovered(false)
          setMemoryCtaActive(false)
        }}
      >
        <div className="noctra-memory__scene">
        <img src={assetUrl('experiences/noctra/photos/friends/noctra-photo-friends-01-portrait.webp')} alt="Dos amistades guardan un momento entre luces cálidas y violetas." fetchPriority="high" />
        </div>
        <div className="noctra-memory__foreground" aria-hidden="true"><i className="noctra-memory__sweep" /><i className="noctra-memory__glint" /></div>
        <button
          type="button"
          className="noctra-memory__anomaly"
          aria-label={memorySignalPinned ? 'Desactivar la respuesta de Signal 01' : 'Sintonizar Signal 01'}
          aria-pressed={memorySignalPinned}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setMemorySignalHovered(true) }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setMemorySignalHovered(false) }}
          onClick={() => setMemorySignalPinned((active) => !active)}
        >
          <svg viewBox="0 0 520 760" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="noctra-orbit-chrome" x1=".08" y1=".9" x2=".92" y2=".08">
                <stop offset="0" stopColor="#ed735b" stopOpacity=".36" />
                <stop offset=".28" stopColor="#ffc39f" stopOpacity=".94" />
                <stop offset=".52" stopColor="#fff2dc" stopOpacity=".78" />
                <stop offset=".76" stopColor="#aaa7e8" stopOpacity=".88" />
                <stop offset="1" stopColor="#ed735b" stopOpacity=".52" />
              </linearGradient>
              <filter id="noctra-orbit-halo" x="-70%" y="-30%" width="240%" height="160%">
                <feGaussianBlur stdDeviation="5" result="softGlow" />
                <feMerge><feMergeNode in="softGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <ellipse className="noctra-memory__orbit-shadow" cx="260" cy="380" rx="218" ry="351" />
            <path className="noctra-memory__orbit-glass" d="M249 30C389 19 479 124 485 294C487 337 484 360 478 394M471 438C449 560 389 667 309 722" />
            <path className="noctra-memory__orbit-glass" d="M260 742C126 749 43 637 36 481C28 321 53 153 144 69C178 38 215 27 247 30" />
            <path className="noctra-memory__orbit-edge" d="M249 30C389 19 479 124 485 294C487 337 484 360 478 394M471 438C449 560 389 667 309 722" />
            <path className="noctra-memory__orbit-edge" d="M260 742C126 749 43 637 36 481C28 321 53 153 144 69C178 38 215 27 247 30" />
            <path className="noctra-memory__orbit-trace" d="M256 50C137 55 67 181 65 344M451 470C424 584 365 660 312 690M96 570C114 648 168 695 226 704" />
            <path className="noctra-memory__orbit-mark" d="M230 19h60M260 -11v60M472 399h42M493 378v42M235 738h51M260 712v52" />
            <circle className="noctra-memory__orbit-node" cx="479" cy="415" r="7" />
            <circle className="noctra-memory__orbit-node-core" cx="479" cy="415" r="2.5" />
          </svg>
        </button>
        <header className="noctra-memory__header">
          <img src={assetUrl('experiences/noctra/noctra-wordmark.svg')} alt="NOCTRA" />
          <span className="noctra-memory__edition">{editionLabel}<i />29.09.26</span>
          <button className="top-menu-button noctra-memory__menu" onClick={cancelEntryAndOpenMenu} aria-label="Abrir menú"><MenuIcon size={19} /></button>
        </header>
        <div className="noctra-memory__copy">
          <span className="noctra-memory__eyebrow">UN RECUERDO DE ESTA NOCHE</span>
          <h1><span>HAY NOCHES QUE</span><span>TERMINAN.</span><em><span>OTRAS TE LAS</span><span>LLEVÁS.</span></em></h1>
        </div>
        <div className="noctra-memory__record" aria-label={`MAIN STAGE, 29.09.26, ${nightLabel}`}>
          <span className="noctra-memory__record-mark" aria-hidden="true" />
          <div><strong>MAIN STAGE</strong><span>29.09.26 <i /> {nightLabel}</span></div>
          <small className={memoryMetaPhase ? 'is-meta-revealed' : ''}>{memoryMetaPhase ? 'FRAME 01 · GUARDADO' : 'MOMENTO PERSONAL'}</small>
        </div>
        <div className="noctra-memory__signal"><span>SIGNAL_01</span><strong>{memorySignalActive ? 'TUNED TO YOU' : 'UNKNOWN'}</strong></div>
        <div className="noctra-memory__reward" aria-label="Backstage Access, bloqueado hasta completar tres de cuatro momentos">
          <span>RECOMPENSA · 03 / 04</span><strong>BACKSTAGE ACCESS</strong><span className="noctra-memory__locked"><i /> LOCKED</span>
        </div>
        <div className="noctra-memory__footer">
          <p>4 MOMENTOS <i /> 1 SEÑAL OCULTA <i /> 1 RECOMPENSA</p>
          <div className="noctra-memory__progress" aria-label="Progreso de desbloqueo: tres de cuatro momentos para Backstage Access"><span>03 / 04 · BACKSTAGE</span><span className="noctra-memory__progress-line" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={3} aria-label="3 de 4"><i /></span></div>
        </div>
        <button className="noctra-memory__cta" onClick={start} onPointerEnter={() => setMemoryCtaActive(true)} onPointerLeave={() => setMemoryCtaActive(false)} onFocus={() => setMemoryCtaActive(true)} onBlur={() => setMemoryCtaActive(false)} aria-disabled={noctraTransitioning} aria-label="Entrar a NOCTRA"><span>ENTRAR</span><ArrowRight size={16} aria-hidden="true" /></button>
        <div className="noctra-memory__flash" aria-hidden="true" />
      </div>
      <section className="home-demo-disclosure" id="noctra-home-disclosure">
        <h2>{content.demoDisclosureTitle}</h2>
        <p>{content.demoDisclosureBody}</p>
        {content.demoDisclosureNote && <p className="home-demo-disclosure__note">{content.demoDisclosureNote}</p>}
        <small>Demo creada por Corsteno.</small>
        <button className="cream-button" onClick={start}>{content.secondaryStartLabel || content.startLabel} <ArrowRight size={18} /></button>
      </section>
    </section>
  }

  return <section className={`phone-screen home-screen${hasDemoDisclosure ? ' has-demo-disclosure' : ''}${isNoctra ? ' noctra-home-screen' : ''}`}>
    <div className="home-hero">
      <div className="photo-bg" style={{ backgroundImage: `url(${experienceConfig.heroImage})` }} />
      {isNoctra && <div className="noctra-home-atmosphere" aria-hidden="true"><i /><i /><i /><span /></div>}
      <div className="photo-shade" />
      <Header />
      <button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button>
      {isNoctra ? <div className="home-copy noctra-home-copy">
        <span className="noctra-home-eyebrow">{editionId === 'night-02' ? 'NIGHT 02 · MENDOZA' : editionId === 'sunset-special' ? 'SUNSET EDITION · MENDOZA' : 'NIGHT 03 · MENDOZA'}</span>
        <h1><span>ALGUNAS NOCHES<br className="noctra-home-mobile-break" /> PASAN.</span><em>OTRAS QUEDAN.</em></h1>
        <p>Encontrá momentos. Guardá tu noche. Desbloqueá lo que no todos ven.</p>
        <Suspense fallback={null}><NoctraExperienceUI mode="home-loop" editionId={editionId} /></Suspense>
        <button className="cream-button noctra-home-cta" onClick={onStart}>ENTRAR A NOCTRA <ArrowRight size={18} /></button>
      </div> : <>
        <div className="home-tag"><ContentLines lines={content.tagLines} /></div>
        <div className="home-copy">
          {content.demoLabel && <span className="home-demo-mark">{content.demoLabel}</span>}
          <h1><ContentLines lines={content.titleLines} /></h1>
          <p>{experienceConfig.tagline}</p>
          <button className="cream-button" onClick={hasDemoDisclosure ? onLearnMore ?? onStart : onStart}>{content.startLabel} <ArrowRight size={18} /></button>
          <EngagementCard variant="home" />
          {!hasDemoDisclosure && <p className="home-demo-note"><strong>{content.demoNoteTitle}</strong> {content.demoNote}</p>}
        </div>
        <BottomNav active="explore" onExplore={onStart} onCamera={onCamera} onPassport={onPassport} />
      </>}
    </div>
    {hasDemoDisclosure && <section className="home-demo-disclosure" id="noctra-home-disclosure">
      <h2>{content.demoDisclosureTitle}</h2>
      <p>{content.demoDisclosureBody}</p>
      {content.demoDisclosureNote && <p className="home-demo-disclosure__note">{content.demoDisclosureNote}</p>}
      <small>Demo creada por Corsteno.</small>
      <button className="cream-button" onClick={onStart}>{content.secondaryStartLabel || content.startLabel} <ArrowRight size={18} /></button>
    </section>}
  </section>
}

function Discover({ onClose, onDetected, allowDemoTapUnlock, demoStationId }: { onClose: () => void; onDetected: (stationId: string) => void; allowDemoTapUnlock: boolean; demoStationId?: string }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const isNoctra = experienceConfig.id === 'noctra'
  const content = experienceConfig.content.discover
  const qrStationIds = new Set(experienceRuntime.qrStationIds)
  const [scanState, setScanState] = useState<'searching' | 'detected' | 'unlocking'>('searching')
  const [cameraNotice, setCameraNotice] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const hasDetectedRef = useRef(false)
  const mountedRef = useRef(true)
  const detectionTimersRef = useRef<number[]>([])

  const clearDetectionTimers = () => {
    detectionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    detectionTimersRef.current = []
  }

  const stopScanner = () => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
  }

  const cleanupDiscover = () => {
    clearDetectionTimers()
    stopScanner()
    stopCamera()
  }

  const closeDiscover = () => {
    cleanupDiscover()
    onClose()
  }

  const triggerDetection = (stationId: string) => {
    if (!stationId || hasDetectedRef.current) return

    hasDetectedRef.current = true
    scannerControlsRef.current?.stop()
    setScanState('detected')
    const detectedTimer = window.setTimeout(() => {
      if (!mountedRef.current) return
      setScanState('unlocking')
      const unlockTimer = window.setTimeout(() => {
        if (!mountedRef.current) return
        cleanupDiscover()
        onDetected(stationId)
      }, 220)
      detectionTimersRef.current.push(unlockTimer)
    }, 520)
    detectionTimersRef.current.push(detectedTimer)
  }

  const handleDemoTap = () => {
    if (!allowDemoTapUnlock || scanState !== 'searching' || !demoStationId) return
    triggerDetection(demoStationId)
  }

  useEffect(() => {
    mountedRef.current = true
    let mounted = true
    const cameraError = 'No pudimos acceder a la cámara. Revisá los permisos e intentá nuevamente.'
    const scannerError = 'No pudimos iniciar el lector. Revisá los permisos de cámara e intentá nuevamente.'

    const startScanner = async (stream: MediaStream, video: HTMLVideoElement) => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (!mounted || hasDetectedRef.current || !result) return
          const stationId = parseStationQr(result.getText(), qrStationIds)
          if (!stationId) return

          triggerDetection(stationId)
        })

        if (!mounted || hasDetectedRef.current) {
          controls.stop()
          return
        }
        scannerControlsRef.current = controls
      } catch (error: unknown) {
        if (!mounted) return
        if (isCameraPermissionDenied(error)) trackExperienceEvent(experienceConfig.id !== 'noctra', 'camera_permission_denied', { source: 'discover' })
        cleanupDiscover()
        setCameraNotice(scannerError)
      }
    }

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraNotice(cameraError)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        trackExperienceEvent(experienceConfig.id !== 'noctra', 'camera_permission_granted', { source: 'discover' })

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((track) => track.stop())
          setCameraNotice(cameraError)
          return
        }

        streamRef.current = stream
        video.srcObject = stream
        video.muted = true
        video.playsInline = true

        await new Promise<void>((resolve, reject) => {
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0) {
            resolve()
            return
          }
          let settled = false
          const timeoutId = window.setTimeout(() => {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error('camera-video-not-ready'))
          }, 4000)
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', handleReady)
            video.removeEventListener('canplay', handleReady)
            window.clearTimeout(timeoutId)
          }
          const handleReady = () => {
            if (settled || !video.videoWidth || !video.videoHeight) return
            settled = true
            cleanup()
            resolve()
          }
          video.addEventListener('loadedmetadata', handleReady)
          video.addEventListener('canplay', handleReady)
        })

        await video.play()
        void startScanner(stream, video)
      } catch (error: unknown) {
        if (mounted) {
          if (isCameraPermissionDenied(error)) trackExperienceEvent(experienceConfig.id !== 'noctra', 'camera_permission_denied', { source: 'discover' })
          cleanupDiscover()
          setCameraNotice(cameraError)
        }
      }
    }

    void startCamera()
    return () => {
      mounted = false
      mountedRef.current = false
      cleanupDiscover()
    }
  }, [])

  const scanLabel = scanState === 'searching' ? content.searchingLabel : scanState === 'detected' ? content.detectedLabel : content.unlockingLabel
  const reticleContent = <><span /><span /><span /><span /><div className="station-logo-mark"><img src={experienceConfig.logo} alt={content.logoLabel} /><small>{content.logoLabel}</small></div></>
  const reticle = allowDemoTapUnlock
    ? <button type="button" className="reticle" aria-label="Simular detección de sello" onClick={handleDemoTap}>{reticleContent}</button>
    : <div className="reticle" aria-hidden="true">{reticleContent}</div>
  if (isNoctra) return <section className={`phone-screen discover-screen noctra-discover scan-${scanState}`} style={{ backgroundImage: `url(${experienceConfig.cameraImage})` }}>
    <header className="floating-header noctra-discover__header"><div><img src={experienceConfig.logo} alt="NOCTRA" /><span>BUSCADOR DE MOMENTOS</span></div><button type="button" className="icon-button discover-close-button" onClick={closeDiscover} aria-label="Cerrar búsqueda"><X size={21} /></button></header>
    <div className="discover-copy noctra-discover__copy"><span className="noctra-discover__eyebrow">NIGHT 03 · SEÑAL 01</span><h1>{content.title}</h1><p><ContentLines lines={content.descriptionLines} /></p></div>
    <div className="noctra-discover__scanner"><div className="noctra-discover__camera-window" style={{ backgroundImage: `url(${experienceConfig.cameraImage})` }}><video ref={videoRef} className="discover-camera" autoPlay playsInline muted aria-label="Vista de cámara de búsqueda" /><div className="noctra-discover__scan-line" aria-hidden="true" />{reticle}<span className="noctra-discover__tap-label">{allowDemoTapUnlock ? 'TOCÁ EL SELLO PARA PROBAR' : 'ALINEÁ UN CÓDIGO DE ESTACIÓN'}</span><span className="noctra-discover__frame-label">NOCTRA · MENDOZA</span></div></div>
    {cameraNotice && <p className="discover-camera-notice noctra-discover__notice" role="alert">{cameraNotice}</p>}
    <div className="discover-bottom noctra-discover__status" role="status"><div className="round-scan"><ScanLine size={20} /></div><p className="scan-status">{scanLabel}<br /><span>{content.completionHint}</span></p></div>
  </section>
  return <section className={`phone-screen full-photo-screen discover-screen scan-${scanState}`} style={{ backgroundImage: `url(${experienceConfig.cameraImage})` }}><video ref={videoRef} className="discover-camera" autoPlay playsInline muted aria-label="Vista de cámara de búsqueda" /><div className="photo-shade strong" /><header className="floating-header"><button type="button" className="icon-button discover-close-button" onClick={closeDiscover} aria-label="Cerrar búsqueda"><X size={21} /></button><Sparkles size={18} /></header><div className="discover-copy"><h2>{content.title}</h2><p><ContentLines lines={content.descriptionLines} /></p></div>{reticle}{cameraNotice && <p className="discover-camera-notice">{cameraNotice}</p>}<div className="discover-bottom"><div className="round-scan"><ScanLine size={23} /></div><p className="scan-status">{scanLabel}<br />{content.completionHint}</p></div></section>
}

function Unlocked({ onBack, onDetails, onPhoto }: { onBack: () => void; onDetails: () => void; onPhoto: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.unlocked
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const filterBackgrounds = experienceRuntime.photoStudio.filterBackgrounds
  const eventStationBackground = filterBackgrounds[eventStation.id]
  return <section className="phone-screen full-photo-screen unlocked-screen" style={{ backgroundImage: `url(${eventStationBackground})` }}><div className="atmosphere-layer" style={{ backgroundImage: `url(${eventStationBackground})` }} /><div className="photo-shade strong" /><header className="floating-header"><button className="icon-button unlocked-back-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button><span>{content.brandLabel}</span><span>{content.page}</span></header><div className="unlocked-copy"><p className="eyebrow">{content.unlockedLabel}</p><p className="eyebrow">{content.specialEditionLabel}</p><h1>{eventStation.name}</h1><p>{eventStation.description}</p></div><div className="stacked-actions"><button className="cream-button" onClick={onDetails}>{content.detailsLabel} <ArrowRight size={18} /></button><button className="outline-button" onClick={onPhoto}>{content.photoLabel}</button></div></section>
}

function SecretReveal({ onBack, onUnlock }: { onBack: () => void; onUnlock: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const content = experienceRuntime.config.content.secretReveal
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const filterBackgrounds = experienceRuntime.photoStudio.filterBackgrounds
  const secretBackground = filterBackgrounds[secretStation.id]
  return <section className="phone-screen full-photo-screen secret-reveal-screen" style={{ backgroundImage: `url(${secretBackground || secretStation.image})` }}><div className="photo-shade strong" /><header className="floating-header"><button className="icon-button secret-reveal-back-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button><span>{content.brandLabel}</span><span>{content.page}</span></header><div className="unlocked-copy secret-reveal-copy"><p className="eyebrow">{content.revealedLabel}</p><p className="eyebrow">{content.subtitle}</p><h1>{content.title}</h1><p><ContentLines lines={content.descriptionLines} /></p></div><div className="stacked-actions"><button className="cream-button" onClick={onUnlock}>{content.unlockLabel} <ArrowRight size={18} /></button></div></section>
}

function ExplorationProgress({ foundCount }: { foundCount: number }) {
  const experienceRuntime = useExperienceRuntime()
  const content = experienceRuntime.config.content.stations
  const explorationStationIds = experienceRuntime.explorationStationIds
  const engagement = useEngagementView()
  const progressCount = engagement?.progressCount ?? foundCount
  const total = experienceRuntime.config.engagement?.enabled ? experienceRuntime.config.engagement.goal.requiredUnlocks : explorationStationIds.length
  const copy = engagement
    ? engagement.progressMessage
    : foundCount === explorationStationIds.length
    ? content.explorationComplete
    : foundCount === explorationStationIds.length - 1
      ? content.explorationRemaining
      : content.explorationIntro || content.explorationComplete
  return <div className="exploration-progress"><div className="exploration-progress-heading"><span>{content.explorationTitle}</span><span>{progressCount} / {total}</span></div><div className="exploration-progress-dots" aria-label={`${progressCount} de ${total} objetivos completados`}>{Array.from({ length: total }, (_, index) => <span className={progressCount > index ? 'found' : ''} key={index} />)}</div><p>{copy}</p></div>
}

function Stations({ selectedStationId, isStationFound, explorationFoundCount, eventFoundCount, eventEditionTotal, onCamera, onPassport, onMenu, onOpen }: { selectedStationId: string | null; isStationFound: (stationId: string) => boolean; explorationFoundCount: number; eventFoundCount: number; eventEditionTotal: number; onCamera: () => void; onPassport: () => void; onMenu: () => void; onOpen: (station: Station) => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.stations
  const permanentStations = experienceRuntime.permanentStations
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const isNoctra = experienceConfig.id === 'noctra'
  const permanentFoundCount = permanentStations.filter((station) => isStationFound(station.id)).length
  const [activeTab, setActiveTab] = useState('all')
  const eventStationFound = isStationFound(eventStation.id)
  const secretStationFound = isStationFound(secretStation.id)
  const engagement = useEngagementView()
  const secretHints = experienceConfig.engagement?.secretHints
  const secretProgress = engagement?.progressCount ?? explorationFoundCount
  const secretNear = Boolean(secretHints?.showNearAfter && !secretStationFound && secretProgress >= secretHints.showNearAfter)
  const secretDetected = Boolean(secretHints && !secretStationFound && !secretNear && secretProgress >= secretHints.showDetectedAfter)
  const secretTitle = secretStationFound ? secretHints?.foundTitle || secretStation.name : secretNear ? secretHints?.nearTitle || secretStation.name : secretDetected ? secretHints?.detectedTitle || secretStation.name : secretHints?.lockedTitle || '???'
  const secretMessage = secretStationFound ? secretHints?.foundMessage || content.secretFoundLabel : secretNear ? secretHints?.nearMessage || secretHints?.detectedMessage || content.secretLockedLabel : secretDetected ? secretHints?.detectedMessage || content.secretLockedLabel : secretHints?.lockedMessage || content.secretLockedLabel
  return <section className="phone-screen stations-screen"><Header page={content.headerSuffix} /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="stations-tabs">{[['all', content.tabs.all], ['permanent', content.tabs.permanent], ['special', content.tabs.special]].map(([id, label]) => <button key={id} className={activeTab === id ? 'selected' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div><div className="stations-content"><ExplorationProgress foundCount={explorationFoundCount} /><div className="section-label"><span>{content.permanentLabel}</span><span>{(isNoctra ? permanentFoundCount : permanentStations.length).toString().padStart(2, '0')} / {permanentStations.length.toString().padStart(2, '0')}</span></div><div className="station-grid-ref">{permanentStations.map((station) => <StationTile key={station.id} station={station} selected={selectedStationId === station.id} locked={isNoctra && !isStationFound(station.id)} onOpen={onOpen} />)}</div><div className="section-label event-label"><span>{content.eventLabel}</span><span><span key={eventFoundCount} className="event-progress-count">{eventFoundCount.toString().padStart(2, '0')}</span> / {eventEditionTotal.toString().padStart(2, '0')}</span></div><button className={`event-strip ${eventStationFound ? '' : 'locked-event-strip'}`} disabled={!eventStationFound} aria-disabled={!eventStationFound} onClick={() => { if (isStationFound(eventStation.id)) onOpen(eventStation) }}><img className={eventStationFound ? undefined : 'locked-event-image'} src={eventStation.image} alt={eventStation.name} /><div><h3>{eventStation.name}</h3><p>{eventStationFound ? content.foundLabel : <><>{content.notFoundLabel}</><br />{content.eventAvailability}</>}</p></div>{eventStationFound && <ArrowRight size={20} />}</button><button className={`secret-strip ${secretStationFound ? 'secret-unlocked' : 'secret-locked'}`} data-secret-state={secretStationFound ? 'found' : secretNear ? 'near' : secretDetected ? 'detected' : 'unknown'} disabled={!secretStationFound} aria-disabled={!secretStationFound} onClick={() => { if (secretStationFound) onOpen(secretStation) }}><div className="secret-blur" style={{ backgroundImage: `url(${secretStation.image})` }} /><div className="secret-strip__copy"><strong>{secretTitle}</strong><span>{secretMessage}</span></div>{secretStationFound && <ArrowRight size={18} />}</button><EngagementCard variant="stations" /></div><BottomNav active="explore" onExplore={() => undefined} onCamera={onCamera} onPassport={onPassport} /></section>
}

function StationTile({ station, selected, locked = false, onOpen }: { station: Station; selected: boolean; locked?: boolean; onOpen: (station: Station) => void }) {
  const content = useExperienceRuntime().config.content.stations
  const numeral = ['I', 'II', 'III', 'IV'][station.count - 1]
  return <button className={`station-tile ${selected ? 'selected-station' : ''}${locked ? ' locked-station' : ''}`} data-station-id={station.id} aria-label={`${station.name}, ${locked ? content.notFoundLabel : content.foundLabel}`} onClick={() => onOpen(station)}><img src={station.image} alt="" /><div className="tile-shade" /><div className="tile-copy"><strong>{station.name}</strong><b>{numeral}</b><small>{locked ? content.notFoundLabel : content.foundLabel}<br />{station.count} {station.count === 1 ? content.tileTimesSingular : content.tileTimesPlural}</small></div></button>
}

function PhotoStudio({ selectedOverlay, isStationFound, isNoctra, editionId, notice, tab, onSelect, onCaptured, onLocked, onTab, onClose, onResult }: { selectedOverlay: string; isStationFound: (stationId: string) => boolean; isNoctra: boolean; editionId: string; notice: string | null; tab: string; onSelect: (id: string) => void; onCaptured: (photo: string, filter: string, blob?: Blob, source?: 'camera' | 'selected' | 'demo') => void | Promise<void>; onLocked: () => void; onTab: (tab: string) => void; onClose: () => void; onResult: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const engagement = useEngagementView()
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const filterEffects = experienceRuntime.photoStudio.filterEffects
  const filterBackgrounds = experienceRuntime.photoStudio.filterBackgrounds
  const filterCompositeEffects = experienceRuntime.photoStudio.filterCompositeEffects
  const filterMediaEffects = experienceRuntime.photoStudio.filterMediaEffects
  const filterOverlayColors = experienceRuntime.photoStudio.filterOverlayColors
  const segmentationBackgroundId = experienceRuntime.photoStudio.segmentationBackgroundId
  const content = experienceConfig.content.photoStudio
  const isFrameLocked = (filterId: string) => {
    const frame = experienceConfig.engagement?.photoStudioUnlocks?.find((item) => item.filterId === filterId)
    return Boolean(frame?.requiredStationId && !engagement?.progress.unlockedPhotoFrameIds.includes(filterId))
  }
  const options = experienceRuntime.photoStudio.filters.filter((filter) => filter.id !== secretStation.id || isStationFound(secretStation.id))
  const cameraDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get('cameraDebug') === 'true'
  const segDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get('segDebug') === 'true'
  const videoRef = useRef<HTMLVideoElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const captureGenerationRef = useRef(0)
  const captureBusyRef = useRef(false)
  const captureAbortControllerRef = useRef<AbortController | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [isPreparingMoment, setIsPreparingMoment] = useState(false)
  const [cameraNotice, setCameraNotice] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'connecting' | 'live' | 'captured' | 'fallback' | 'error'>('idle')
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'error'>('unknown')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [segmentationState, setSegmentationState] = useState<'idle' | 'loading' | 'live' | 'fallback' | 'error'>('idle')
  const [hasCompositeFrame, setHasCompositeFrame] = useState(false)
  const [, setDiagnosticRevision] = useState(0)
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null)
  const personCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const alphaMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const featherMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lightWrapCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const debugVideoCanvasRef = useRef<HTMLCanvasElement>(null)
  const debugMaskCanvasRef = useRef<HTMLCanvasElement>(null)
  const debugCompositeCanvasRef = useRef<HTMLCanvasElement>(null)
  const segmenterRef = useRef<ImageSegmenter | null>(null)
  const segmenterPromiseRef = useRef<Promise<ImageSegmenter> | null>(null)
  const segmentationFrameRef = useRef<number | null>(null)
  const segmentationFrameModeRef = useRef<'video' | 'raf' | null>(null)
  const segmentingRef = useRef(false)
  const processingRef = useRef(false)
  const processingSessionIdRef = useRef<number | null>(null)
  const lastWebcamTimeRef = useRef(-1)
  const temporalAlphaRef = useRef<Float32Array | null>(null)
  const performanceMetricsRef = useRef({ startedAt: 0, cameraFrames: 0, segmentationFrames: 0, inferenceMs: 0 })
  const hasCompositeFrameRef = useRef(false)
  const startSegmentationRef = useRef<() => Promise<void>>(async () => undefined)
  const selectedOverlayRef = useRef(selectedOverlay)
  const backgroundPreloadRef = useRef<Promise<void> | null>(null)
  const lastValidBackgroundIdRef = useRef(segmentationBackgroundId)
  const sessionIdRef = useRef(0)
  selectedOverlayRef.current = selectedOverlay

  const recordPerformance = (inferenceMs?: number) => {
    if (!import.meta.env.DEV) return
    const now = performance.now()
    const metrics = performanceMetricsRef.current
    if (!metrics.startedAt) metrics.startedAt = now
    if (inferenceMs === undefined) metrics.cameraFrames += 1
    else {
      metrics.segmentationFrames += 1
      metrics.inferenceMs += inferenceMs
    }
    const elapsed = now - metrics.startedAt
    if (elapsed < 2000) return
    if (cameraDebug || segDebug) {
      console.debug('[PhotoStudio performance]', {
        cameraFps: Number((metrics.cameraFrames * 1000 / elapsed).toFixed(1)),
        segmentationFps: Number((metrics.segmentationFrames * 1000 / elapsed).toFixed(1)),
        averageInferenceMs: metrics.segmentationFrames ? Number((metrics.inferenceMs / metrics.segmentationFrames).toFixed(1)) : 0,
      })
    }
    performanceMetricsRef.current = { startedAt: now, cameraFrames: 0, segmentationFrames: 0, inferenceMs: 0 }
  }

  const scheduleSegmentationFrame = (video: HTMLVideoElement, callback: () => void) => {
    const frameVideo = video as VideoFrameCallbackVideo
    if (typeof frameVideo.requestVideoFrameCallback === 'function') {
      segmentationFrameModeRef.current = 'video'
      segmentationFrameRef.current = frameVideo.requestVideoFrameCallback(() => callback())
      return
    }
    segmentationFrameModeRef.current = 'raf'
    segmentationFrameRef.current = window.requestAnimationFrame(callback)
  }

  const cancelSegmentationLoop = () => {
    const frameVideo = videoRef.current as VideoFrameCallbackVideo | null
    if (segmentationFrameRef.current !== null) {
      if (segmentationFrameModeRef.current === 'video' && typeof frameVideo?.cancelVideoFrameCallback === 'function') frameVideo.cancelVideoFrameCallback(segmentationFrameRef.current)
      else window.cancelAnimationFrame(segmentationFrameRef.current)
    }
    segmentationFrameRef.current = null
    segmentationFrameModeRef.current = null
    segmentingRef.current = false
    processingRef.current = false
    processingSessionIdRef.current = null
    lastWebcamTimeRef.current = -1
    temporalAlphaRef.current = null
    performanceMetricsRef.current = { startedAt: 0, cameraFrames: 0, segmentationFrames: 0, inferenceMs: 0 }
  }

  const backgroundImagesRef = useRef<Record<string, HTMLImageElement>>({})
  const capturedPersonCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }

  const waitForVideoReady = (video: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      resolve()
      return
    }
    let settled = false
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleReady)
      video.removeEventListener('canplay', handleReady)
      window.clearTimeout(timeout)
    }
    const handleReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        settled = true
        cleanup()
        resolve()
      }
    }
    const timeout = window.setTimeout(() => {
      if (settled) return
      cleanup()
      reject(new Error('Camera video did not receive dimensions'))
    }, 4000)
    video.addEventListener('loadedmetadata', handleReady)
    video.addEventListener('canplay', handleReady)
  })

  const attachStreamToVideo = async (video: HTMLVideoElement, stream: MediaStream, expectedSessionId = sessionIdRef.current) => {
    if (streamRef.current !== stream || !mountedRef.current || expectedSessionId !== sessionIdRef.current) return
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await waitForVideoReady(video)
    await video.play()
    if (streamRef.current !== stream || !mountedRef.current || expectedSessionId !== sessionIdRef.current) return
    setDiagnosticRevision((revision) => revision + 1)
    if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
      setCameraState('live')
      if (!isNoctra) void startSegmentationRef.current()
    }
  }

  const attachStreamRef = useRef(attachStreamToVideo)
  attachStreamRef.current = attachStreamToVideo
  const stopCameraRef = useRef(stopCamera)
  stopCameraRef.current = stopCamera
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      setCameraState('connecting')
      void attachStreamRef.current(node, streamRef.current).catch((error: unknown) => {
        stopCameraRef.current()
        setCameraState(cameraDebug ? 'error' : 'fallback')
        setCameraError(error instanceof Error ? error.message : 'Unable to attach camera stream')
      })
    }
  }, [cameraDebug])

  const startCamera = async () => {
    sessionIdRef.current += 1
    const sessionId = sessionIdRef.current
    cancelSegmentationLoop()
    stopCamera()
    setPhotoDataUrl(null)
    setCameraNotice(null)
    setCameraError(null)
    setCameraState('requesting')
    setSegmentationState('idle')
    hasCompositeFrameRef.current = false
    setHasCompositeFrame(false)
    processingRef.current = false
    lastWebcamTimeRef.current = -1
    compositeCanvasRef.current?.getContext('2d')?.clearRect(0, 0, compositeCanvasRef.current.width, compositeCanvasRef.current.height)
    const cameraFallbackTimer = window.setTimeout(() => {
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return
      setCameraState(cameraDebug ? 'error' : 'fallback')
      setCameraNotice('Cámara no disponible · Elegí una foto o usá la demo.')
    }, 6000)
    if (!navigator.mediaDevices?.getUserMedia) {
      window.clearTimeout(cameraFallbackTimer)
      setCameraState(cameraDebug ? 'error' : 'fallback')
      setCameraError('getUserMedia is not available')
      setCameraNotice(isNoctra ? 'Cámara no disponible · Elegí una foto o usá la demo.' : 'No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá nuevamente.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 24 },
        },
        audio: false,
      })
      window.clearTimeout(cameraFallbackTimer)
      trackExperienceEvent(experienceConfig.id !== 'noctra', 'camera_permission_granted', { source: 'photo_studio' })
      if (!mountedRef.current || sessionId !== sessionIdRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setPermissionState('granted')
      setCameraState('connecting')
      if (videoRef.current) await attachStreamToVideo(videoRef.current, stream, sessionId)
    } catch (error: unknown) {
      window.clearTimeout(cameraFallbackTimer)
      stopCamera()
      if (isCameraPermissionDenied(error)) trackExperienceEvent(experienceConfig.id !== 'noctra', 'camera_permission_denied', { source: 'photo_studio' })
      setPermissionState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'error')
      setCameraState(cameraDebug ? 'error' : 'fallback')
      setCameraError(error instanceof Error ? error.message : 'Unable to access camera')
      setCameraNotice(isNoctra ? 'Cámara no disponible · Elegí una foto o usá la demo.' : 'No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá nuevamente.')
    }
  }

  const drawCover = (context: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, sourceWidth: number, sourceHeight: number) => {
    const scale = Math.max(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }

  const getCoverPlacement = (sourceWidth: number, sourceHeight: number, width: number, height: number) => {
    const scale = Math.max(width / sourceWidth, height / sourceHeight)
    return {
      scale,
      offsetX: (width - sourceWidth * scale) / 2,
      offsetY: (height - sourceHeight * scale) / 2,
    }
  }

  const preloadBackgrounds = () => {
    if (!backgroundPreloadRef.current) {
      backgroundPreloadRef.current = Promise.all(Object.entries(filterBackgrounds).map(async ([filterId, source]) => {
        try {
          backgroundImagesRef.current[filterId] = await loadImageAsset(source)
        } catch { }
      })).then(() => undefined)
    }
    return backgroundPreloadRef.current
  }

  const ensureBackground = async (filterId: string) => {
    await preloadBackgrounds()
    return backgroundImagesRef.current[filterId] || backgroundImagesRef.current[segmentationBackgroundId]
  }

  const renderFilteredPhoto = async (basePhoto: string, filterId: string) => {
    const baseImage = await loadImageAsset(basePhoto)
    const canvas = document.createElement('canvas')
    canvas.width = baseImage.naturalWidth
    canvas.height = baseImage.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return basePhoto
    context.filter = filterEffects[filterId] || 'none'
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', .92)
  }

  const drawSegmentedFrame = (result: { confidenceMasks?: Array<{ width: number; height: number; getAsFloat32Array: () => Float32Array }> }, video: HTMLVideoElement) => {
    const canvas = compositeCanvasRef.current
    if (!canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return false
    const width = COMPOSITE_OUTPUT_WIDTH
    const height = COMPOSITE_OUTPUT_HEIGHT
    const mask = result.confidenceMasks?.[0]
    if (!mask) throw new Error('Image Segmenter returned no confidenceMasks[0]')
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const personCanvas = personCanvasRef.current || document.createElement('canvas')
    const alphaMaskCanvas = alphaMaskCanvasRef.current || document.createElement('canvas')
    const featherMaskCanvas = featherMaskCanvasRef.current || document.createElement('canvas')
    const lightWrapCanvas = lightWrapCanvasRef.current || document.createElement('canvas')
    personCanvasRef.current = personCanvas
    alphaMaskCanvasRef.current = alphaMaskCanvas
    featherMaskCanvasRef.current = featherMaskCanvas
    lightWrapCanvasRef.current = lightWrapCanvas
    if (personCanvas.width !== width || personCanvas.height !== height) {
      personCanvas.width = width
      personCanvas.height = height
    }
    if (alphaMaskCanvas.width !== width || alphaMaskCanvas.height !== height) {
      alphaMaskCanvas.width = width
      alphaMaskCanvas.height = height
    }
    if (featherMaskCanvas.width !== width || featherMaskCanvas.height !== height) {
      featherMaskCanvas.width = width
      featherMaskCanvas.height = height
    }
    if (lightWrapCanvas.width !== width || lightWrapCanvas.height !== height) {
      lightWrapCanvas.width = width
      lightWrapCanvas.height = height
    }
    const personContext = personCanvas.getContext('2d')
    const alphaMaskContext = alphaMaskCanvas.getContext('2d')
    const featherMaskContext = featherMaskCanvas.getContext('2d')
    const lightWrapContext = lightWrapCanvas.getContext('2d')
    const outputContext = canvas.getContext('2d')
    if (!personContext || !alphaMaskContext || !featherMaskContext || !lightWrapContext || !outputContext) throw new Error('Unable to create segmentation canvas contexts')
    const maskValues = mask.getAsFloat32Array()
    const maskCanvas = maskCanvasRef.current || document.createElement('canvas')
    maskCanvasRef.current = maskCanvas
    if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
      maskCanvas.width = mask.width
      maskCanvas.height = mask.height
    }
    const maskContext = maskCanvas.getContext('2d')
    if (!maskContext) throw new Error('Unable to create segmentation mask canvas')
    const visibleMask = maskContext.createImageData(mask.width, mask.height)
    for (let index = 0; index < maskValues.length; index += 1) {
      const value = maskValues[index] > 0.5 ? 255 : 0
      const pixel = index * 4
      visibleMask.data[pixel] = value
      visibleMask.data[pixel + 1] = value
      visibleMask.data[pixel + 2] = value
      visibleMask.data[pixel + 3] = 255
    }
    maskContext.putImageData(visibleMask, 0, 0)
    const alphaMask = alphaMaskContext.createImageData(width, height)
    const temporalAlpha = temporalAlphaRef.current && temporalAlphaRef.current.length === width * height
      ? temporalAlphaRef.current
      : new Float32Array(width * height)
    temporalAlphaRef.current = temporalAlpha
    const videoCover = getCoverPlacement(video.videoWidth, video.videoHeight, width, height)
    for (let y = 0; y < height; y += 1) {
      const sourceY = (y - videoCover.offsetY) / videoCover.scale
      const maskY = Math.min(mask.height - 1, Math.max(0, Math.floor((sourceY / video.videoHeight) * mask.height)))
      for (let x = 0; x < width; x += 1) {
        const sourceX = (x - videoCover.offsetX) / videoCover.scale
        const outputIndex = y * width + x
        const pixel = (y * width + x) * 4
        alphaMask.data[pixel] = 255
        alphaMask.data[pixel + 1] = 255
        alphaMask.data[pixel + 2] = 255
        if (sourceX < 0 || sourceX >= video.videoWidth || sourceY < 0 || sourceY >= video.videoHeight) {
          temporalAlpha[outputIndex] = 0
          alphaMask.data[pixel + 3] = 0
        } else {
          const maskX = Math.min(mask.width - 1, Math.max(0, Math.floor((sourceX / video.videoWidth) * mask.width)))
          const maskIndex = maskY * mask.width + maskX
          const currentAlpha = Math.max(0, Math.min(1, maskValues[maskIndex])) * 255
          const previousAlpha = temporalAlpha[outputIndex]
          let smoothedAlpha = currentAlpha
          if (previousAlpha > 0 && currentAlpha < 4) smoothedAlpha = previousAlpha * .12
          else if (previousAlpha > 0) {
            const delta = currentAlpha - previousAlpha
            const currentWeight = delta > 72 ? .82 : delta < -72 ? .9 : .34
            smoothedAlpha = currentAlpha * currentWeight + previousAlpha * (1 - currentWeight)
          }
          temporalAlpha[outputIndex] = smoothedAlpha
          alphaMask.data[pixel + 3] = smoothedAlpha
        }
      }
    }
    alphaMaskContext.putImageData(alphaMask, 0, 0)
    featherMaskContext.clearRect(0, 0, width, height)
    featherMaskContext.filter = `blur(${MASK_FEATHER_PX}px)`
    featherMaskContext.drawImage(alphaMaskCanvas, 0, 0, width, height)
    featherMaskContext.filter = 'none'
    personContext.clearRect(0, 0, width, height)
    drawCover(personContext, video, width, height, video.videoWidth, video.videoHeight)
    personContext.globalCompositeOperation = 'destination-in'
    personContext.drawImage(featherMaskCanvas, 0, 0, width, height)
    personContext.globalCompositeOperation = 'source-over'
    outputContext.clearRect(0, 0, width, height)
    const requestedBackgroundId = selectedOverlayRef.current
    const background = backgroundImagesRef.current[requestedBackgroundId]
      || backgroundImagesRef.current[lastValidBackgroundIdRef.current]
      || backgroundImagesRef.current[segmentationBackgroundId]
      || Object.values(backgroundImagesRef.current)[0]
    if (!background) throw new Error('Photo Studio background is not loaded')
    if (backgroundImagesRef.current[requestedBackgroundId] === background) lastValidBackgroundIdRef.current = requestedBackgroundId
    drawCover(outputContext, background, width, height, background.naturalWidth, background.naturalHeight)
    lightWrapContext.clearRect(0, 0, width, height)
    drawCover(lightWrapContext, background, width, height, background.naturalWidth, background.naturalHeight)
    lightWrapContext.globalCompositeOperation = 'destination-in'
    lightWrapContext.drawImage(featherMaskCanvas, 0, 0, width, height)
    lightWrapContext.globalCompositeOperation = 'destination-out'
    lightWrapContext.drawImage(alphaMaskCanvas, 0, 0, width, height)
    lightWrapContext.globalCompositeOperation = 'source-over'
    outputContext.globalAlpha = LIGHT_WRAP_OPACITY
    outputContext.drawImage(lightWrapCanvas, 0, 0, width, height)
    outputContext.globalAlpha = 1
    outputContext.drawImage(personCanvas, 0, 0, width, height)
    if (segDebug) {
      const debugVideoCanvas = debugVideoCanvasRef.current
      const debugMaskCanvas = debugMaskCanvasRef.current
      const debugCompositeCanvas = debugCompositeCanvasRef.current
      if (debugVideoCanvas && debugMaskCanvas && debugCompositeCanvas) {
        for (const debugCanvas of [debugVideoCanvas, debugMaskCanvas, debugCompositeCanvas]) {
          if (debugCanvas.width !== width || debugCanvas.height !== height) {
            debugCanvas.width = width
            debugCanvas.height = height
          }
        }
        debugVideoCanvas.getContext('2d')?.drawImage(video, 0, 0, width, height)
        debugMaskCanvas.getContext('2d')?.drawImage(maskCanvas, 0, 0, width, height)
        debugCompositeCanvas.getContext('2d')?.drawImage(canvas, 0, 0, width, height)
      }
    }
    return true
  }

  const startSegmentation = async () => {
    const video = videoRef.current
    if (!video || cameraDebug || segmentingRef.current) return
    const sessionId = sessionIdRef.current
    segmentingRef.current = true
    setSegmentationState('loading')
    try {
      if (!segmenterPromiseRef.current) {
        segmenterPromiseRef.current = (async () => {
          const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
          const vision = await FilesetResolver.forVisionTasks(SEGMENTATION_WASM_PATH)
          const options = {
            baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' as const },
            runningMode: 'VIDEO' as const,
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          }
          try {
            return await ImageSegmenter.createFromOptions(vision, options)
          } catch {
            return ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const } })
          }
        })()
      }
      const segmenter = await segmenterPromiseRef.current
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return
      segmenterRef.current = segmenter
      await preloadBackgrounds()
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return
      const renderFrame = () => {
        if (!mountedRef.current || sessionId !== sessionIdRef.current || !videoRef.current || !segmenterRef.current) return
        if (segmentationFrameModeRef.current !== 'video' && video.currentTime === lastWebcamTimeRef.current) {
          scheduleSegmentationFrame(video, renderFrame)
          return
        }
        lastWebcamTimeRef.current = video.currentTime
        recordPerformance()
        if (processingRef.current) return
        processingRef.current = true
        processingSessionIdRef.current = sessionId
        const inferenceStartedAt = performance.now()
        segmenterRef.current.segmentForVideo(video, inferenceStartedAt, (result) => {
          if (sessionId !== sessionIdRef.current) {
            if (processingSessionIdRef.current === sessionId) {
              processingRef.current = false
              processingSessionIdRef.current = null
            }
            return
          }
          recordPerformance(performance.now() - inferenceStartedAt)
          try {
            const didDraw = drawSegmentedFrame(result, video)
            if (didDraw && !hasCompositeFrameRef.current) {
              hasCompositeFrameRef.current = true
              setHasCompositeFrame(true)
              setSegmentationState('live')
            }
          } catch (error: unknown) {
            setSegmentationState('fallback')
            setCameraNotice('No pudimos preparar la cámara. Revisá los permisos del navegador e intentá nuevamente.')
            segmentingRef.current = false
          } finally {
            if (sessionId !== sessionIdRef.current) return
            processingRef.current = false
            processingSessionIdRef.current = null
            if (segmentingRef.current) scheduleSegmentationFrame(video, renderFrame)
          }
        })
      }
      renderFrame()
    } catch (error: unknown) {
      if (sessionId !== sessionIdRef.current) return
      setSegmentationState('fallback')
      setCameraNotice('No pudimos preparar la cámara. Revisá los permisos del navegador e intentá nuevamente.')
      segmentingRef.current = false
    }
  }
  startSegmentationRef.current = startSegmentation

  const stopSegmentation = () => {
    sessionIdRef.current += 1
    cancelSegmentationLoop()
  }

  const finishNoctraCapture = async (sourcePhoto: Blob, source: 'camera' | 'selected' | 'demo') => {
    if (captureBusyRef.current) return
    const captureId = ++captureGenerationRef.current
    const abortController = new AbortController()
    captureAbortControllerRef.current?.abort()
    captureAbortControllerRef.current = abortController
    captureBusyRef.current = true
    setIsPreparingMoment(true)
    setCameraNotice('PREPARANDO TU MOMENTO…')
    setCameraState('captured')
    stopSegmentation()
    stopCamera()
    let segmentationMask: import('./experiences/noctra/noctraSegmentation').NoctraSegmentationMask | undefined
    const isCurrentCapture = () => mountedRef.current && captureGenerationRef.current === captureId && !abortController.signal.aborted

    try {
      const [{ prepareNoctraPhoto, NOCTRA_MODEL_PATH, NOCTRA_WASM_PATH, renderNoctraPhoto }, { segmentNoctraPhoto }] = await Promise.all([
        import('./experiences/noctra/noctraPhoto'),
        import('./experiences/noctra/noctraSegmentation'),
      ])
      const preparedPhoto = await prepareNoctraPhoto(sourcePhoto)
      if (!isCurrentCapture()) return

      const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
      const shouldSegment = typeof Worker !== 'undefined'
        && typeof createImageBitmap !== 'undefined'
        && (device.deviceMemory === undefined || device.deviceMemory > 2)
        && !device.connection?.saveData
      if (shouldSegment) {
        try {
          segmentationMask = await segmentNoctraPhoto(preparedPhoto, NOCTRA_MODEL_PATH, NOCTRA_WASM_PATH, abortController.signal)
        } catch (error) {
          if (!isCurrentCapture()) return
          setCameraNotice(error instanceof DOMException && error.name === 'AbortError'
            ? 'La composición se canceló.'
            : 'Seguimos con una composición estática para cuidar el dispositivo.')
        }
      } else {
        setCameraNotice('Composición optimizada para este dispositivo.')
      }
      if (!isCurrentCapture()) return

      const { getNoctraStationVariant, NOCTRA_EDITIONS } = await import('./experiences/noctra/noctraMoments')
      const edition = NOCTRA_EDITIONS[editionId]
      const variant = getNoctraStationVariant(selectedOverlay, edition)
      const backgroundUrl = filterBackgrounds[selectedOverlay] || experienceConfig.cameraImage
      const finalPhoto = await renderNoctraPhoto({ photo: preparedPhoto, backgroundUrl, variant, editionLabel: edition.label, dateLabel: edition.dateLabel, mask: segmentationMask })
      if (!isCurrentCapture()) return
      const photoUrl = await blobToDataUrl(finalPhoto)
      if (!isCurrentCapture()) return
      setPhotoDataUrl(photoUrl)
      await onCaptured(photoUrl, selectedOverlay, finalPhoto, source)
      if (!isCurrentCapture()) return
      setCameraState('captured')
      onResult()
    } catch {
      if (!isCurrentCapture()) return
      setCameraState('fallback')
      setCameraNotice('No pudimos preparar este momento. Elegí otra foto para volver a intentarlo.')
    } finally {
      if (captureAbortControllerRef.current === abortController) captureAbortControllerRef.current = null
      if (captureGenerationRef.current === captureId) {
        captureBusyRef.current = false
        if (mountedRef.current) setIsPreparingMoment(false)
      }
    }
  }

  const capturePhoto = async () => {
    if (captureBusyRef.current) return
    const video = videoRef.current
    if (isNoctra && cameraState === 'fallback') {
      try {
        const sourcePhoto = await (await fetch(filterBackgrounds[selectedOverlay] || experienceConfig.cameraImage)).blob()
        await finishNoctraCapture(sourcePhoto, 'demo')
      } catch {
        setCameraNotice('No pudimos preparar la imagen de demostración. Elegí una foto de tu dispositivo.')
      }
      return
    }
    if (!video || cameraState !== 'live' || !video.videoWidth || !video.videoHeight) {
      setCameraNotice('Cámara todavía no lista.')
      return
    }
    const compositeCanvas = compositeCanvasRef.current
    const personCanvas = personCanvasRef.current
    const capturedPerson = hasCompositeFrameRef.current && compositeCanvas && personCanvas ? document.createElement('canvas') : null
    if (capturedPerson && personCanvas) {
      capturedPerson.width = personCanvas.width
      capturedPerson.height = personCanvas.height
      capturedPerson.getContext('2d')?.drawImage(personCanvas, 0, 0)
      capturedPersonCanvasRef.current = capturedPerson
    }
    const rawCanvas = document.createElement('canvas')
    rawCanvas.width = video.videoWidth
    rawCanvas.height = video.videoHeight
    rawCanvas.getContext('2d')?.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height)
    if (isNoctra) {
      try {
        const sourcePhoto = await canvasToBlob(rawCanvas)
        await finishNoctraCapture(sourcePhoto, 'camera')
      } catch {
        setCameraNotice('No pudimos preparar la foto. Podés elegir otra imagen del dispositivo.')
      }
      return
    }
    const basePhoto = rawCanvas.toDataURL('image/jpeg', .92)
    const photo = compositeCanvas && hasCompositeFrameRef.current ? compositeCanvas.toDataURL('image/jpeg', .92) : await renderFilteredPhoto(basePhoto, selectedOverlay)
    setPhotoDataUrl(photo)
    onCaptured(photo, selectedOverlay)
    trackExperienceEvent(experienceConfig.id !== 'noctra', 'button_clicked', { action: 'photo_captured', filterId: selectedOverlay, source: 'photo_studio' })
    stopSegmentation()
    hasCompositeFrameRef.current = false
    setHasCompositeFrame(false)
    stopCamera()
    setCameraState('captured')
    onResult()
  }

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const photo = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!photo || !isNoctra) return
    if (photo.type && !photo.type.startsWith('image/')) {
      setCameraNotice('Elegí una imagen en formato JPG, PNG o HEIC.')
      return
    }
    await finishNoctraCapture(photo, 'selected')
  }

  useEffect(() => {
    void preloadBackgrounds().catch(() => setCameraNotice('No pudimos cargar los fondos de Photo Studio.'))
  }, [selectedOverlay])

  useEffect(() => {
    mountedRef.current = true
    void startCamera()
    return () => {
      mountedRef.current = false
      captureGenerationRef.current += 1
      captureAbortControllerRef.current?.abort()
      captureBusyRef.current = false
      stopSegmentation()
      segmenterRef.current?.close()
      segmenterRef.current = null
      segmenterPromiseRef.current = null
      stopCamera()
    }
  }, [])

  const handleClose = () => {
    captureGenerationRef.current += 1
    captureAbortControllerRef.current?.abort()
    captureBusyRef.current = false
    stopSegmentation()
    stopCamera()
    onClose()
  }
  const showLiveCamera = cameraState === 'live' || cameraState === 'connecting'
  const mediaSource = photoDataUrl || (isNoctra && !showLiveCamera ? filterBackgrounds[selectedOverlay] || experienceConfig.cameraImage : experienceConfig.cameraImage)
  const visibleNotice = cameraNotice || notice
  const isEventFilter = selectedOverlay === eventStation.id
  const isSecretFilter = selectedOverlay === secretStation.id
  const studioFormat = isNoctra ? (content.tabs.find((item) => item.toLowerCase() === tab.toLowerCase())?.toLowerCase() ?? 'story') : undefined
  const studioFormatLabel = studioFormat === 'foto' ? 'FOTO · 4:5' : studioFormat === 'post' ? 'POST · 1:1' : 'STORY · 9:16'
  const mediaFilter = filterMediaEffects[selectedOverlay] || filterEffects[selectedOverlay] || 'none'
  const compositeFilter = filterCompositeEffects[selectedOverlay] || 'none'
  const selectFilter = (filterId: string) => {
    if (cameraState === 'captured' || photoDataUrl || captureBusyRef.current) return
    onSelect(filterId)
  }

  const videoElement = <video ref={setVideoRef} className="studio-camera" style={{ filter: mediaFilter }} autoPlay muted playsInline aria-label="Vista de cámara" />
  const debugStream = streamRef.current
  const debugTrack = debugStream?.getVideoTracks()[0]
  const debugVideo = videoRef.current
  const diagnostics = <pre className="camera-debug-diagnostics">permission: {permissionState}{'\n'}stream.active: {String(debugStream?.active ?? false)}{'\n'}track.readyState: {debugTrack?.readyState ?? 'none'}{'\n'}track.label: {debugTrack?.label || 'none'}{'\n'}video.readyState: {debugVideo?.readyState ?? 0}{'\n'}video.paused: {String(debugVideo?.paused ?? true)}{'\n'}video.videoWidth: {debugVideo?.videoWidth ?? 0}{'\n'}video.videoHeight: {debugVideo?.videoHeight ?? 0}{'\n'}state: {cameraState}{cameraError ? `\nerror: ${cameraError}` : ''}</pre>
  if (cameraDebug) return <section className="phone-screen studio-screen camera-debug-screen"><header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button><span>Camera debug</span><span>{cameraState}</span></header><div className="camera-debug-media">{videoElement}</div>{diagnostics}</section>
  const optionsMarkup = <div className="studio-options">
    {options.map((item) => {
      const locked = (item.id === eventStation.id && !isStationFound(item.id)) || isFrameLocked(item.id)
      return <button className={`${selectedOverlay === item.id ? 'active ' : ''}${locked ? 'locked-option' : ''}`} key={item.id} data-noctra-filter-id={isNoctra ? item.id : undefined} onClick={() => locked ? onLocked() : selectFilter(item.id)} aria-disabled={locked} disabled={isNoctra && isPreparingMoment}><img src={item.image} alt={item.name} /><small>{item.name}</small></button>
    })}
  </div>
  const pickerAction = <button onClick={() => isNoctra ? photoInputRef.current?.click() : startCamera()} aria-label={isNoctra ? 'Elegir foto de tu dispositivo' : content.controls.repeatPhoto} disabled={isNoctra && isPreparingMoment}><ImageIcon size={22} /><small>{isNoctra ? 'Elegir' : content.controls.photo}</small></button>
  const captureAction = <button className="shutter" onClick={capturePhoto} aria-label={isNoctra && cameraState === 'fallback' ? 'Usar imagen de demostración' : content.controls.takePhoto} disabled={isNoctra && isPreparingMoment} />
  const shareAction = <button disabled={!photoDataUrl || isPreparingMoment} onClick={() => photoDataUrl && onResult()} aria-label={content.controls.publish}><MoreHorizontal size={18} /><small>{content.controls.publish}</small></button>
  const tabsMarkup = isNoctra
    ? <div className="studio-tabs" role="group" aria-label="Formato de vista previa">{content.tabs.map((item) => {
      const format = item.toLowerCase()
      const dimensions = format === 'foto' ? '4:5' : format === 'post' ? '1:1' : '9:16'
      const label = item.charAt(0).toUpperCase() + item.slice(1)
      return <button type="button" className={studioFormat === format ? 'active' : ''} aria-pressed={studioFormat === format} aria-label={`${label}, formato ${dimensions}`} onClick={() => onTab(item)} key={item}>{label}</button>
    })}</div>
    : <div className="studio-tabs">{content.tabs.map((item) => <button className={tab === item ? 'active' : ''} onClick={() => onTab(item)} key={item}>{item}</button>)}</div>
  return <section className={`phone-screen studio-screen ${hasCompositeFrame ? 'segmentation-live' : ''}${isNoctra ? ' noctra-studio' : ''}`} data-output-format={studioFormat} aria-busy={isPreparingMoment}>
    <div className="studio-media" data-frame={isNoctra ? selectedOverlay : undefined} data-format={studioFormat}>
      {showLiveCamera ? videoElement : <img className="studio-fallback-image" style={{ filter: mediaFilter }} src={mediaSource} alt="" />}
      <canvas ref={compositeCanvasRef} className="studio-composite-canvas" style={{ filter: compositeFilter }} aria-label="Vista compuesta de cámara" />
      {isNoctra && <>
        <Suspense fallback={null}><NoctraExperienceUI mode="photo-effects" stationId={selectedOverlay} editionId={editionId} /></Suspense>
        {!isEventFilter && !isSecretFilter && <div className="studio-copy"><h2>{content.title}</h2><p>{content.subtitle}</p></div>}
        {!isEventFilter && !isSecretFilter && <div key={selectedOverlay} className="studio-overlay" style={{ color: filterOverlayColors[selectedOverlay] }}><ContentLines lines={content.overlayLines} /></div>}
        {selectedOverlay === 'nova-drop' && <span className="noctra-nova-frame-label">NOVA DROP · NIGHT 03</span>}
        <span className="studio-format-stamp" aria-live="polite"><small>VISTA</small><strong>{studioFormatLabel}</strong></span>
      </>}
    </div>
    <div className="photo-shade medium" />
    <header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button>{isNoctra && <span className="studio-edition-label">NOCTRA · {experienceConfig.eventDate}</span>}<Sparkles size={18} /></header>
    {!isNoctra && !isEventFilter && !isSecretFilter && <div className="studio-copy"><h2>{content.title}</h2><p>{content.subtitle}</p></div>}
    {!isNoctra && !isEventFilter && !isSecretFilter && <div key={selectedOverlay} className="studio-overlay" style={{ color: filterOverlayColors[selectedOverlay] }}><ContentLines lines={content.overlayLines} /></div>}
    {isNoctra && <input ref={photoInputRef} className="noctra-photo-input" type="file" accept="image/*" onChange={handlePhotoSelection} aria-label="Elegir una foto de tu dispositivo" disabled={isPreparingMoment} />}
    {isNoctra ? <div className="studio-panel">
      {visibleNotice && <p className="studio-feedback" role="status">{visibleNotice}</p>}
      {optionsMarkup}
      {captureAction}
      {tabsMarkup}
      <div className="studio-actions">{pickerAction}{shareAction}</div>
    </div> : <>
      {visibleNotice && <p className="studio-feedback" role="status">{visibleNotice}</p>}
      {optionsMarkup}
      <div className="studio-controls">{pickerAction}{captureAction}{shareAction}</div>
      {tabsMarkup}
    </>}
    {segDebug && <div className="seg-debug-panel"><figure><canvas ref={debugVideoCanvasRef} /><figcaption>VIDEO ORIGINAL</figcaption></figure><figure><canvas ref={debugMaskCanvasRef} /><figcaption>PERSON CUTOUT</figcaption></figure><figure><canvas ref={debugCompositeCanvasRef} /><figcaption>COMPOSITE FINAL</figcaption></figure></div>}
  </section>
}

function ShareResult({ photoSrc, filterId, isNoctra, onClose, onEdit }: { photoSrc: string; filterId: string; isNoctra: boolean; onClose: () => void; onEdit: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const sharing = experienceConfig.content.sharing
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const filename = `${sharing.filenamePrefix}-${filterId}.jpg`
  const isEventFilter = filterId === eventStation.id
  const resultName = filterId === experienceRuntime.photoStudio.defaultFilterId ? experienceConfig.name : experienceRuntime.stationById[filterId]?.name || experienceConfig.name
  useEffect(() => {
    trackExperienceEvent(!isNoctra, 'experience_finished', { filterId, source: 'photo_studio' })
  }, [filterId])
  const downloadPhoto = async () => {
    const blob = await (await fetch(photoSrc)).blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const sharePhoto = async (source: string) => {
    trackExperienceEvent(!isNoctra, 'button_clicked', { action: 'photo_shared', filterId, source })
    try {
      const blob = await (await fetch(photoSrc)).blob()
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: sharing.navigatorTitle })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: sharing.navigatorTitle, text: sharing.fallbackText })
        return
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
    await downloadPhoto()
  }
  return <section className="phone-screen share-screen" style={isNoctra ? undefined : { backgroundImage: `url(${photoSrc})` }}>
    <div className="photo-shade medium" />
    <header className="floating-header"><button className="icon-button" onClick={onClose}><X size={21} /></button><Sparkles size={18} /></header>
    <div className="share-card">
      <div className={`share-art${isNoctra ? ' noctra-photo-preview' : ''}`} data-frame={isNoctra ? filterId : undefined}>
        <img src={photoSrc} alt={sharing.imageAlt} />
        {isNoctra && filterId === 'nova-drop' && <span className="noctra-nova-frame-label">NOVA DROP · NIGHT 03</span>}
        {!isNoctra && !isEventFilter && <span><ContentLines lines={experienceConfig.content.photoStudio.overlayLines} /></span>}
        {!isNoctra && <><strong>{resultName}</strong><small>{experienceConfig.eventDate} · {experienceConfig.location}</small></>}
      </div>
      <div className="share-actions">
        <button onClick={() => { void sharePhoto('instagram') }}><Share2 size={18} /><ContentLines lines={sharing.instagramLines} /></button>
        <button onClick={downloadPhoto}><ArrowRight size={18} /><ContentLines lines={sharing.downloadLines} /></button>
        <button onClick={() => { void sharePhoto('other_networks') }}><MoreHorizontal size={18} /><ContentLines lines={sharing.otherNetworksLines} /></button>
      </div>
    </div>
    <a className="corsteno-credit" href="https://corsteno.com" target="_blank" rel="noreferrer">{sharing.creditLabel}</a>
    <button className="back-edit" onClick={onEdit}><ArrowLeft size={16} /> {sharing.editLabel}</button>
  </section>
}

function StationDetail({ station, onBack, onPhoto }: { station: Station; onBack: () => void; onPhoto: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.detail
  const permanentStations = experienceRuntime.permanentStations
  return <section className="phone-screen detail-screen" data-station-id={station.id}><Header page={content.page} onBack={onBack} /><div className="detail-hero" style={{ backgroundImage: `url(${station.image})` }}><div className="detail-hero-image" style={{ backgroundImage: `url(${station.image})` }} /><span>{content.brandLabel}</span><strong>{station.name}</strong><small>{content.subtitle}</small></div><div className="detail-text"><p>{station.description} {content.descriptionSuffix}</p><div className="detail-thumbs">{permanentStations.slice(0, 3).map((item) => <img key={item.id} src={item.image} alt={item.name} />)}</div><button className="cream-button" onClick={onPhoto}>{content.usePhotoLabel} <ArrowRight size={18} /></button></div></section>
}

function Passport({ stationTotal, explorationFoundCount, isStationFound, isNoctra, onOpenNight, onExplore, onCamera, onMenu }: { stationTotal: number; explorationFoundCount: number; isStationFound: (stationId: string) => boolean; isNoctra: boolean; onOpenNight: () => void; onExplore: () => void; onCamera: () => void; onMenu: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.passport
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const engagement = useEngagementView()
  const secretHints = experienceConfig.engagement?.secretHints
  const secretProgress = engagement?.progressCount ?? explorationFoundCount
  const secretNear = Boolean(secretHints?.showNearAfter && !isStationFound(secretStation.id) && secretProgress >= secretHints.showNearAfter)
  const secretDetected = Boolean(secretHints && !isStationFound(secretStation.id) && !secretNear && secretProgress >= secretHints.showDetectedAfter)
  const secretTitle = isStationFound(secretStation.id)
    ? secretHints?.foundTitle || secretStation.name
    : secretNear
      ? secretHints?.nearTitle || secretStation.name
    : secretDetected
      ? secretHints?.detectedTitle || secretStation.name
      : secretHints?.lockedTitle || '???'
  const secretMessage = isStationFound(secretStation.id)
    ? secretHints?.foundMessage || content.secretFoundStatus
    : secretNear
      ? secretHints?.nearMessage || secretHints?.detectedMessage || content.secretLockedStatus
    : secretDetected
      ? secretHints?.detectedMessage || content.secretLockedStatus
      : secretHints?.lockedMessage || content.secretLockedStatus
  const reward = experienceConfig.engagement?.finalReward

  return <section className="phone-screen passport-screen">
    <Header />
    <button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button>
    <div className="passport-heading"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><div className="passport-stats"><span><b>{experienceConfig.passportTotals.nights}</b> {content.statLabels.nights}</span><span><b>{stationTotal}</b> {content.statLabels.stations}</span><span><b>{experienceConfig.passportTotals.specials}</b> {content.statLabels.specials}</span></div></div>
    <ExplorationProgress foundCount={explorationFoundCount} />
    <EngagementCard variant="passport" />
    <div className="ticket"><p><ContentLines lines={content.ticketLines} /></p><div className="ticket-numbers"><b>{experienceConfig.passportTotals.nights}<small>{content.statLabels.nights}</small></b><b>{stationTotal}<small>{content.statLabels.stations}</small></b><b>{experienceConfig.passportTotals.specials}<small>{content.statLabels.specials}</small></b></div><Ticket size={35} /></div>
    <div className="history-list">{experienceConfig.passportHistory.map((item) => {
      const isSecretItem = item.stationId === secretStation.id
      const isFinalReward = item.stationId === reward?.passportStationId
      const rewardReady = Boolean(isFinalReward && engagement && engagement.rewardState !== 'locked')
      const itemFound = isStationFound(item.stationId)
        || (item.requiredExplorationCount !== undefined && explorationFoundCount >= item.requiredExplorationCount)
        || rewardReady
      const locked = (item.stationId === eventStation.id || isSecretItem || item.requiresUnlock === true) && !itemFound
      const label = isFinalReward && reward ? reward.title : isSecretItem && locked ? secretTitle : isSecretItem ? secretTitle : item.name
      const status = isFinalReward && reward && engagement
        ? engagement.rewardState === 'unlocked' ? reward.unlockedLabel : engagement.rewardState === 'ready' ? reward.readyLabel : content.notFoundStatus
        : isSecretItem ? secretMessage
          : locked ? content.notFoundStatus : item.date
      return <div className={`history-row ${locked ? 'locked-history-row' : ''}`} data-station-id={item.stationId} key={item.stationId}><img src={item.image} alt="" /><span>{label}</span><small>{status}</small></div>
    })}</div>
    {isNoctra && <Suspense fallback={<div className="noctra-moments-section" aria-label="Cargando tus momentos" />}><NoctraExperienceUI mode="passport-moments" stationImages={Object.fromEntries(experienceRuntime.stations.map((station) => [station.id, station.image]))} onOpenNight={onOpenNight} onDiscover={onCamera} /></Suspense>}
    <p className="passport-copy"><ContentLines lines={content.closingLines} /></p>
    <BottomNav active="passport" onExplore={onExplore} onCamera={onCamera} onPassport={() => undefined} />
  </section>
}

function Upcoming({ onExplore, onCamera, onPassport, onMenu }: { onExplore: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const content = experienceConfig.content.upcoming
  return <section className="phone-screen upcoming-screen"><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="upcoming-heading"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1></div><div className="upcoming-list">{experienceConfig.upcomingEvents.map((item) => <div className="upcoming-row" key={item.name}><img src={item.image} alt="" /><div><b>{item.name}</b><small>{item.date}</small></div></div>)}</div><p className="upcoming-copy"><ContentLines lines={content.closingLines} /></p><BottomNav active="explore" onExplore={onExplore} onCamera={onCamera} onPassport={onPassport} /></section>
}

function Menu({ onClose, onNavigate, onReset }: { onClose: () => void; onNavigate: (view: View) => void; onReset: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const isNoctra = experienceConfig.id === 'noctra'
  const navigation = experienceConfig.content.navigation
  const closingLines = experienceConfig.content.passport.closingLines
  if (isNoctra) return <section className="phone-screen menu-screen noctra-menu">
    <header className="floating-header noctra-menu__header"><div><img src={experienceConfig.logo} alt="NOCTRA" /><span>MENÚ DE LA NOCHE</span></div><button className="icon-button" onClick={onClose} aria-label="Cerrar menú"><X size={21} /></button></header>
    <main className="noctra-menu__main">
      <div className="noctra-menu__intro"><span>NIGHT 03 · MENDOZA</span><h1>Elegí por dónde<br />entrar.</h1></div>
      <nav className="menu-links noctra-menu__links" aria-label="Navegación NOCTRA">
        <section className="noctra-menu__group"><h2>PRINCIPAL</h2><div className="noctra-menu__group-links noctra-menu__group-links--principal">
          <button type="button" className="menu-primary" onClick={() => onNavigate('stations')}><Sparkles size={18} /><span>EXPLORAR</span><ArrowRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('discover')}><Camera size={18} /><span>DESCUBRIR</span><ArrowRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('passport')}><Grid2X2 size={18} /><span>PASSPORT</span><ArrowRight size={14} /></button>
        </div></section>
        <section className="noctra-menu__group"><h2>LA NOCHE</h2><div className="noctra-menu__group-links noctra-menu__group-links--night">
          <button type="button" onClick={() => onNavigate('upcoming')}><CalendarDays size={17} /><span>PRÓXIMAS FECHAS</span><ArrowRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('lineup')}><Music2 size={17} /><span>LINE UP</span><ArrowRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('moments')}><Ticket size={17} /><span>MOMENTOS</span><ArrowRight size={14} /></button>
          <button type="button" onClick={() => onNavigate('edition')}><MoreHorizontal size={17} /><span>EDICIÓN</span><ArrowRight size={14} /></button>
        </div></section>
        <section className="noctra-menu__group"><h2>INFO</h2><div className="noctra-menu__group-links noctra-menu__group-links--info">
          <button type="button" onClick={() => onNavigate('experience-info')}><Info size={17} /><span>LA EXPERIENCIA</span><ArrowRight size={14} /></button>
          <button type="button" className="menu-nova" onClick={() => onNavigate('sponsor')}><Sparkles size={17} /><span>NOVA DROP</span><ArrowRight size={14} /></button>
        </div></section>
      </nav>
      <figure className="menu-photo noctra-menu__photo"><img src={experienceConfig.heroImage} alt="Una imagen de la noche NOCTRA" /><figcaption><span>RECUERDO DE ESTA NOCHE</span><strong>NOCTRA · 03</strong></figcaption></figure>
      <button type="button" className="menu-reset noctra-menu__reset" onClick={onReset}>{navigation.reset}</button>
    </main>
    <footer className="menu-footer noctra-menu__footer"><p><ContentLines lines={closingLines} /></p><span><Sparkles size={17} /> NOCTRA · NIGHT 03</span></footer>
  </section>
  return <section className="phone-screen menu-screen"><div className="menu-photo" style={{ backgroundImage: `url(${experienceConfig.heroImage})` }} /><div className="photo-shade strong" /><header className="floating-header"><span>{experienceConfig.name}</span><button className="icon-button" onClick={onClose}><X size={21} /></button></header><nav className="menu-links"><button onClick={onClose}><Sparkles size={18} /> {navigation.explore}</button><button onClick={() => onNavigate('discover')}><Camera size={18} /> {navigation.camera}</button><button onClick={() => onNavigate('passport')}><Grid2X2 size={18} /> {navigation.passport}</button><button onClick={() => onNavigate('upcoming')}><CalendarDays size={18} /> {navigation.upcoming}</button><span className="menu-static"><Info size={18} /> {navigation.info}</span><span className="menu-static"><ImageIcon size={18} /> {navigation.sponsors}</span><button className="menu-reset" onClick={onReset}>{navigation.reset}</button></nav><div className="menu-footer"><p><ContentLines lines={closingLines} /></p><span><Sparkles size={18} /> {experienceConfig.name}</span></div></section>
}

export default App
