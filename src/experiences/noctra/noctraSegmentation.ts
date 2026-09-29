export type NoctraSegmentationMask = { width: number; height: number; values: Float32Array }

type WorkerMessage = { id: string; result?: NoctraSegmentationMask; error?: string }

function validateMask(mask: NoctraSegmentationMask) {
  if (!Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1) return false
  if (mask.width > 4096 || mask.height > 4096 || mask.values.length !== mask.width * mask.height) return false
  for (let index = 0; index < mask.values.length; index += 1) {
    const value = mask.values[index]
    if (!Number.isFinite(value) || value < 0 || value > 1) return false
  }
  return true
}

function segmentInWorker(photo: Blob, modelPath: string, wasmPath: string, signal?: AbortSignal): Promise<NoctraSegmentationMask> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') {
      reject(new Error('La segmentación en otra tarea no está disponible'))
      return
    }
    if (signal?.aborted) {
      reject(new DOMException('La composición fue cancelada', 'AbortError'))
      return
    }

    const worker = new Worker(new URL('./noctraSegmentation.worker.ts', import.meta.url), { type: 'module', name: 'noctra-photo-segmentation' })
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onMessageError)
      worker.terminate()
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.id !== id) return
      if (event.data.result && validateMask(event.data.result)) {
        finish(() => resolve(event.data.result!))
      } else {
        finish(() => reject(new Error(event.data.error || 'La máscara de recorte no es válida')))
      }
    }
    const onError = () => finish(() => reject(new Error('La segmentación no pudo iniciarse en este dispositivo')))
    const onMessageError = () => finish(() => reject(new Error('La segmentación devolvió un resultado que no se pudo leer')))
    const onAbort = () => finish(() => reject(new DOMException('La composición fue cancelada', 'AbortError')))
    const timeout = window.setTimeout(() => finish(() => reject(new Error('La segmentación tardó demasiado; se usará una composición estática'))), 20000)

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onMessageError)
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      worker.postMessage({ id, photo, modelPath, wasmPath })
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error('No se pudo enviar la imagen al recortador')))
    }
  })
}

async function segmentOnMainThread(photo: Blob, modelPath: string, wasmPath: string, signal?: AbortSignal): Promise<NoctraSegmentationMask> {
  if (signal?.aborted) throw new DOMException('La composición fue cancelada', 'AbortError')
  if (typeof createImageBitmap === 'undefined') throw new Error('Este dispositivo no puede leer la fotografía')

  const operation = (async () => {
    const image = await createImageBitmap(photo, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(photo))
    let segmenter: import('@mediapipe/tasks-vision').ImageSegmenter | undefined
    let result: import('@mediapipe/tasks-vision').ImageSegmenterResult | undefined
    try {
      if (!image.width || !image.height) throw new Error('La imagen no tiene dimensiones válidas')
      if (signal?.aborted) throw new DOMException('La composición fue cancelada', 'AbortError')
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(wasmPath)
      const options = {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' as const },
        runningMode: 'IMAGE' as const,
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }
      try {
        segmenter = await ImageSegmenter.createFromOptions(vision, options)
      } catch {
        segmenter = await ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const } })
      }
      if (signal?.aborted) throw new DOMException('La composición fue cancelada', 'AbortError')
      result = segmenter.segment(image)
      const mask = result.confidenceMasks?.[0]
      if (!mask) throw new Error('No se generó la máscara de la persona')
      const normalizedMask = { width: mask.width, height: mask.height, values: mask.getAsFloat32Array().slice() }
      if (!validateMask(normalizedMask)) throw new Error('La máscara devuelta tiene dimensiones o valores no válidos')
      return normalizedMask
    } finally {
      result?.close()
      image.close()
      segmenter?.close()
    }
  })()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      callback()
    }
    const onAbort = () => finish(() => reject(new DOMException('La composición fue cancelada', 'AbortError')))
    const timeout = window.setTimeout(() => finish(() => reject(new Error('La segmentación tardó demasiado; se usará una composición estática'))), 20000)
    signal?.addEventListener('abort', onAbort, { once: true })
    operation.then((mask) => finish(() => resolve(mask)), (error: unknown) => finish(() => reject(error)))
  })
}

export async function segmentNoctraPhoto(photo: Blob, modelPath: string, wasmPath: string, signal?: AbortSignal): Promise<NoctraSegmentationMask> {
  try {
    const mask = await segmentInWorker(photo, modelPath, wasmPath, signal)
    return mask
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
    return segmentOnMainThread(photo, modelPath, wasmPath, signal)
  }
}
