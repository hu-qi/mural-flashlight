import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { CanvasMapper } from '../mapping/CanvasMapper'
import type { StatusCallback, TrackingInput, TrackingPointCallback } from '../types'
import { PointSmoother } from '../utils/smoother'

const HAND_WASM_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  'https://unpkg.com/@mediapipe/tasks-vision@latest/wasm',
]
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export class MediaPipeHandInput implements TrackingInput {
  private pointCallback: TrackingPointCallback = () => undefined
  private statusCallback: StatusCallback = () => undefined
  private handLandmarker: HandLandmarker | null = null
  private cameraStream: MediaStream | null = null
  private animationId = 0
  private enabled = false
  private starting = false
  private lastVideoTime = -1
  private lastHandSeenAt = 0
  private readonly smoother = new PointSmoother(0.38)

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly mapper: CanvasMapper,
  ) {}

  async start() {
    if (this.starting || this.enabled) return

    this.starting = true
    this.statusCallback('Loading MediaPipe...')

    try {
      if (!this.handLandmarker) {
        this.handLandmarker = await this.createHandLandmarker()
      }

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      this.video.srcObject = this.cameraStream
      await this.video.play()

      this.enabled = true
      this.lastVideoTime = -1
      this.lastHandSeenAt = performance.now()
      this.smoother.reset()
      this.video.classList.add('is-active')
      this.statusCallback('Show your index finger')
      this.runLoop()
    } catch (error) {
      console.error(error)
      this.statusCallback('Camera or MediaPipe failed; pointer mode active')
      this.stop()
    } finally {
      this.starting = false
    }
  }

  stop() {
    this.enabled = false
    this.smoother.reset()

    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = 0
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop())
      this.cameraStream = null
    }

    this.video.classList.remove('is-active')
    this.video.srcObject = null
    this.pointCallback({
      x: 0,
      y: 0,
      confidence: 0,
      active: false,
      source: 'mediapipe-hand',
      label: 'hand tracking stopped',
    })
  }

  onPoint(callback: TrackingPointCallback) {
    this.pointCallback = callback
  }

  onStatus(callback: StatusCallback) {
    this.statusCallback = callback
  }

  private async createHandLandmarker() {
    let lastError: unknown = null

    for (const wasmUrl of HAND_WASM_URLS) {
      try {
        this.statusCallback(`Loading MediaPipe wasm from ${new URL(wasmUrl).hostname}...`)
        const vision = await FilesetResolver.forVisionTasks(wasmUrl)

        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        })
      } catch (error) {
        console.warn(`MediaPipe wasm load failed from ${wasmUrl}`, error)
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unable to load MediaPipe wasm assets')
  }

  private runLoop() {
    if (!this.enabled || !this.handLandmarker) return

    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime
      const result = this.handLandmarker.detectForVideo(this.video, performance.now())
      this.updateHandPoint(result)
    }

    if (performance.now() - this.lastHandSeenAt > 700) {
      this.statusCallback('Hand not found')
      this.pointCallback({
        x: 0,
        y: 0,
        confidence: 0,
        active: false,
        source: 'mediapipe-hand',
        label: 'hand not found',
      })
    }

    this.animationId = requestAnimationFrame(() => this.runLoop())
  }

  private updateHandPoint(result: HandLandmarkerResult) {
    const landmarks = result.landmarks[0]
    if (!landmarks) return

    const indexTip = landmarks[8]
    if (!indexTip) return

    const point = this.mapIndexTip(indexTip)
    const stabilizedPoint = this.smoother.next(point)

    this.lastHandSeenAt = performance.now()
    this.pointCallback({
      x: stabilizedPoint.x,
      y: stabilizedPoint.y,
      confidence: 1,
      active: true,
      source: 'mediapipe-hand',
      label: 'hand index fingertip',
    })
    this.statusCallback(`Hand tracking: index fingertip ${Math.round(stabilizedPoint.x)}, ${Math.round(stabilizedPoint.y)}`)
  }

  private mapIndexTip(landmark: NormalizedLandmark) {
    return this.mapper.normalizedCameraPointToCanvas(landmark, { mirrorX: true })
  }
}
