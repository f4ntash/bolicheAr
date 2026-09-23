import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { ExperienceRuntime } from './types'
import { assetUrl } from './utils/assets'

const MODEL_PATH = assetUrl('models/selfie_segmenter.tflite')
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
function loadImage(src: string, label: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load ${label} background: ${src}`))
    image.src = src
  })
}

function drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number, imageWidth: number, imageHeight: number) {
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

type CameraState = 'waiting' | 'live' | 'error'
type MediaPipeState = 'loading' | 'ready' | 'error'

export default function VirtualBackgroundTest({ experience }: { experience: ExperienceRuntime }) {
  const backgroundStation = experience.stationById[experience.photoStudio.segmentationBackgroundId]
  const backgroundImagePath = backgroundStation?.image || experience.config.eventImage
  const backgroundName = backgroundStation?.name || 'Background'
  const videoRef = useRef<HTMLVideoElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const alphaMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const segmenterRef = useRef<ImageSegmenter | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const processingRef = useRef(false)
  const lastWebcamTimeRef = useRef(-1)
  const mountedRef = useRef(true)
  const fpsRef = useRef({ frames: 0, startedAt: performance.now(), value: 0 })
  const [cameraState, setCameraState] = useState<CameraState>('waiting')
  const [mediaPipeState, setMediaPipeState] = useState<MediaPipeState>('loading')
  const [error, setError] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [videoSize, setVideoSize] = useState('0 × 0')
  const [maskSize, setMaskSize] = useState('0 × 0')
  const [confidenceMaskCount, setConfidenceMaskCount] = useState(0)
  const [confidenceRange, setConfidenceRange] = useState('0.000 – 0.000')
  const [fps, setFps] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    let disposed = false

    const stop = () => {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      segmenterRef.current?.close()
      segmenterRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const createSegmenter = async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
      const options = {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }
      try {
        return await ImageSegmenter.createFromOptions(vision, options)
      } catch (gpuError) {
        console.warn('[VirtualBackgroundTest] GPU failed, retrying CPU', gpuError)
        return ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const } })
      }
    }

    const compose = (result: { confidenceMasks?: Array<{ width: number; height: number; getAsFloat32Array: () => Float32Array }> }) => {
      const video = videoRef.current
      const maskCanvas = maskCanvasRef.current
      const outputCanvas = resultCanvasRef.current
      const frameCanvas = frameCanvasRef.current
      const backgroundCanvas = backgroundCanvasRef.current
      const alphaMaskCanvas = alphaMaskCanvasRef.current
      const mask = result.confidenceMasks?.[0]
      if (!video || !maskCanvas || !outputCanvas || !frameCanvas || !backgroundCanvas || !alphaMaskCanvas || !mask) throw new Error('Missing video, canvas, or confidenceMasks[0]')
      const width = video.videoWidth
      const height = video.videoHeight
      const frameContext = frameCanvas.getContext('2d')
      const backgroundContext = backgroundCanvas.getContext('2d')
      const outputContext = outputCanvas.getContext('2d')
      const maskContext = maskCanvas.getContext('2d')
      const alphaMaskContext = alphaMaskCanvas.getContext('2d')
      if (!frameContext || !backgroundContext || !outputContext || !maskContext || !alphaMaskContext) throw new Error('Unable to create canvas contexts')
      const maskValues = mask.getAsFloat32Array()
      let minConfidence = 1
      let maxConfidence = 0
      for (const value of maskValues) {
        minConfidence = Math.min(minConfidence, value)
        maxConfidence = Math.max(maxConfidence, value)
      }
      if (mountedRef.current) {
        setMaskSize(`${mask.width} × ${mask.height}`)
        setConfidenceMaskCount(result.confidenceMasks?.length || 0)
        setConfidenceRange(`${minConfidence.toFixed(3)} – ${maxConfidence.toFixed(3)}`)
      }
      if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
        maskCanvas.width = mask.width
        maskCanvas.height = mask.height
      }
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
      if (alphaMaskCanvas.width !== width || alphaMaskCanvas.height !== height) {
        alphaMaskCanvas.width = width
        alphaMaskCanvas.height = height
      }
      const alphaMask = alphaMaskContext.createImageData(width, height)
      for (let y = 0; y < height; y += 1) {
        const maskY = Math.min(mask.height - 1, Math.floor((y / height) * mask.height))
        for (let x = 0; x < width; x += 1) {
          const maskX = Math.min(mask.width - 1, Math.floor((x / width) * mask.width))
          const maskIndex = maskY * mask.width + maskX
          const pixel = (y * width + x) * 4
          const alpha = Math.max(0, Math.min(1, maskValues[maskIndex])) * 255
          alphaMask.data[pixel] = 255
          alphaMask.data[pixel + 1] = 255
          alphaMask.data[pixel + 2] = 255
          alphaMask.data[pixel + 3] = alpha
        }
      }
      alphaMaskContext.putImageData(alphaMask, 0, 0)
      frameContext.globalCompositeOperation = 'destination-in'
      frameContext.drawImage(alphaMaskCanvas, 0, 0, width, height)
      frameContext.globalCompositeOperation = 'source-over'
      outputContext.clearRect(0, 0, width, height)
      outputContext.drawImage(backgroundCanvas, 0, 0, width, height)
      outputContext.drawImage(frameCanvas, 0, 0, width, height)
    }

    const start = async () => {
      setCameraState('waiting')
      setMediaPipeState('loading')
      try {
        const video = videoRef.current
        if (!video) throw new Error('Video element is not mounted')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await new Promise<void>((resolve, reject) => {
          const ready = () => video.videoWidth > 0 && video.videoHeight > 0 ? resolve() : undefined
          video.addEventListener('loadedmetadata', ready, { once: true })
          window.setTimeout(() => video.videoWidth > 0 && video.videoHeight > 0 ? resolve() : reject(new Error('Video did not provide dimensions')), 5000)
        })
        await video.play()
        setCameraState('live')
        setVideoSize(`${video.videoWidth} × ${video.videoHeight}`)
        const backgroundImage = await loadImage(backgroundImagePath, backgroundName)
        const segmenter = await createSegmenter()
        if (disposed) return
        segmenterRef.current = segmenter
        const modelLabels = segmenter.getLabels()
        setLabels(modelLabels)
        console.info('[VirtualBackgroundTest] labels', modelLabels)
        const width = video.videoWidth
        const height = video.videoHeight
        const frameCanvas = document.createElement('canvas')
        const backgroundCanvas = document.createElement('canvas')
        const alphaMaskCanvas = document.createElement('canvas')
        frameCanvas.width = width
        frameCanvas.height = height
        backgroundCanvas.width = width
        backgroundCanvas.height = height
        frameCanvasRef.current = frameCanvas
        backgroundCanvasRef.current = backgroundCanvas
        alphaMaskCanvasRef.current = alphaMaskCanvas
        const outputCanvas = resultCanvasRef.current
        if (outputCanvas) {
          outputCanvas.width = width
          outputCanvas.height = height
        }
        const backgroundContext = backgroundCanvas.getContext('2d')
        if (!backgroundContext) throw new Error('Unable to create background context')
        drawCover(backgroundContext, backgroundImage, width, height, backgroundImage.naturalWidth, backgroundImage.naturalHeight)
        setMediaPipeState('ready')

        const renderFrame = () => {
          if (disposed || !videoRef.current || !segmenterRef.current) return
          if (video.currentTime === lastWebcamTimeRef.current || processingRef.current) {
            animationFrameRef.current = window.requestAnimationFrame(renderFrame)
            return
          }
          lastWebcamTimeRef.current = video.currentTime
          const frameContext = frameCanvas.getContext('2d')
          if (!frameContext) throw new Error('Unable to create frame context')
          frameContext.drawImage(video, 0, 0, width, height)
          processingRef.current = true
          segmenterRef.current.segmentForVideo(video, performance.now(), (result) => {
            try {
              compose(result)
              fpsRef.current.frames += 1
              const elapsed = performance.now() - fpsRef.current.startedAt
              if (elapsed >= 1000) {
                fpsRef.current.value = Math.round((fpsRef.current.frames * 1000) / elapsed)
                fpsRef.current.frames = 0
                fpsRef.current.startedAt = performance.now()
                setFps(fpsRef.current.value)
              }
            } catch (composeError) {
              setError(composeError instanceof Error ? composeError.message : 'Composition error')
              setMediaPipeState('error')
            } finally {
              processingRef.current = false
              animationFrameRef.current = window.requestAnimationFrame(renderFrame)
            }
          })
        }
        renderFrame()
      } catch (startError) {
        const message = startError instanceof Error ? startError.message : 'Virtual background test failed'
        console.error('[VirtualBackgroundTest] error', startError)
        setError(message)
        if (!streamRef.current || !videoRef.current?.videoWidth) setCameraState('error')
        setMediaPipeState('error')
      }
    }

    void start()
    return () => {
      disposed = true
      mountedRef.current = false
      stop()
    }
  }, [])

  const statusColor = mediaPipeState === 'ready' ? '#77d18b' : mediaPipeState === 'error' ? '#ff8d8d' : '#f2c879'
  return <main style={{ minHeight: '100svh', padding: 18, background: '#111820', color: '#f6f2eb', fontFamily: 'Arial, sans-serif' }}>
    <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>Virtual Background Test · {backgroundName}</h1>
    <section style={{ marginBottom: 14 }}><strong style={{ display: 'block', marginBottom: 6, fontSize: 11 }}>1. SOURCE VIDEO</strong><video ref={videoRef} autoPlay muted playsInline style={{ display: 'block', width: '100%', maxWidth: 420, background: '#000' }} /></section>
    <section style={{ marginBottom: 14 }}><strong style={{ display: 'block', marginBottom: 6, fontSize: 11 }}>2. STATUS</strong><pre style={{ margin: 0, padding: 10, background: '#071016', color: statusColor, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{`Camera: ${cameraState.toUpperCase()}\nMediaPipe: ${mediaPipeState.toUpperCase()}\nVideo: ${videoSize}\nMask: ${maskSize}\nFPS: ${fps}\nLabels: ${JSON.stringify(labels)}\nPerson mask: confidenceMasks[0]\nconfidenceMasks.length: ${confidenceMaskCount}\nmin confidence / max confidence: ${confidenceRange}\nERROR: ${error || 'none'}`}</pre></section>
    <section style={{ marginBottom: 14 }}><strong style={{ display: 'block', marginBottom: 6, fontSize: 11 }}>3. PERSON MASK · WHITE = PERSON</strong><canvas ref={maskCanvasRef} style={{ display: 'block', width: '100%', maxWidth: 640, background: '#000' }} /></section>
    <section><strong style={{ display: 'block', marginBottom: 6, fontSize: 11 }}>4. FINAL COMPOSITE · {backgroundName.toUpperCase()} + PERSON</strong><canvas ref={resultCanvasRef} style={{ display: 'block', width: '100%', maxWidth: 640, background: '#000' }} /></section>
  </main>
}
