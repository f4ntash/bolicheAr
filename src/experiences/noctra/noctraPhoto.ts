import type { NoctraStationVariant } from './noctraMoments'
import type { NoctraSegmentationMask } from './noctraSegmentation'
import { assetUrl } from '../../utils/assets'

export const NOCTRA_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
export const NOCTRA_MODEL_PATH = assetUrl('models/selfie_segmenter.tflite')

function drawCover(context: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const x = (width - drawWidth) / 2
  const y = (height - drawHeight) / 2
  context.drawImage(source, x, y, drawWidth, drawHeight)
  return { scale, x, y }
}

function drawAtmosphere(context: CanvasRenderingContext2D, effect: NoctraStationVariant['effect'], width: number, height: number, seed: string) {
  const colors: Record<NoctraStationVariant['effect'], [string, string]> = {
    'amber-tunnel': ['rgba(245,135,68,.19)', 'rgba(249,186,115,.08)'],
    'blue-stage': ['rgba(88,90,219,.23)', 'rgba(48,151,221,.11)'],
    'sunset-stage': ['rgba(255,112,70,.22)', 'rgba(241,183,93,.12)'],
    'secret-signal': ['rgba(68,201,215,.17)', 'rgba(133,176,219,.08)'],
    'nova-gold': ['rgba(249,137,101,.2)', 'rgba(241,193,97,.1)'],
    backstage: ['rgba(245,235,214,.14)', 'rgba(196,155,113,.08)'],
  }
  const [primary, secondary] = colors[effect]
  const wash = context.createLinearGradient(0, 0, width * .65, height)
  wash.addColorStop(0, primary)
  wash.addColorStop(.52, 'rgba(10,10,14,0)')
  wash.addColorStop(1, secondary)
  context.fillStyle = wash
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = effect === 'secret-signal' ? .15 : .2
  for (let index = 0; index < 4; index += 1) {
    const x = (width * (index + 1)) / 5
    const beam = context.createLinearGradient(x, 0, x + (index % 2 ? -90 : 90), height * .82)
    beam.addColorStop(0, 'rgba(255,255,255,0)')
    beam.addColorStop(.38, primary)
    beam.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = beam
    context.beginPath()
    context.moveTo(x - 15, 0)
    context.lineTo(x + 15, 0)
    context.lineTo(x + (index % 2 ? -76 : 76), height * .82)
    context.lineTo(x + (index % 2 ? -112 : 112), height * .82)
    context.closePath()
    context.fill()
  }
  context.restore()

  let value = Array.from(seed).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17)
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
  const particleCount = effect === 'secret-signal' ? 34 : effect === 'blue-stage' ? 22 : 15
  context.save()
  context.globalCompositeOperation = 'screen'
  for (let index = 0; index < particleCount; index += 1) {
    const x = random() * width
    const y = random() * height * .86
    const radius = .7 + random() * (effect === 'secret-signal' ? 1.8 : 1.2)
    context.globalAlpha = .12 + random() * .28
    context.fillStyle = effect === 'secret-signal' ? '#8ef2ec' : effect === 'backstage' ? '#fff1d3' : '#ffe6c9'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  if (effect === 'secret-signal') {
    context.globalAlpha = .1
    context.fillStyle = '#a5f4f5'
    for (let line = 0; line < 7; line += 1) {
      const y = random() * height * .78
      context.fillRect(random() * width * .35, y, width * (.12 + random() * .45), 1)
    }
  }
  context.restore()
}

function drawStamp(context: CanvasRenderingContext2D, width: number, height: number, variant: NoctraStationVariant, editionLabel: string, dateLabel: string) {
  const top = height - Math.round(height * .16)
  const panel = context.createLinearGradient(0, top, 0, height)
  panel.addColorStop(0, 'rgba(7,7,9,0)')
  panel.addColorStop(.22, 'rgba(7,7,9,.56)')
  panel.addColorStop(1, 'rgba(7,7,9,.78)')
  context.fillStyle = panel
  context.fillRect(0, top, width, height - top)
  context.fillStyle = 'rgba(245,239,228,.72)'
  context.font = '500 15px Arial, sans-serif'
  context.letterSpacing = '3px'
  context.fillText('NOCTRA  ·  ' + editionLabel, 34, height - 80)
  context.fillStyle = '#f7f1e7'
  context.font = '500 30px Georgia, serif'
  context.letterSpacing = '1px'
  context.fillText(variant.title, 34, height - 43, width - 68)
  context.fillStyle = 'rgba(245,239,228,.7)'
  context.font = '500 14px Arial, sans-serif'
  context.letterSpacing = '2px'
  context.textAlign = 'right'
  context.fillText(dateLabel, width - 34, height - 16)
  context.textAlign = 'left'
  context.letterSpacing = '0px'
}

export async function renderNoctraPhoto(options: {
  photo: Blob
  backgroundUrl: string
  variant: NoctraStationVariant
  editionLabel: string
  dateLabel: string
  mask?: NoctraSegmentationMask
}): Promise<Blob> {
  const photoImage = await createImageBitmap(options.photo)
  const backgroundImage = await createImageBitmap(await (await fetch(options.backgroundUrl)).blob())
  const width = 720
  const height = 1280
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) throw new Error('No se pudo preparar la imagen final')
  drawCover(context, backgroundImage, backgroundImage.width, backgroundImage.height, width, height)
  drawAtmosphere(context, options.variant.effect, width, height, options.variant.id)

  const person = document.createElement('canvas')
  person.width = width
  person.height = height
  const personContext = person.getContext('2d')
  if (!personContext) throw new Error('No se pudo preparar la capa de persona')
  personContext.filter = options.variant.effect === 'amber-tunnel' ? 'contrast(1.04) saturate(.96) sepia(.08)' : options.variant.effect === 'secret-signal' ? 'contrast(1.04) saturate(.84) hue-rotate(-5deg)' : 'contrast(1.04) saturate(.93)'
  const placement = drawCover(personContext, photoImage, photoImage.width, photoImage.height, width, height)
  personContext.filter = 'none'

  if (options.mask) {
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = width
    maskCanvas.height = height
    const maskContext = maskCanvas.getContext('2d')
    if (maskContext) {
      const alpha = maskContext.createImageData(width, height)
      for (let y = 0; y < height; y += 1) {
        const sourceY = (y - placement.y) / placement.scale
        for (let x = 0; x < width; x += 1) {
          const sourceX = (x - placement.x) / placement.scale
          const outputIndex = (y * width + x) * 4
          alpha.data[outputIndex] = 255
          alpha.data[outputIndex + 1] = 255
          alpha.data[outputIndex + 2] = 255
          if (sourceX < 0 || sourceX >= photoImage.width || sourceY < 0 || sourceY >= photoImage.height) continue
          const maskX = Math.min(options.mask.width - 1, Math.max(0, Math.floor(sourceX / photoImage.width * options.mask.width)))
          const maskY = Math.min(options.mask.height - 1, Math.max(0, Math.floor(sourceY / photoImage.height * options.mask.height)))
          const opacity = Math.max(0, Math.min(1, options.mask.values[maskY * options.mask.width + maskX]))
          alpha.data[outputIndex + 3] = opacity < .18 ? 0 : Math.round(opacity * 255)
        }
      }
      maskContext.putImageData(alpha, 0, 0)
      personContext.globalCompositeOperation = 'destination-in'
      personContext.filter = 'blur(1.15px)'
      personContext.drawImage(maskCanvas, 0, 0)
      personContext.filter = 'none'
      personContext.globalCompositeOperation = 'source-over'
      context.drawImage(person, 0, 0)
      drawAtmosphere(context, options.variant.effect, width, height, `${options.variant.id}-front`)
    } else {
      context.drawImage(person, 0, 0)
    }
  } else {
    // A static, graded image keeps the studio useful when camera or segmentation is unavailable.
    context.save()
    context.globalAlpha = .96
    drawCover(context, photoImage, photoImage.width, photoImage.height, width, height)
    context.restore()
  }

  drawStamp(context, width, height, options.variant, options.editionLabel, options.dateLabel)
  photoImage.close()
  backgroundImage.close()
  return new Promise((resolve, reject) => {
    output.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen')), 'image/jpeg', .9)
  })
}

function supportedVideoType() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
}

export function canCreateNoctraClip() {
  return typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && Boolean(supportedVideoType())
}

export async function createNoctraClip(photo: Blob, effect: NoctraStationVariant['effect']) {
  const mimeType = supportedVideoType()
  if (!mimeType || !('captureStream' in HTMLCanvasElement.prototype)) throw new Error('Este navegador no exporta video desde Photo Studio')
  const image = await createImageBitmap(photo)
  const canvas = document.createElement('canvas')
  canvas.width = 360
  canvas.height = 640
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el clip')
  const stream = canvas.captureStream(12)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 750_000 })
  const chunks: BlobPart[] = []
  return new Promise<Blob>((resolve, reject) => {
    const startedAt = performance.now()
    const sweepColors: Record<NoctraStationVariant['effect'], string> = {
      'amber-tunnel': 'rgba(255,177,91,.2)', 'blue-stage': 'rgba(116,131,255,.2)', 'sunset-stage': 'rgba(255,139,92,.22)',
      'secret-signal': 'rgba(105,225,226,.19)', 'nova-gold': 'rgba(255,196,119,.22)', backstage: 'rgba(246,228,194,.14)',
    }
    let frameId = 0
    const drawFrame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 3200)
      const scale = 1.015 + Math.sin(progress * Math.PI * 2) * .025
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.save()
      context.translate(canvas.width / 2, canvas.height / 2)
      context.scale(scale, scale)
      drawCover(context, image, image.width, image.height, canvas.width, canvas.height)
      context.restore()
      const sweepX = -canvas.width + progress * canvas.width * 3
      const sweep = context.createLinearGradient(sweepX - 90, 0, sweepX + 90, canvas.height)
      sweep.addColorStop(0, 'rgba(255,255,255,0)')
      sweep.addColorStop(.5, sweepColors[effect])
      sweep.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = sweep
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (progress < 1) frameId = requestAnimationFrame(drawFrame)
      else window.setTimeout(() => recorder.stop(), 180)
    }
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => { cancelAnimationFrame(frameId); stream.getTracks().forEach((track) => track.stop()); image.close(); reject(new Error('No se pudo exportar el clip')) }
    recorder.onstop = () => {
      cancelAnimationFrame(frameId)
      stream.getTracks().forEach((track) => track.stop())
      image.close()
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
      if (!blob.size) reject(new Error('El clip quedó vacío'))
      else resolve(blob)
    }
    drawFrame(startedAt)
    recorder.start()
  })
}
