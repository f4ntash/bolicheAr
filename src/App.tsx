import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, CalendarDays, Grid2X2, Image as ImageIcon, Info, Menu as MenuIcon, MoreHorizontal, ScanLine, Share2, Sparkles, Ticket, X } from 'lucide-react'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { laEstacion } from './config/events/laEstacion'
import type { Station } from './types'
import VirtualBackgroundTest from './VirtualBackgroundTest'

type View = 'home' | 'discover' | 'unlocked' | 'stations' | 'studio' | 'share' | 'detail' | 'passport' | 'upcoming' | 'menu'

const permanentStations = laEstacion.stations.filter((station) => station.type === 'permanent')
const sunset = laEstacion.stations.find((station) => station.id === 'sunset-26')!
const secret = laEstacion.stations.find((station) => station.type === 'secret')!
const DEMO_STORAGE_KEY = 'corsteno-stations-demo'
type FoundStations = Record<string, boolean>
const filterEffects: Record<string, string> = {
  'la-estacion': 'contrast(1.04) saturate(.92)',
  'sunset-26': 'saturate(1.12) contrast(1.03) sepia(.14)',
  lago: 'saturate(.82) contrast(1.02) hue-rotate(8deg)',
  fuego: 'saturate(1.16) contrast(1.06) sepia(.2)',
  noche: 'brightness(.72) contrast(1.12) saturate(.78) hue-rotate(185deg)',
}
const filterBackgrounds: Record<string, string> = {
  'la-estacion': laEstacion.heroImage,
  'sunset-26': '/demo/sunset-claptone-vertical.png',
  lago: permanentStations[0].image,
  fuego: permanentStations[2].image,
  noche: permanentStations[3].image,
}
const segmentationBackgroundId = 'lago'
const SEGMENTATION_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
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

function readFoundStations(): FoundStations {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('resetDemo') === 'true') {
      window.localStorage.removeItem(DEMO_STORAGE_KEY)
      params.delete('resetDemo')
      const nextQuery = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`)
      return {}
    }
    const saved = window.localStorage.getItem(DEMO_STORAGE_KEY)
    if (!saved) return {}
    const parsed = JSON.parse(saved) as { eventId?: string; stations?: FoundStations }
    return parsed.eventId === laEstacion.id && parsed.stations ? parsed.stations : {}
  } catch {
    return {}
  }
}

function persistFoundStations(stations: FoundStations) {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ eventId: laEstacion.id, stations }))
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function App() {
  const vbTest = new URLSearchParams(window.location.search).get('vbTest') === 'true'
  const [view, setView] = useState<View>('home')
  const [outgoingView, setOutgoingView] = useState<View | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station>(sunset)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [foundStations, setFoundStations] = useState<FoundStations>(readFoundStations)
  const [selectedOverlay, setSelectedOverlay] = useState('la-estacion')
  const [studioTab, setStudioTab] = useState('story')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [capturedFilter, setCapturedFilter] = useState('la-estacion')
  const [studioNotice, setStudioNotice] = useState<string | null>(null)
  const [newUnlockNoticePending, setNewUnlockNoticePending] = useState(false)
  const transitionTimer = useRef<number | undefined>(undefined)
  const noticeTimer = useRef<number | undefined>(undefined)
  const isStationFound = (stationId: string) => foundStations[stationId] === true
  const sunsetFound = isStationFound(sunset.id)
  const eventStations = laEstacion.stations.filter((station) => station.type === 'event')
  const eventFoundCount = eventStations.filter((station) => isStationFound(station.id)).length
  const stationTotal = laEstacion.passportTotals.stations + (sunsetFound ? 1 : 0)

  if (vbTest) return <VirtualBackgroundTest />

  const showStudioNotice = (notice: string) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    setStudioNotice(notice)
    noticeTimer.current = window.setTimeout(() => setStudioNotice(null), 2000)
  }

  const openStudio = () => {
    if (newUnlockNoticePending) {
      setNewUnlockNoticePending(false)
      showStudioNotice('NUEVO ELEMENTO DESBLOQUEADO · SUNSET \'26')
    }
    go('studio')
  }

  const completeSunsetUnlock = () => {
    if (!sunsetFound) {
      const nextFoundStations = { ...foundStations, [sunset.id]: true }
      setFoundStations(nextFoundStations)
      persistFoundStations(nextFoundStations)
      setNewUnlockNoticePending(true)
    }
    go('unlocked')
  }
  const openStation = (station: Station) => { setSelectedStation(station); setSelectedStationId(station.id); go('detail') }
  const go = (next: View) => {
    if (next === view) return
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    setOutgoingView(view)
    setView(next)
    transitionTimer.current = window.setTimeout(() => setOutgoingView(null), 420)
  }

  const renderView = (screen: View) => {
    if (screen === 'home') return <Home onStart={() => go('stations')} onCamera={() => go('discover')} onPassport={() => go('passport')} onMenu={() => go('menu')} />
    if (screen === 'discover') return <Discover onClose={() => go('home')} onDetected={completeSunsetUnlock} />
    if (screen === 'unlocked') return <Unlocked onDetails={() => { setSelectedStation(sunset); go('detail') }} onPhoto={openStudio} />
    if (screen === 'stations') return <Stations selectedStationId={selectedStationId} isStationFound={isStationFound} eventFoundCount={eventFoundCount} eventEditionTotal={eventStations.length} onCamera={() => go('discover')} onPassport={() => go('passport')} onMenu={() => go('menu')} onOpen={openStation} />
    if (screen === 'studio') return <PhotoStudio selectedOverlay={selectedOverlay} isStationFound={isStationFound} notice={studioNotice} tab={studioTab} onSelect={setSelectedOverlay} onCaptured={(photo, filter) => { setCapturedPhoto(photo); setCapturedFilter(filter) }} onLocked={() => showStudioNotice("Encontrá SUNSET '26 durante el evento para desbloquearla.")} onTab={setStudioTab} onClose={() => go('stations')} onResult={() => go('share')} />
    if (screen === 'share') return <ShareResult photoSrc={capturedPhoto || laEstacion.cameraImage} filterId={capturedFilter} onClose={() => go('studio')} onEdit={() => go('studio')} />
    if (screen === 'detail') return <StationDetail station={selectedStation} onBack={() => go('stations')} onPhoto={openStudio} />
    if (screen === 'passport') return <Passport stationTotal={stationTotal} isStationFound={isStationFound} onExplore={() => go('stations')} onCamera={() => go('discover')} onMenu={() => go('menu')} />
    if (screen === 'upcoming') return <Upcoming onExplore={() => go('stations')} onCamera={() => go('discover')} onPassport={() => go('passport')} onMenu={() => go('menu')} />
    return <Menu onClose={() => go('home')} onNavigate={go} />
  }

  return <main className="app-shell"><div className="motion-stage">
    {outgoingView && <div className="motion-layer outgoing" aria-hidden="true">{renderView(outgoingView)}</div>}
    <div className="motion-layer incoming">{renderView(view)}</div>
  </div></main>
}

function Header({ page, onBack }: { page?: string; onBack?: () => void }) {
  return <header className="topbar">
    {onBack ? <button className="icon-button" onClick={onBack}><ArrowLeft size={19} /></button> : <span className="brand-lockup"><img src={laEstacion.logo} alt="" /> {laEstacion.name}</span>}
    {page ? <span className="topbar-page">{page}</span> : <span className="topbar-spacer" />}
  </header>
}

function BottomNav({ active, onExplore, onCamera, onPassport }: { active: string; onExplore: () => void; onCamera: () => void; onPassport: () => void }) {
  return <nav className="bottom-nav"><button className={active === 'explore' ? 'active' : ''} onClick={onExplore}><Sparkles size={17} /><span>Explorar</span></button><button className={active === 'camera' ? 'active' : ''} onClick={onCamera}><Camera size={18} /><span>Cámara</span></button><button className={active === 'passport' ? 'active' : ''} onClick={onPassport}><Grid2X2 size={17} /><span>Pasaporte</span></button></nav>
}

function Home({ onStart, onCamera, onPassport, onMenu }: { onStart: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  return <section className="phone-screen home-screen"><div className="photo-bg" style={{ backgroundImage: `url(${laEstacion.heroImage})` }} /><div className="photo-shade" /><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="home-tag">Más que<br />música<br /><em>son momentos</em></div><div className="home-copy"><span className="home-demo-mark">Demo</span><h1>Tus<br />Estaciones</h1><p>{laEstacion.tagline}</p><button className="cream-button" onClick={onStart}>Comenzar experiencia <ArrowRight size={18} /></button><p className="home-demo-note"><strong>Demo interactiva.</strong> Esta experiencia es una demostración conceptual. Algunas funciones, contenidos y comportamientos pueden cambiar en una implementación final para evento.</p></div><BottomNav active="explore" onExplore={onStart} onCamera={onCamera} onPassport={onPassport} /></section>
}

function Discover({ onClose, onDetected }: { onClose: () => void; onDetected: () => void }) {
  const [scanState, setScanState] = useState<'searching' | 'detected' | 'unlocking'>('searching')
  const startDetection = () => {
    if (scanState !== 'searching') return
    setScanState('detected')
    window.setTimeout(() => {
      setScanState('unlocking')
      window.setTimeout(onDetected, 220)
    }, 520)
  }
  const scanLabel = scanState === 'searching' ? 'Buscando' : scanState === 'detected' ? 'Logo detectado' : 'Desbloqueando'
  return <section className={`phone-screen full-photo-screen discover-screen scan-${scanState}`} style={{ backgroundImage: `url(${laEstacion.cameraImage})` }}><div className="photo-shade strong" /><header className="floating-header"><button className="icon-button" onClick={onClose}><X size={21} /></button><Sparkles size={18} /></header><div className="discover-copy"><h2>Buscá el lago</h2><p>Apuntá con tu cámara al logo<br />de la estación en el evento.</p></div><button className="reticle" onClick={startDetection} aria-label="Detectar estación"><span /><span /><span /><span /><div className="station-logo-mark"><img src={laEstacion.logo} alt="La Estación" /><small>La Estación</small></div></button><div className="discover-bottom"><div className="round-scan"><ScanLine size={23} /></div><p className="scan-status">{scanLabel}<br />Cuando lo encuentres se desbloquea una nueva estación</p></div></section>
}

function Unlocked({ onDetails, onPhoto }: { onDetails: () => void; onPhoto: () => void }) {
  return <section className="phone-screen full-photo-screen unlocked-screen" style={{ backgroundImage: `url(${laEstacion.eventImage})` }}><div className="atmosphere-layer" style={{ backgroundImage: `url(${laEstacion.eventImage})` }} /><div className="photo-shade strong" /><header className="floating-header"><button className="icon-button"><ArrowLeft size={20} /></button><span>La Estación</span><span>04 / 04</span></header><div className="unlocked-copy"><p className="eyebrow">¡Desbloqueada!</p><p className="eyebrow">Edición especial</p><h1>Sunset '26</h1><p>Esta estación existe<br />únicamente esta noche.</p></div><div className="stacked-actions"><button className="cream-button" onClick={onDetails}>Ver detalles <ArrowRight size={18} /></button><button className="outline-button" onClick={onPhoto}>Crear una foto ahora</button></div></section>
}

function Stations({ selectedStationId, isStationFound, eventFoundCount, eventEditionTotal, onCamera, onPassport, onMenu, onOpen }: { selectedStationId: string | null; isStationFound: (stationId: string) => boolean; eventFoundCount: number; eventEditionTotal: number; onCamera: () => void; onPassport: () => void; onMenu: () => void; onOpen: (station: Station) => void }) {
  const [activeTab, setActiveTab] = useState('todas')
  const sunsetFound = isStationFound(sunset.id)
  return <section className="phone-screen stations-screen"><Header page="Tus estaciones -" /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="stations-tabs">{[['todas', 'Todas'], ['permanentes', 'Permanentes'], ['especiales', 'Especiales']].map(([id, label]) => <button key={id} className={activeTab === id ? 'selected' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div><div className="stations-content"><div className="section-label"><span>Permanentes</span><span>04 / 04</span></div><div className="station-grid-ref">{permanentStations.map((station) => <StationTile key={station.id} station={station} selected={selectedStationId === station.id} onOpen={onOpen} />)}</div><div className="section-label event-label"><span>Edición especial</span><span><span key={eventFoundCount} className="event-progress-count">{eventFoundCount.toString().padStart(2, '0')}</span> / {eventEditionTotal.toString().padStart(2, '0')}</span></div><button className={`event-strip ${sunsetFound ? '' : 'locked-event-strip'}`} aria-disabled={!sunsetFound} onClick={() => { if (isStationFound(sunset.id)) onOpen(sunset) }}><img className={sunsetFound ? undefined : 'locked-event-image'} src={sunset.image} alt="Sunset 26" /><div><h3>Sunset '26</h3><p>{sunsetFound ? 'Encontrada' : <>No encontrada<br />Disponible únicamente esta noche.</>}</p></div><ArrowRight size={20} /></button><button className="secret-strip" onClick={() => onOpen(secret)}><div className="secret-blur" style={{ backgroundImage: `url(${secret.image})` }} /><strong>???</strong><span>Algunas estaciones no se anuncian.</span></button></div><BottomNav active="explore" onExplore={() => undefined} onCamera={onCamera} onPassport={onPassport} /></section>
}

function StationTile({ station, selected, onOpen }: { station: Station; selected: boolean; onOpen: (station: Station) => void }) {
  const numeral = ['I', 'II', 'III', 'IV'][station.count - 1]
  return <button className={`station-tile ${selected ? 'selected-station' : ''}`} onClick={() => onOpen(station)}><img src={station.image} alt={station.name} /><div className="tile-shade" /><div className="tile-copy"><strong>{station.name}</strong><b>{numeral}</b><small>Encontrada<br />{station.count} {station.count === 1 ? 'vez' : 'veces'}</small></div></button>
}

function PhotoStudio({ selectedOverlay, isStationFound, notice, tab, onSelect, onCaptured, onLocked, onTab, onClose, onResult }: { selectedOverlay: string; isStationFound: (stationId: string) => boolean; notice: string | null; tab: string; onSelect: (id: string) => void; onCaptured: (photo: string, filter: string) => void; onLocked: () => void; onTab: (tab: string) => void; onClose: () => void; onResult: () => void }) {
  const options = [{ id: 'la-estacion', name: 'La Estación', image: laEstacion.heroImage }, sunset, permanentStations[0], permanentStations[2], permanentStations[3]]
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
    console.debug('[PhotoStudio performance]', {
      cameraFps: Number((metrics.cameraFrames * 1000 / elapsed).toFixed(1)),
      segmentationFps: Number((metrics.segmentationFrames * 1000 / elapsed).toFixed(1)),
      averageInferenceMs: metrics.segmentationFrames ? Number((metrics.inferenceMs / metrics.segmentationFrames).toFixed(1)) : 0,
    })
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
    if (videoRef.current) videoRef.current.srcObject = null
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
    if (!background) throw new Error('Lago background is not loaded')
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
            baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate: 'GPU' as const },
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
  const showLiveCamera = cameraState !== 'fallback' && cameraState !== 'captured' && cameraState !== 'error'
  const mediaSource = photoDataUrl || laEstacion.cameraImage
  const visibleNotice = cameraNotice || notice
  const isSunset = selectedOverlay === sunset.id
  const selectFilter = (filterId: string) => {
    if (cameraState === 'captured' || photoDataUrl) return
    onSelect(filterId)
  }

  const videoElement = <video ref={setVideoRef} className="studio-camera" autoPlay muted playsInline aria-label="Vista de cámara" />
  const debugStream = streamRef.current
  const debugTrack = debugStream?.getVideoTracks()[0]
  const debugVideo = videoRef.current
  const diagnostics = <pre className="camera-debug-diagnostics">permission: {permissionState}{'\n'}stream.active: {String(debugStream?.active ?? false)}{'\n'}track.readyState: {debugTrack?.readyState ?? 'none'}{'\n'}track.label: {debugTrack?.label || 'none'}{'\n'}video.readyState: {debugVideo?.readyState ?? 0}{'\n'}video.paused: {String(debugVideo?.paused ?? true)}{'\n'}video.videoWidth: {debugVideo?.videoWidth ?? 0}{'\n'}video.videoHeight: {debugVideo?.videoHeight ?? 0}{'\n'}state: {cameraState}{cameraError ? `\nerror: ${cameraError}` : ''}</pre>
  if (cameraDebug) return <section className="phone-screen studio-screen camera-debug-screen"><header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button><span>Camera debug</span><span>{cameraState}</span></header><div className="camera-debug-media">{videoElement}</div>{diagnostics}</section>
  return <section className={`phone-screen studio-screen studio-filter-${selectedOverlay} ${hasCompositeFrame ? 'segmentation-live' : ''}`}><div className="studio-media">{showLiveCamera ? videoElement : <img className="studio-fallback-image" src={mediaSource} alt="" />}<canvas ref={compositeCanvasRef} className="studio-composite-canvas" aria-label="Vista compuesta de cámara" /></div><div className="photo-shade medium" /><header className="floating-header"><button className="icon-button" onClick={handleClose}><X size={21} /></button><Sparkles size={18} /></header>{!isSunset && <div className="studio-copy"><h2>Creá tu noche</h2><p>Usá los elementos de tus estaciones.</p></div>}{!isSunset && <div key={selectedOverlay} className={`studio-overlay overlay-${selectedOverlay}`}><span>Same<br />people<br />different<br />skies +</span></div>}{visibleNotice && <p className="studio-feedback">{visibleNotice}</p>}<div className="studio-options">{options.map((item) => { const locked = item.id === sunset.id && !isStationFound(item.id); return <button className={`${selectedOverlay === item.id ? 'active ' : ''}${locked ? 'locked-option' : ''}`} key={item.id} onClick={() => locked ? onLocked() : selectFilter(item.id)} aria-disabled={locked}><img src={item.image} alt={item.name} /><small>{item.name}</small></button> })}</div><div className="studio-controls"><button onClick={startCamera} aria-label="Repetir foto"><ImageIcon size={22} /><small>Foto</small></button><button className="shutter" onClick={capturePhoto} aria-label="Tomar foto" /><button onClick={() => photoDataUrl && onResult()} aria-label="Publicar foto"><MoreHorizontal size={22} /><small>Post</small></button></div><div className="studio-tabs">{['foto', 'story', 'post'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => onTab(item)} key={item}>{item}</button>)}</div>{segDebug && <div className="seg-debug-panel"><figure><canvas ref={debugVideoCanvasRef} /><figcaption>VIDEO ORIGINAL</figcaption></figure><figure><canvas ref={debugMaskCanvasRef} /><figcaption>PERSON CUTOUT</figcaption></figure><figure><canvas ref={debugCompositeCanvasRef} /><figcaption>COMPOSITE FINAL</figcaption></figure></div>}</section>
}

function ShareResult({ photoSrc, filterId, onClose, onEdit }: { photoSrc: string; filterId: string; onClose: () => void; onEdit: () => void }) {
  const filename = `tus-estaciones-${filterId}.jpg`
  const downloadPhoto = async () => {
    const blob = await (await fetch(photoSrc)).blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const sharePhoto = async () => {
    const blob = await (await fetch(photoSrc)).blob()
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Tus Estaciones' })
      return
    }
    if (navigator.share) {
      await navigator.share({ title: 'Tus Estaciones', text: 'Una noche de La Estación.' })
      return
    }
    await downloadPhoto()
  }
  return <section className={`phone-screen share-screen studio-filter-${filterId}`} style={{ backgroundImage: `url(${photoSrc})` }}><div className="photo-shade medium" /><header className="floating-header"><button className="icon-button" onClick={onClose}><X size={21} /></button><Sparkles size={18} /></header><div className="share-card"><div className="share-art"><img src={photoSrc} alt="Foto de Tus Estaciones" /><span>Same<br />people<br />different<br />skies +</span><strong>Sunset '26</strong><small>{laEstacion.eventDate} · {laEstacion.location}</small></div><div className="share-actions"><button onClick={sharePhoto}><Share2 size={18} /> Compartir<br />en Instagram</button><button onClick={downloadPhoto}><ArrowRight size={18} /> Guardar<br />en tu galería</button><button onClick={sharePhoto}><MoreHorizontal size={18} /> Otras redes</button></div></div><button className="back-edit" onClick={onEdit}><ArrowLeft size={16} /> Volver a editar</button></section>
}

function StationDetail({ station, onBack, onPhoto }: { station: Station; onBack: () => void; onPhoto: () => void }) {
  return <section className="phone-screen detail-screen"><Header page="05 / 06" onBack={onBack} /><div className="detail-hero" style={{ backgroundImage: `url(${station.image})` }}><div className="detail-hero-image" style={{ backgroundImage: `url(${station.image})` }} /><span>La Estación</span><strong>{station.name}</strong><small>El reflejo que nos une</small></div><div className="detail-text"><p>{station.description} Encontrala en distintos puntos del evento.</p><div className="detail-thumbs">{permanentStations.slice(0, 3).map((item) => <img key={item.id} src={item.image} alt={item.name} />)}</div><button className="cream-button" onClick={onPhoto}>Usar en mis fotos <ArrowRight size={18} /></button><p className="map-link">⌖ Ver en el mapa</p></div></section>
}

function Passport({ stationTotal, isStationFound, onExplore, onCamera, onMenu }: { stationTotal: number; isStationFound: (stationId: string) => boolean; onExplore: () => void; onCamera: () => void; onMenu: () => void }) {
  return <section className="phone-screen passport-screen"><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="passport-heading"><p className="eyebrow">No son eventos. Son recuerdos.</p><h1>Mi pasaporte</h1><div className="passport-stats"><span><b>{laEstacion.passportTotals.nights}</b> noches</span><span><b>{stationTotal}</b> estaciones</span><span><b>{laEstacion.passportTotals.specials}</b> especiales</span></div></div><div className="ticket"><p>La Estación<br />Tus Estaciones</p><div className="ticket-numbers"><b>{laEstacion.passportTotals.nights}<small>noches</small></b><b>{stationTotal}<small>estaciones</small></b><b>{laEstacion.passportTotals.specials}<small>especiales</small></b></div><Ticket size={35} /></div><div className="history-list">{laEstacion.passportHistory.map((item) => { const locked = item.stationId === sunset.id && !isStationFound(item.stationId); return <div className={`history-row ${locked ? 'locked-history-row' : ''}`} key={item.stationId}><img src={item.image} alt="" /><span>{item.name}</span><small>{locked ? 'No encontrada' : item.date}</small></div> })}</div><p className="passport-copy">No coleccionás premios.<br />Coleccionás tus noches.</p><BottomNav active="passport" onExplore={onExplore} onCamera={onCamera} onPassport={() => undefined} /></section>
}

function Upcoming({ onExplore, onCamera, onPassport, onMenu }: { onExplore: () => void; onCamera: () => void; onPassport: () => void; onMenu: () => void }) {
  return <section className="phone-screen upcoming-screen"><Header /><button className="top-menu-button" onClick={onMenu}><MenuIcon size={21} /></button><div className="upcoming-heading"><p className="eyebrow">Nuevos lugares. Nuevas estaciones.</p><h1>Próximas fechas</h1></div><div className="upcoming-list">{laEstacion.upcomingEvents.map((item) => <button className="upcoming-row" key={item.name}><img src={item.image} alt="" /><div><b>{item.name}</b><small>{item.date}</small></div><ArrowRight size={20} /></button>)}</div><p className="upcoming-copy">Diferentes destinos.<br />La misma energía.</p><BottomNav active="explore" onExplore={onExplore} onCamera={onCamera} onPassport={onPassport} /></section>
}

function Menu({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  return <section className="phone-screen menu-screen"><div className="menu-photo" style={{ backgroundImage: `url(${laEstacion.heroImage})` }} /><div className="photo-shade strong" /><header className="floating-header"><span>{laEstacion.name}</span><button className="icon-button" onClick={onClose}><X size={21} /></button></header><nav className="menu-links"><button onClick={onClose}><Sparkles size={18} /> Explorar</button><button onClick={() => onNavigate('discover')}><Camera size={18} /> Cámara</button><button onClick={() => onNavigate('passport')}><Grid2X2 size={18} /> Mi pasaporte</button><button onClick={() => onNavigate('upcoming')}><CalendarDays size={18} /> Próximas fechas</button><button><Info size={18} /> Info</button><button><ImageIcon size={18} /> Sponsors</button></nav><div className="menu-footer"><p>No coleccionás premios.<br />Coleccionás tus noches.</p><span><Sparkles size={18} /> La Estación</span></div></section>
}

export default App
