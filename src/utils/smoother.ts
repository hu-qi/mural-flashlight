export type Point = {
  x: number
  y: number
}

export class PointSmoother {
  private lastPoint: Point | null = null

  constructor(private readonly factor = 0.38) {}

  reset() {
    this.lastPoint = null
  }

  next(point: Point) {
    if (!this.lastPoint) {
      this.lastPoint = point
      return point
    }

    this.lastPoint = {
      x: this.lastPoint.x + (point.x - this.lastPoint.x) * this.factor,
      y: this.lastPoint.y + (point.y - this.lastPoint.y) * this.factor,
    }

    return this.lastPoint
  }
}
