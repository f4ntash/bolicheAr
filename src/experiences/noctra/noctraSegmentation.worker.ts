import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

type SegmentRequest = { id: string; photo: Blob; modelPath: string; wasmPath: string }
type WorkerScope = {
  onmessage: ((event: MessageEvent<SegmentRequest>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const workerScope = self as unknown as WorkerScope

async function decodePhoto(photo: Blob) {
  try {
    return await createImageBitmap(photo, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(photo)
  }
}

workerScope.onmessage = async (event) => {
  const { id, photo, modelPath, wasmPath } = event.data
  let segmenter: ImageSegmenter | undefined
  let image: ImageBitmap | undefined
  let result: ReturnType<ImageSegmenter['segment']> | undefined
  let stage = 'cargar runtime de segmentación'
  try {
    stage = 'cargar runtime WebAssembly'
    const vision = await FilesetResolver.forVisionTasks(wasmPath)
    const options = {
      baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' as const },
      runningMode: 'IMAGE' as const,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    }
    try {
      stage = 'crear segmentador GPU'
      segmenter = await ImageSegmenter.createFromOptions(vision, options)
    } catch {
      stage = 'crear segmentador CPU'
      segmenter = await ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const } })
    }
    stage = 'decodificar fotografía'
    image = await decodePhoto(photo)
    if (!image.width || !image.height) throw new Error('La imagen no tiene dimensiones válidas')
    stage = 'generar máscara'
    result = segmenter.segment(image)
    const mask = result.confidenceMasks?.[0]
    if (!mask) throw new Error('No se generó la máscara de la persona')
    const values = mask.getAsFloat32Array()
    if (!Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1 || values.length !== mask.width * mask.height) {
      throw new Error('La máscara devuelta tiene dimensiones incompatibles')
    }
    for (let index = 0; index < values.length; index += 1) {
      if (!Number.isFinite(values[index]) || values[index] < 0 || values[index] > 1) throw new Error('La máscara devuelta contiene valores no válidos')
    }
    const response = { id, result: { width: mask.width, height: mask.height, values } }
    workerScope.postMessage(response, [values.buffer])
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo procesar la imagen'
    workerScope.postMessage({ id, error: `${stage}: ${detail}` })
  } finally {
    result?.close()
    image?.close()
    segmenter?.close()
  }
}
