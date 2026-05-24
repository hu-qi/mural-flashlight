export class CanvasMapper {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  pointerEventToCanvas(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  normalizedCameraPointToCanvas(point: { x: number; y: number }, options: { mirrorX?: boolean } = {}) {
    const x = options.mirrorX ? 1 - point.x : point.x

    return {
      x: x * this.canvas.clientWidth,
      y: point.y * this.canvas.clientHeight,
    }
  }
}
