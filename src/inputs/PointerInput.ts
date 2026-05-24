import type { TrackingInput, TrackingPointCallback, StatusCallback } from '../types'
import { CanvasMapper } from '../mapping/CanvasMapper'

export class PointerInput implements TrackingInput {
  private pointCallback: TrackingPointCallback = () => undefined
  private statusCallback: StatusCallback = () => undefined
  private enabled = false

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly mapper: CanvasMapper,
  ) {}

  async start() {
    if (this.enabled) return
    this.enabled = true
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.addEventListener('pointerenter', this.handlePointerEnter)
    this.statusCallback('Pointer mode')
  }

  stop() {
    if (!this.enabled) return
    this.enabled = false
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.removeEventListener('pointerenter', this.handlePointerEnter)
  }

  onPoint(callback: TrackingPointCallback) {
    this.pointCallback = callback
  }

  onStatus(callback: StatusCallback) {
    this.statusCallback = callback
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.emitPointerPoint(event, true)
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId)
    this.emitPointerPoint(event, true)
  }

  private readonly handlePointerLeave = () => {
    this.pointCallback({
      x: 0,
      y: 0,
      confidence: 0,
      active: false,
      source: 'pointer',
      label: 'pointer left canvas',
    })
  }

  private readonly handlePointerEnter = (event: PointerEvent) => {
    this.emitPointerPoint(event, true)
  }

  private emitPointerPoint(event: PointerEvent, active: boolean) {
    const point = this.mapper.pointerEventToCanvas(event)
    const inputLabel = event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse'

    this.pointCallback({
      x: point.x,
      y: point.y,
      confidence: 1,
      active,
      source: 'pointer',
      label: `${inputLabel} flashlight`,
    })
  }
}
