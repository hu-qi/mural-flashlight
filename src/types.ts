export type TrackingSource = 'pointer' | 'mediapipe-hand' | 'apriltag'

export type TrackingPoint = {
  x: number
  y: number
  confidence: number
  active: boolean
  source: TrackingSource
  label?: string
}

export type LightState = {
  x: number
  y: number
  targetX: number
  targetY: number
  radius: number
  feather: number
  intensity: number
  visible: number
  targetVisible: number
}

export type LightConfig = {
  radius: number
  feather: number
  intensity: number
}

export type TrackingPointCallback = (point: TrackingPoint) => void
export type StatusCallback = (message: string) => void

export interface TrackingInput {
  start(): Promise<void> | void
  stop(): void
  onPoint(callback: TrackingPointCallback): void
  onStatus(callback: StatusCallback): void
}
