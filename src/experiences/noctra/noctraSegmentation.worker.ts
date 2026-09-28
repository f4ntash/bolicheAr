type SegmentRequest = { id: string; photo: Blob; modelPath: string; wasmPath: string }
type WorkerScope = {
  onmessage: ((event: MessageEvent<SegmentRequest>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = async (event) => {
  const { id, photo, modelPath, wasmPath } = event.data
  let segmenter: import('@mediapipe/tasks-vision').ImageSegmenter | undefined
  let image: ImageBitmap | undefined
  let result: import('@mediapipe/tasks-vision').ImageSegmenterResult | undefined
  try {
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
    image = await createImageBitmap(photo)
    result = segmenter.segment(image)
    const mask = result.confidenceMasks?.[0]
    if (!mask) throw new Error('No se generó la máscara de la persona')
    const values = mask.getAsFloat32Array()
    const response = { id, result: { width: mask.width, height: mask.height, values } }
    workerScope.postMessage(response, [values.buffer])
  } catch (error) {
    workerScope.postMessage({ id, error: error instanceof Error ? error.message : 'No se pudo procesar la imagen' })
  } finally {
    result?.close()
    image?.close()
    segmenter?.close()
  }
}
