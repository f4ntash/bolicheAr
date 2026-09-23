import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Camera, CalendarDays, Grid2X2, Image as ImageIcon, Info, Menu as MenuIcon, MoreHorizontal, ScanLine, Share2, Sparkles, Ticket, X } from 'lucide-react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { ExperienceRuntime, Station } from './types'
import VirtualBackgroundTest from './VirtualBackgroundTest'
import { parseStationQr } from './utils/stationQr'
import { assetUrl } from './utils/assets'
import { analytics } from './utils/analytics'
import { loadExperienceProgress, resetExperienceProgress, saveExperienceProgress, type ExperienceProgress } from './utils/experienceStorage'

type View = 'home' | 'discover' | 'unlocked' | 'secret-reveal' | 'stations' | 'studio' | 'share' | 'detail' | 'passport' | 'upcoming' | 'menu'

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

function isCameraPermissionDenied(error: unknown) {
  return error instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)
}

function App({ experience }: { experience: ExperienceRuntime }) {
  const experienceRuntime = experience
  const experienceConfig = experience.config
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
  const [selectedOverlay, setSelectedOverlay] = useState(experienceRuntime.photoStudio.defaultFilterId)
  const [studioTab, setStudioTab] = useState('story')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [capturedFilter, setCapturedFilter] = useState(experienceRuntime.photoStudio.defaultFilterId)
  const [studioNotice, setStudioNotice] = useState<string | null>(null)
  const [newUnlockNoticePending, setNewUnlockNoticePending] = useState(false)
  const transitionTimer = useRef<number | undefined>(undefined)
  const noticeTimer = useRef<number | undefined>(undefined)
  const analyticsInitializedRef = useRef(false)
  const isStationFound = (stationId: string) => foundStations[stationId] === true
  const eventStationFound = isStationFound(eventStation.id)
  const secretStationFound = isStationFound(secretStation.id)
  const eventStations = experienceRuntime.eventStations
  const eventFoundCount = eventStations.filter((station) => isStationFound(station.id)).length
  const explorationFoundCount = explorationStationIds.filter((stationId) => isStationFound(stationId)).length
  const stationTotal = experienceConfig.passportTotals.stations + (eventStationFound ? 1 : 0) + (secretStationFound ? 1 : 0)

  useEffect(() => {
    if (analyticsInitializedRef.current) return
    analyticsInitializedRef.current = true
    analytics.track('app_opened', { surface: 'web', experience: experienceConfig.id, language: 'es' })
    if (analytics.isNewSession) analytics.track('session_started', { surface: 'web', experience: experienceConfig.id })
  }, [])

  useEffect(() => {
    document.title = `${experienceConfig.experienceName} — Demo`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', experienceConfig.theme.background)
  }, [experienceConfig])

  if (vbTest) return <VirtualBackgroundTest experience={experience} />

  const showStudioNotice = (notice: string) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    setStudioNotice(notice)
    noticeTimer.current = window.setTimeout(() => setStudioNotice(null), 2000)
  }

  const openStudio = (source: string) => {
    analytics.track('button_clicked', { action: 'photo_studio_opened', source })
    if (newUnlockNoticePending) {
      setNewUnlockNoticePending(false)
      showStudioNotice(experienceConfig.content.photoStudio.newUnlockNotice)
    }
    go('studio')
  }

  const completeStationDiscovery = (stationId: string) => {
    const station = experienceRuntime.stationById[stationId]
    if (!station || station.type === 'secret') return

    analytics.track('image_target_detected', { stationId: station.id, stationName: station.name, source: 'camera' })

    const wasFound = isStationFound(station.id)
    const nextFoundStations = wasFound ? foundStations : { ...foundStations, [station.id]: true }
    if (!wasFound) {
      setFoundStations(nextFoundStations)
      saveExperienceProgress(experienceRuntime, { foundStations: nextFoundStations, secretRevealSeen })
    }

    setSelectedStation(station)
    setSelectedStationId(station.id)
    if (station.id === eventStation.id && !wasFound) setNewUnlockNoticePending(true)

    const missionComplete = explorationStationIds.every((missionStationId) => nextFoundStations[missionStationId] === true)
    if (missionComplete && !secretRevealSeen && !secretStationFound) {
      setSecretRevealSeen(true)
      saveExperienceProgress(experienceRuntime, { foundStations: nextFoundStations, secretRevealSeen: true })
      go('secret-reveal')
      return
    }

    if (station.id === eventStation.id && !wasFound) {
      go('unlocked')
      return
    }
    go('detail')
  }

  const unlockSecretStation = () => {
    const nextFoundStations = { ...foundStations, [secretStation.id]: true }
    setFoundStations(nextFoundStations)
    setSecretRevealSeen(true)
    saveExperienceProgress(experienceRuntime, { foundStations: nextFoundStations, secretRevealSeen: true })
    setSelectedStation(secretStation)
    setSelectedStationId(secretStation.id)
    analytics.track('button_clicked', { action: 'station_opened', stationId: secretStation.id, stationName: secretStation.name, source: 'secret_unlock' })
    go('detail')
  }
  const resetDemo = () => {
    if (!window.confirm('¿Querés reiniciar la demo y borrar el progreso?')) return
    const initialProgress = resetExperienceProgress(experienceRuntime)
    setFoundStations(initialProgress.foundStations)
    setSecretRevealSeen(initialProgress.secretRevealSeen)
    setSelectedStation(eventStation)
    setSelectedStationId(null)
    setCapturedPhoto(null)
    setCapturedFilter(experienceRuntime.photoStudio.defaultFilterId)
    setSelectedOverlay(experienceRuntime.photoStudio.defaultFilterId)
    setStudioTab('story')
    setStudioNotice(null)
    setNewUnlockNoticePending(false)
    go('home')
  }
  const openStation = (station: Station) => {
    analytics.track('button_clicked', { action: 'station_opened', stationId: station.id, stationName: station.name, source: 'stations' })
    setSelectedStation(station)
    setSelectedStationId(station.id)
    go('detail')
  }
  const startExperience = () => {
    analytics.track('experience_started', { source: 'home' })
    go('stations')
  }
  const openPassport = (source: string) => {
    analytics.track('button_clicked', { action: 'passport_opened', source })
    go('passport')
  }
  const getDemoDiscoveryStationId = () => {
    const configuredStationIds = experienceConfig.discovery?.demoTapStationIds ?? []
    return configuredStationIds.find((stationId) => experienceRuntime.stationById[stationId] && !isStationFound(stationId))
      || configuredStationIds.find((stationId) => experienceRuntime.stationById[stationId])
  }
  const navigateFromMenu = (next: View) => {
    if (next === 'passport') {
      openPassport('menu')
      return
    }
    go(next)
  }
  const go = (next: View) => {
    if (next === view) return
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    setOutgoingView(view)
    setView(next)
    transitionTimer.current = window.setTimeout(() => setOutgoingView(null), 420)
  }

  const renderView = (screen: View) => {
    if (screen === 'home') return <Home onStart={startExperience} onCamera={() => go('discover')} onPassport={() => openPassport('home')} onMenu={() => go('menu')} />
    if (screen === 'discover') return <Discover allowDemoTapUnlock={experienceConfig.discovery?.allowDemoTapUnlock === true} demoStationId={getDemoDiscoveryStationId()} onClose={() => go('home')} onDetected={completeStationDiscovery} />
    if (screen === 'unlocked') return <Unlocked onBack={() => go('discover')} onDetails={() => openStation(eventStation)} onPhoto={() => openStudio('unlocked')} />
    if (screen === 'secret-reveal') return <SecretReveal onBack={() => go('stations')} onUnlock={unlockSecretStation} />
    if (screen === 'stations') return <Stations selectedStationId={selectedStationId} isStationFound={isStationFound} explorationFoundCount={explorationFoundCount} eventFoundCount={eventFoundCount} eventEditionTotal={eventStations.length} onCamera={() => go('discover')} onPassport={() => openPassport('stations')} onMenu={() => go('menu')} onOpen={openStation} />
    if (screen === 'studio') return <PhotoStudio selectedOverlay={selectedOverlay} isStationFound={isStationFound} notice={studioNotice} tab={studioTab} onSelect={setSelectedOverlay} onCaptured={(photo, filter) => { setCapturedPhoto(photo); setCapturedFilter(filter) }} onLocked={() => showStudioNotice(experienceConfig.content.photoStudio.lockedNotice)} onTab={setStudioTab} onClose={() => go('stations')} onResult={() => go('share')} />
    if (screen === 'share') return <ShareResult photoSrc={capturedPhoto || experienceConfig.cameraImage} filterId={capturedFilter} onClose={() => go('studio')} onEdit={() => go('studio')} />
    if (screen === 'detail') return <StationDetail station={selectedStation} onBack={() => go('stations')} onPhoto={() => openStudio('station_detail')} />
    if (screen === 'passport') return <Passport stationTotal={stationTotal} explorationFoundCount={explorationFoundCount} isStationFound={isStationFound} onExplore={() => go('stations')} onCamera={() => go('discover')} onMenu={() => go('menu')} />
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

  return <ExperienceContext.Provider value={experience}><main className="app-shell" style={themeStyle}><div className="motion-stage">
    {outgoingView && <div className="motion-layer outgoing" aria-hidden="true">{renderView(outgoingView)}</div>}
    <div className="motion-layer incoming">{renderView(view)}</div>
  </div></main></ExperienceContext.Provider>
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

function Home({ onStart, onCamera, onPassport, onMenu }: { onStart: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const content = experienceConfig.content.home
  return <section className="phone-screen home-screen"><div className="photo-bg" style={{ backgroundImage: `url(${experienceConfig.heroImage})` }} /><div className="photo-shade" /><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="home-tag"><ContentLines lines={content.tagLines} /></div><div className="home-copy"><span className="home-demo-mark">{content.demoLabel}</span><h1><ContentLines lines={content.titleLines} /></h1><p>{experienceConfig.tagline}</p><button className="cream-button" onClick={onStart}>{content.startLabel} <ArrowRight size={18} /></button><p className="home-demo-note"><strong>{content.demoNoteTitle}</strong> {content.demoNote}</p></div><BottomNav active="explore" onExplore={onStart} onCamera={onCamera} onPassport={onPassport} /></section>
}

function Discover({ onClose, onDetected, allowDemoTapUnlock, demoStationId }: { onClose: () => void; onDetected: (stationId: string) => void; allowDemoTapUnlock: boolean; demoStationId?: string }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
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
        if (isCameraPermissionDenied(error)) analytics.track('camera_permission_denied', { source: 'discover' })
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
        analytics.track('camera_permission_granted', { source: 'discover' })

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
          if (isCameraPermissionDenied(error)) analytics.track('camera_permission_denied', { source: 'discover' })
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
  return <section className="phone-screen full-photo-screen secret-reveal-screen" style={{ backgroundImage: `url(${secretBackground})` }}><div className="photo-shade strong" /><header className="floating-header"><button className="icon-button secret-reveal-back-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button><span>{content.brandLabel}</span><span>{content.page}</span></header><div className="unlocked-copy secret-reveal-copy"><p className="eyebrow">{content.revealedLabel}</p><p className="eyebrow">{content.subtitle}</p><h1>{content.title}</h1><p><ContentLines lines={content.descriptionLines} /></p></div><div className="stacked-actions"><button className="cream-button" onClick={onUnlock}>{content.unlockLabel} <ArrowRight size={18} /></button></div></section>
}

function ExplorationProgress({ foundCount }: { foundCount: number }) {
  const experienceRuntime = useExperienceRuntime()
  const content = experienceRuntime.config.content.stations
  const explorationStationIds = experienceRuntime.explorationStationIds
  const copy = foundCount === explorationStationIds.length - 1 ? content.explorationRemaining : content.explorationComplete
  return <div className="exploration-progress"><div className="exploration-progress-heading"><span>{content.explorationTitle}</span><span>{foundCount} / {explorationStationIds.length}</span></div><div className="exploration-progress-dots" aria-label={`${foundCount} de ${explorationStationIds.length} estaciones encontradas`}>{explorationStationIds.map((stationId) => <span className={foundCount > explorationStationIds.indexOf(stationId) ? 'found' : ''} key={stationId} />)}</div><p>{copy}</p></div>
}

function Stations({ selectedStationId, isStationFound, explorationFoundCount, eventFoundCount, eventEditionTotal, onCamera, onPassport, onMenu, onOpen }: { selectedStationId: string | null; isStationFound: (stationId: string) => boolean; explorationFoundCount: number; eventFoundCount: number; eventEditionTotal: number; onCamera: () => void; onPassport: () => void; onMenu: () => void; onOpen: (station: Station) => void }) {
  const experienceRuntime = useExperienceRuntime()
  const content = experienceRuntime.config.content.stations
  const permanentStations = experienceRuntime.permanentStations
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const [activeTab, setActiveTab] = useState('all')
  const eventStationFound = isStationFound(eventStation.id)
  const secretStationFound = isStationFound(secretStation.id)
  return <section className="phone-screen stations-screen"><Header page={content.headerSuffix} /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="stations-tabs">{[['all', content.tabs.all], ['permanent', content.tabs.permanent], ['special', content.tabs.special]].map(([id, label]) => <button key={id} className={activeTab === id ? 'selected' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div><div className="stations-content"><ExplorationProgress foundCount={explorationFoundCount} /><div className="section-label"><span>{content.permanentLabel}</span><span>{permanentStations.length.toString().padStart(2, '0')} / {permanentStations.length.toString().padStart(2, '0')}</span></div><div className="station-grid-ref">{permanentStations.map((station) => <StationTile key={station.id} station={station} selected={selectedStationId === station.id} onOpen={onOpen} />)}</div><div className="section-label event-label"><span>{content.eventLabel}</span><span><span key={eventFoundCount} className="event-progress-count">{eventFoundCount.toString().padStart(2, '0')}</span> / {eventEditionTotal.toString().padStart(2, '0')}</span></div><button className={`event-strip ${eventStationFound ? '' : 'locked-event-strip'}`} disabled={!eventStationFound} aria-disabled={!eventStationFound} onClick={() => { if (isStationFound(eventStation.id)) onOpen(eventStation) }}><img className={eventStationFound ? undefined : 'locked-event-image'} src={eventStation.image} alt={eventStation.name} /><div><h3>{eventStation.name}</h3><p>{eventStationFound ? content.foundLabel : <><>{content.notFoundLabel}</><br />{content.eventAvailability}</>}</p></div>{eventStationFound && <ArrowRight size={20} />}</button><button className={`secret-strip ${secretStationFound ? 'secret-unlocked' : 'secret-locked'}`} disabled={!secretStationFound} aria-disabled={!secretStationFound} onClick={() => { if (secretStationFound) onOpen(secretStation) }}><div className="secret-blur" style={{ backgroundImage: `url(${secretStation.image})` }} /><strong>{secretStationFound ? secretStation.name : '???'}</strong><span>{secretStationFound ? content.secretFoundLabel : content.secretLockedLabel}</span>{secretStationFound && <ArrowRight size={18} />}</button></div><BottomNav active="explore" onExplore={() => undefined} onCamera={onCamera} onPassport={onPassport} /></section>
}

function StationTile({ station, selected, onOpen }: { station: Station; selected: boolean; onOpen: (station: Station) => void }) {
  const content = useExperienceRuntime().config.content.stations
  const numeral = ['I', 'II', 'III', 'IV'][station.count - 1]
  return <button className={`station-tile ${selected ? 'selected-station' : ''}`} onClick={() => onOpen(station)}><img src={station.image} alt={station.name} /><div className="tile-shade" /><div className="tile-copy"><strong>{station.name}</strong><b>{numeral}</b><small>{content.foundLabel}<br />{station.count} {station.count === 1 ? content.tileTimesSingular : content.tileTimesPlural}</small></div></button>
}

function PhotoStudio({ selectedOverlay, isStationFound, notice, tab, onSelect, onCaptured, onLocked, onTab, onClose, onResult }: { selectedOverlay: string; isStationFound: (stationId: string) => boolean; notice: string | null; tab: string; onSelect: (id: string) => void; onCaptured: (photo: string, filter: string) => void; onLocked: () => void; onTab: (tab: string) => void; onClose: () => void; onResult: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  const filterEffects = experienceRuntime.photoStudio.filterEffects
  const filterBackgrounds = experienceRuntime.photoStudio.filterBackgrounds
  const filterCompositeEffects = experienceRuntime.photoStudio.filterCompositeEffects
  const filterMediaEffects = experienceRuntime.photoStudio.filterMediaEffects
  const filterOverlayColors = experienceRuntime.photoStudio.filterOverlayColors
  const segmentationBackgroundId = experienceRuntime.photoStudio.segmentationBackgroundId
  const content = experienceConfig.content.photoStudio
  const options = experienceRuntime.photoStudio.filters.filter((filter) => filter.id !== secretStation.id || isStationFound(secretStation.id))
  const cameraDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get('cameraDebug') === 'true'
  const segDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).get('segDebug') === 'true'
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
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
      void startSegmentationRef.current()
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState(cameraDebug ? 'error' : 'fallback')
      setCameraError('getUserMedia is not available')
      setCameraNotice('No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá nuevamente.')
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
      analytics.track('camera_permission_granted', { source: 'photo_studio' })
      if (!mountedRef.current || sessionId !== sessionIdRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setPermissionState('granted')
      setCameraState('connecting')
      if (videoRef.current) await attachStreamToVideo(videoRef.current, stream, sessionId)
    } catch (error: unknown) {
      stopCamera()
      if (isCameraPermissionDenied(error)) analytics.track('camera_permission_denied', { source: 'photo_studio' })
      setPermissionState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'error')
      setCameraState(cameraDebug ? 'error' : 'fallback')
      setCameraError(error instanceof Error ? error.message : 'Unable to access camera')
      setCameraNotice('No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá nuevamente.')
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

  const capturePhoto = async () => {
    const video = videoRef.current
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
    const basePhoto = rawCanvas.toDataURL('image/jpeg', .92)
    const photo = compositeCanvas && hasCompositeFrameRef.current ? compositeCanvas.toDataURL('image/jpeg', .92) : await renderFilteredPhoto(basePhoto, selectedOverlay)
    setPhotoDataUrl(photo)
    onCaptured(photo, selectedOverlay)
    analytics.track('button_clicked', { action: 'photo_captured', filterId: selectedOverlay, source: 'photo_studio' })
    stopSegmentation()
    hasCompositeFrameRef.current = false
    setHasCompositeFrame(false)
    stopCamera()
    setCameraState('captured')
    onResult()
  }

  useEffect(() => {
    void preloadBackgrounds().catch(() => setCameraNotice('No pudimos cargar los fondos de Photo Studio.'))
  }, [selectedOverlay])

  useEffect(() => {
    mountedRef.current = true
    void startCamera()
    return () => {
      mountedRef.current = false
      stopSegmentation()
      segmenterRef.current?.close()
      segmenterRef.current = null
      segmenterPromiseRef.current = null
      stopCamera()
    }
  }, [])

  const handleClose = () => {
    stopSegmentation()
    stopCamera()
    onClose()
  }
  const showLiveCamera = cameraState === 'live' || cameraState === 'connecting'
  const mediaSource = photoDataUrl || experienceConfig.cameraImage
  const visibleNotice = cameraNotice || notice
  const isEventFilter = selectedOverlay === eventStation.id
  const isSecretFilter = selectedOverlay === secretStation.id
  const mediaFilter = filterMediaEffects[selectedOverlay] || filterEffects[selectedOverlay] || 'none'
  const compositeFilter = filterCompositeEffects[selectedOverlay] || 'none'
  const selectFilter = (filterId: string) => {
    if (cameraState === 'captured' || photoDataUrl) return
    onSelect(filterId)
  }

  const videoElement = <video ref={setVideoRef} className="studio-camera" style={{ filter: mediaFilter }} autoPlay muted playsInline aria-label="Vista de cámara" />
  const debugStream = streamRef.current
  const debugTrack = debugStream?.getVideoTracks()[0]
  const debugVideo = videoRef.current
  const diagnostics = <pre className="camera-debug-diagnostics">permission: {permissionState}{'\n'}stream.active: {String(debugStream?.active ?? false)}{'\n'}track.readyState: {debugTrack?.readyState ?? 'none'}{'\n'}track.label: {debugTrack?.label || 'none'}{'\n'}video.readyState: {debugVideo?.readyState ?? 0}{'\n'}video.paused: {String(debugVideo?.paused ?? true)}{'\n'}video.videoWidth: {debugVideo?.videoWidth ?? 0}{'\n'}video.videoHeight: {debugVideo?.videoHeight ?? 0}{'\n'}state: {cameraState}{cameraError ? `\nerror: ${cameraError}` : ''}</pre>
  if (cameraDebug) return <section className="phone-screen studio-screen camera-debug-screen"><header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button><span>Camera debug</span><span>{cameraState}</span></header><div className="camera-debug-media">{videoElement}</div>{diagnostics}</section>
  return <section className={`phone-screen studio-screen ${hasCompositeFrame ? 'segmentation-live' : ''}`}><div className="studio-media">{showLiveCamera ? videoElement : <img className="studio-fallback-image" style={{ filter: mediaFilter }} src={mediaSource} alt="" />}<canvas ref={compositeCanvasRef} className="studio-composite-canvas" style={{ filter: compositeFilter }} aria-label="Vista compuesta de cámara" /></div><div className="photo-shade medium" /><header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button><Sparkles size={18} /></header>{!isEventFilter && !isSecretFilter && <div className="studio-copy"><h2>{content.title}</h2><p>{content.subtitle}</p></div>}{!isEventFilter && !isSecretFilter && <div key={selectedOverlay} className="studio-overlay" style={{ color: filterOverlayColors[selectedOverlay] }}><ContentLines lines={content.overlayLines} /></div>}{visibleNotice && <p className="studio-feedback">{visibleNotice}</p>}<div className="studio-options">{options.map((item) => { const locked = item.id === eventStation.id && !isStationFound(item.id); return <button className={`${selectedOverlay === item.id ? 'active ' : ''}${locked ? 'locked-option' : ''}`} key={item.id} onClick={() => locked ? onLocked() : selectFilter(item.id)} aria-disabled={locked}><img src={item.image} alt={item.name} /><small>{item.name}</small></button> })}</div><div className="studio-controls"><button onClick={startCamera} aria-label={content.controls.repeatPhoto}><ImageIcon size={22} /><small>{content.controls.photo}</small></button><button className="shutter" onClick={capturePhoto} aria-label={content.controls.takePhoto} /><button disabled={!photoDataUrl} onClick={() => photoDataUrl && onResult()} aria-label={content.controls.publish}><MoreHorizontal size={18} /><small>{content.controls.publish}</small></button></div><div className="studio-tabs">{content.tabs.map((item) => <button className={tab === item ? 'active' : ''} onClick={() => onTab(item)} key={item}>{item}</button>)}</div>{segDebug && <div className="seg-debug-panel"><figure><canvas ref={debugVideoCanvasRef} /><figcaption>VIDEO ORIGINAL</figcaption></figure><figure><canvas ref={debugMaskCanvasRef} /><figcaption>PERSON CUTOUT</figcaption></figure><figure><canvas ref={debugCompositeCanvasRef} /><figcaption>COMPOSITE FINAL</figcaption></figure></div>}</section>
}

function ShareResult({ photoSrc, filterId, onClose, onEdit }: { photoSrc: string; filterId: string; onClose: () => void; onEdit: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const sharing = experienceConfig.content.sharing
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const filename = `${sharing.filenamePrefix}-${filterId}.jpg`
  const isEventFilter = filterId === eventStation.id
  const resultName = filterId === experienceRuntime.photoStudio.defaultFilterId ? experienceConfig.name : experienceRuntime.stationById[filterId]?.name || experienceConfig.name
  useEffect(() => {
    analytics.track('experience_finished', { filterId, source: 'photo_studio' })
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
    analytics.track('button_clicked', { action: 'photo_shared', filterId, source })
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
  return <section className="phone-screen share-screen" style={{ backgroundImage: `url(${photoSrc})` }}><div className="photo-shade medium" /><header className="floating-header"><button className="icon-button" onClick={onClose}><X size={21} /></button><Sparkles size={18} /></header><div className="share-card"><div className="share-art"><img src={photoSrc} alt={sharing.imageAlt} />{!isEventFilter && <span><ContentLines lines={experienceConfig.content.photoStudio.overlayLines} /></span>}<strong>{resultName}</strong><small>{experienceConfig.eventDate} · {experienceConfig.location}</small></div><div className="share-actions"><button onClick={() => { void sharePhoto('instagram') }}><Share2 size={18} /><ContentLines lines={sharing.instagramLines} /></button><button onClick={downloadPhoto}><ArrowRight size={18} /><ContentLines lines={sharing.downloadLines} /></button><button onClick={() => { void sharePhoto('other_networks') }}><MoreHorizontal size={18} /><ContentLines lines={sharing.otherNetworksLines} /></button></div></div><a className="corsteno-credit" href="https://corsteno.com" target="_blank" rel="noreferrer">{sharing.creditLabel}</a><button className="back-edit" onClick={onEdit}><ArrowLeft size={16} /> {sharing.editLabel}</button></section>
}

function StationDetail({ station, onBack, onPhoto }: { station: Station; onBack: () => void; onPhoto: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.detail
  const permanentStations = experienceRuntime.permanentStations
  return <section className="phone-screen detail-screen"><Header page={content.page} onBack={onBack} /><div className="detail-hero" style={{ backgroundImage: `url(${station.image})` }}><div className="detail-hero-image" style={{ backgroundImage: `url(${station.image})` }} /><span>{content.brandLabel}</span><strong>{station.name}</strong><small>{content.subtitle}</small></div><div className="detail-text"><p>{station.description} {content.descriptionSuffix}</p><div className="detail-thumbs">{permanentStations.slice(0, 3).map((item) => <img key={item.id} src={item.image} alt={item.name} />)}</div><button className="cream-button" onClick={onPhoto}>{content.usePhotoLabel} <ArrowRight size={18} /></button></div></section>
}

function Passport({ stationTotal, explorationFoundCount, isStationFound, onExplore, onCamera, onMenu }: { stationTotal: number; explorationFoundCount: number; isStationFound: (stationId: string) => boolean; onExplore: () => void; onCamera: () => void; onMenu: () => void }) {
  const experienceRuntime = useExperienceRuntime()
  const experienceConfig = experienceRuntime.config
  const content = experienceConfig.content.passport
  const eventStation = requireStation(experienceRuntime.eventStation, 'una estación de evento')
  const secretStation = requireStation(experienceRuntime.secretStation, 'una secret station')
  return <section className="phone-screen passport-screen"><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="passport-heading"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><div className="passport-stats"><span><b>{experienceConfig.passportTotals.nights}</b> {content.statLabels.nights}</span><span><b>{stationTotal}</b> {content.statLabels.stations}</span><span><b>{experienceConfig.passportTotals.specials}</b> {content.statLabels.specials}</span></div></div><ExplorationProgress foundCount={explorationFoundCount} /><div className="ticket"><p><ContentLines lines={content.ticketLines} /></p><div className="ticket-numbers"><b>{experienceConfig.passportTotals.nights}<small>{content.statLabels.nights}</small></b><b>{stationTotal}<small>{content.statLabels.stations}</small></b><b>{experienceConfig.passportTotals.specials}<small>{content.statLabels.specials}</small></b></div><Ticket size={35} /></div><div className="history-list">{experienceConfig.passportHistory.map((item) => { const isSecretItem = item.stationId === secretStation.id; const locked = (item.stationId === eventStation.id || isSecretItem) && !isStationFound(item.stationId); const label = isSecretItem && locked ? '???' : item.name; const status = isSecretItem ? (locked ? content.secretLockedStatus : content.secretFoundStatus) : locked ? content.notFoundStatus : item.date; return <div className={`history-row ${locked ? 'locked-history-row' : ''}`} key={item.stationId}><img src={item.image} alt="" /><span>{label}</span><small>{status}</small></div> })}</div><p className="passport-copy"><ContentLines lines={content.closingLines} /></p><BottomNav active="passport" onExplore={onExplore} onCamera={onCamera} onPassport={() => undefined} /></section>
}

function Upcoming({ onExplore, onCamera, onPassport, onMenu }: { onExplore: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const content = experienceConfig.content.upcoming
  return <section className="phone-screen upcoming-screen"><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="upcoming-heading"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1></div><div className="upcoming-list">{experienceConfig.upcomingEvents.map((item) => <div className="upcoming-row" key={item.name}><img src={item.image} alt="" /><div><b>{item.name}</b><small>{item.date}</small></div></div>)}</div><p className="upcoming-copy"><ContentLines lines={content.closingLines} /></p><BottomNav active="explore" onExplore={onExplore} onCamera={onCamera} onPassport={onPassport} /></section>
}

function Menu({ onClose, onNavigate, onReset }: { onClose: () => void; onNavigate: (view: View) => void; onReset: () => void }) {
  const experienceConfig = useExperienceRuntime().config
  const navigation = experienceConfig.content.navigation
  const closingLines = experienceConfig.content.passport.closingLines
  return <section className="phone-screen menu-screen"><div className="menu-photo" style={{ backgroundImage: `url(${experienceConfig.heroImage})` }} /><div className="photo-shade strong" /><header className="floating-header"><span>{experienceConfig.name}</span><button className="icon-button" onClick={onClose}><X size={21} /></button></header><nav className="menu-links"><button onClick={onClose}><Sparkles size={18} /> {navigation.explore}</button><button onClick={() => onNavigate('discover')}><Camera size={18} /> {navigation.camera}</button><button onClick={() => onNavigate('passport')}><Grid2X2 size={18} /> {navigation.passport}</button><button onClick={() => onNavigate('upcoming')}><CalendarDays size={18} /> {navigation.upcoming}</button><span className="menu-static"><Info size={18} /> {navigation.info}</span><span className="menu-static"><ImageIcon size={18} /> {navigation.sponsors}</span><button className="menu-reset" onClick={onReset}>{navigation.reset}</button></nav><div className="menu-footer"><p><ContentLines lines={closingLines} /></p><span><Sparkles size={18} /> {experienceConfig.name}</span></div></section>
}

export default App
