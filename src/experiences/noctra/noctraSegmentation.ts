export type NoctraSegmentationMask = { width: number; height: number; values: Float32Array }

type WorkerMessage = { id: string; result?: NoctraSegmentationMask; error?: string }

export function segmentNoctraPhoto(photo: Blob, modelPath: string, wasmPath: string): Promise<NoctraSegmentationMask> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') {
      reject(new Error('La segmentación en otra tarea no está disponible'))
      return
    }

    const worker = new Worker(new URL('./noctraSegmentation.worker.ts', import.meta.url), { type: 'module', name: 'noctra-photo-segmentation' })
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const cleanup = () => worker.terminate()
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      if (event.data.id !== id) return
      cleanup()
      if (event.data.result) resolve(event.data.result)
      else reject(new Error(event.data.error || 'No se pudo recortar la persona'))
    })
    worker.addEventListener('error', () => {
      cleanup()
      reject(new Error('La segmentación no pudo iniciarse en este dispositivo'))
    }, { once: true })
    worker.postMessage({ id, photo, modelPath, wasmPath })
  })
}
