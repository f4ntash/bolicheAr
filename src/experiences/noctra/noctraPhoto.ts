import type { NoctraStationVariant } from './noctraMoments'
import type { NoctraSegmentationMask } from './noctraSegmentation'
import { assetUrl } from '../../utils/assets'

export const NOCTRA_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
export const NOCTRA_MODEL_PATH = assetUrl('models/selfie_segmenter.tflite')

export type NoctraPhotoFormat = 'foto' | 'story' | 'post'

const NOCTRA_PHOTO_OUTPUT_SIZE: Record<NoctraPhotoFormat, { width: number; height: number }> = {
  foto: { width: 720, height: 900 },
  story: { width: 720, height: 1280 },
  post: { width: 720, height: 720 },
}

function drawCover(context: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const x = (width - drawWidth) / 2
  const y = (height - drawHeight) / 2
  context.drawImage(source, x, y, drawWidth, drawHeight)
  return { scale, x, y }
}

type NoctraEffect = NoctraStationVariant['effect']

const EFFECT_COLORS: Record<NoctraEffect, [string, string, string]> = {
  'amber-tunnel': ['rgba(245,135,68,.15)', 'rgba(249,186,115,.07)', '#ffe3c6'],
  'blue-stage': ['rgba(88,106,219,.18)', 'rgba(48,151,221,.1)', '#dce8ff'],
  'sunset-stage': ['rgba(255,112,70,.16)', 'rgba(241,183,93,.1)', '#ffe0c9'],
  'secret-signal': ['rgba(68,180,190,.13)', 'rgba(133,176,219,.08)', '#d4f7f3'],
  'nova-gold': ['rgba(249,137,101,.15)', 'rgba(241,193,97,.09)', '#ffe7c8'],
  backstage: ['rgba(220,194,161,.1)', 'rgba(196,155,113,.07)', '#fff1d3'],
}

async function decodeImage(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(blob)
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen')), 'image/jpeg', quality)
  })
}

function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

export async function prepareNoctraPhoto(photo: Blob) {
  if (!photo.size) throw new Error('La imagen está vacía')
  const image = await decodeImage(photo)
  try {
    if (!image.width || !image.height) throw new Error('La imagen no tiene dimensiones válidas')
    const largestEdge = Math.max(image.width, image.height)
    if (largestEdge <= 2560) return photo

    const scale = 2560 / largestEdge
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar esta foto en el dispositivo')
    context.fillStyle = '#09090b'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await canvasToJpeg(canvas, .94)
  } finally {
    image.close()
  }
}

function drawBackgroundLight(context: CanvasRenderingContext2D, effect: NoctraEffect, width: number, height: number) {
  const [primary, secondary] = EFFECT_COLORS[effect]
  const wash = context.createLinearGradient(0, 0, width * .7, height)
  wash.addColorStop(0, primary)
  wash.addColorStop(.55, 'rgba(10,10,14,0)')
  wash.addColorStop(1, secondary)
  context.fillStyle = wash
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = .12
  for (let index = 0; index < 3; index += 1) {
    const x = (width * (index + 1)) / 4
    const beam = context.createLinearGradient(x, 0, x + (index % 2 ? -70 : 70), height * .72)
    beam.addColorStop(0, 'rgba(255,255,255,0)')
    beam.addColorStop(.42, primary)
    beam.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = beam
    context.beginPath()
    context.moveTo(x - 12, 0)
    context.lineTo(x + 12, 0)
    context.lineTo(x + (index % 2 ? -74 : 74), height * .72)
    context.lineTo(x + (index % 2 ? -102 : 102), height * .72)
    context.closePath()
    context.fill()
  }
  context.restore()
}

function drawForegroundEffects(context: CanvasRenderingContext2D, effect: NoctraEffect, width: number, height: number, seed: string) {
  const [, , particleColor] = EFFECT_COLORS[effect]
  let value = Array.from(seed).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17)
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
  context.save()
  context.globalCompositeOperation = 'screen'
  for (let index = 0; index < 18; index += 1) {
    const x = random() * width
    const y = random() * height * .84
    const radius = .55 + random() * 1.15
    context.globalAlpha = .1 + random() * .19
    context.fillStyle = particleColor
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  const horizon = context.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, height * .55)
  horizon.addColorStop(0, 'rgba(255,237,215,.055)')
  horizon.addColorStop(1, 'rgba(255,237,215,0)')
  context.globalAlpha = 1
  context.fillStyle = horizon
  context.fillRect(0, 0, width, height)
  context.restore()
}

function applyColorTreatment(context: CanvasRenderingContext2D, effect: NoctraEffect, width: number, height: number) {
  const [primary, secondary] = EFFECT_COLORS[effect]
  const grade = context.createLinearGradient(width, 0, 0, height)
  grade.addColorStop(0, primary.replace(/\.\d+\)/, '.11)'))
  grade.addColorStop(.52, 'rgba(8,9,13,0)')
  grade.addColorStop(1, secondary.replace(/\.\d+\)/, '.08)'))
  context.fillStyle = grade
  context.fillRect(0, 0, width, height)

  const vignette = context.createRadialGradient(width * .5, height * .44, height * .2, width * .5, height * .52, height * .78)
  vignette.addColorStop(0, 'rgba(5,7,10,0)')
  vignette.addColorStop(1, 'rgba(5,7,10,.24)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

function drawFallbackPhoto(context: CanvasRenderingContext2D, image: ImageBitmap, width: number, height: number) {
  const frame = { x: 50, y: 102, width: width - 100, height: height - 390 }
  const scale = Math.min(frame.width / image.width, frame.height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const x = (width - drawWidth) / 2
  const y = frame.y + (frame.height - drawHeight) / 2
  const radius = 8

  context.save()
  context.shadowColor = 'rgba(0,0,0,.48)'
  context.shadowBlur = 28
  context.shadowOffsetY = 9
  context.fillStyle = '#101013'
  roundedRectPath(context, x - 2, y - 2, drawWidth + 4, drawHeight + 4, radius + 2)
  context.fill()
  context.restore()

  context.save()
  roundedRectPath(context, x, y, drawWidth, drawHeight, radius)
  context.clip()
  context.filter = 'contrast(1.03) saturate(.9)'
  context.drawImage(image, x, y, drawWidth, drawHeight)
  context.filter = 'none'
  context.restore()

  context.save()
  context.strokeStyle = 'rgba(246,230,214,.43)'
  context.lineWidth = 1
  roundedRectPath(context, x + .5, y + .5, drawWidth - 1, drawHeight - 1, radius)
  context.stroke()
  context.restore()
}

function isUsableMask(mask: NoctraSegmentationMask | undefined): mask is NoctraSegmentationMask {
  if (!mask || !Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1) return false
  if (mask.width > 4096 || mask.height > 4096 || mask.values.length !== mask.width * mask.height) return false
  let foregroundPixels = 0
  const sampleStep = Math.max(1, Math.floor(mask.values.length / 12000))
  for (let index = 0; index < mask.values.length; index += sampleStep) {
    const value = mask.values[index]
    if (!Number.isFinite(value) || value < 0 || value > 1) return false
    if (value >= .5) foregroundPixels += 1
  }
  const ratio = foregroundPixels / Math.ceil(mask.values.length / sampleStep)
  return ratio >= .003 && ratio <= .98
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
  format: NoctraPhotoFormat
  variant: NoctraStationVariant
  editionLabel: string
  dateLabel: string
  mask?: NoctraSegmentationMask
}): Promise<Blob> {
  const preparedPhoto = await prepareNoctraPhoto(options.photo)
  const photoImage = await decodeImage(preparedPhoto)
  let backgroundImage: ImageBitmap
  try {
    const backgroundResponse = await fetch(options.backgroundUrl)
    if (!backgroundResponse.ok) throw new Error('No se pudo cargar el fondo de esta estación')
    backgroundImage = await decodeImage(await backgroundResponse.blob())
  } catch (error) {
    photoImage.close()
    throw error
  }
  const { width, height } = NOCTRA_PHOTO_OUTPUT_SIZE[options.format]
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) {
    photoImage.close()
    backgroundImage.close()
    throw new Error('No se pudo preparar la imagen final')
  }

  try {
    drawCover(context, backgroundImage, backgroundImage.width, backgroundImage.height, width, height)
    drawBackgroundLight(context, options.variant.effect, width, height)

    if (isUsableMask(options.mask)) {
      const person = document.createElement('canvas')
      person.width = width
      person.height = height
      const personContext = person.getContext('2d')
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = width
      maskCanvas.height = height
      const maskContext = maskCanvas.getContext('2d')
      if (!personContext || !maskContext) throw new Error('No se pudo preparar el recorte de la persona')

      personContext.filter = options.variant.effect === 'amber-tunnel' ? 'contrast(1.04) saturate(.96) sepia(.08)' : options.variant.effect === 'secret-signal' ? 'contrast(1.04) saturate(.84) hue-rotate(-5deg)' : 'contrast(1.04) saturate(.93)'
      const placement = drawCover(personContext, photoImage, photoImage.width, photoImage.height, width, height)
      personContext.filter = 'none'
      const maskImage = maskContext.createImageData(width, height)
      for (let y = 0; y < height; y += 1) {
        const sourceY = (y - placement.y) / placement.scale
        for (let x = 0; x < width; x += 1) {
          const sourceX = (x - placement.x) / placement.scale
          const outputIndex = (y * width + x) * 4
          maskImage.data[outputIndex] = 255
          maskImage.data[outputIndex + 1] = 255
          maskImage.data[outputIndex + 2] = 255
          if (sourceX < 0 || sourceX >= photoImage.width || sourceY < 0 || sourceY >= photoImage.height) continue
          const maskX = Math.min(options.mask.width - 1, Math.max(0, Math.floor(sourceX / photoImage.width * options.mask.width)))
          const maskY = Math.min(options.mask.height - 1, Math.max(0, Math.floor(sourceY / photoImage.height * options.mask.height)))
          const value = options.mask.values[maskY * options.mask.width + maskX]
          const opacity = Math.max(0, Math.min(1, (value - .12) / .78))
          maskImage.data[outputIndex + 3] = Math.round(opacity * 255)
        }
      }
      maskContext.putImageData(maskImage, 0, 0)
      personContext.globalCompositeOperation = 'destination-in'
      personContext.filter = 'blur(.7px)'
      personContext.drawImage(maskCanvas, 0, 0)
      personContext.filter = 'none'
      personContext.globalCompositeOperation = 'source-over'
      context.drawImage(person, 0, 0)
    } else {
      drawFallbackPhoto(context, photoImage, width, height)
    }

    drawForegroundEffects(context, options.variant.effect, width, height, options.variant.id)
    applyColorTreatment(context, options.variant.effect, width, height)
    drawStamp(context, width, height, options.variant, options.editionLabel, options.dateLabel)
    return await canvasToJpeg(output, .92)
  } finally {
    photoImage.close()
    backgroundImage.close()
  }
}
