import type { TrackingPoint } from '../types'
import type { MuralRenderer } from './MuralRenderer'

type ImagePlacement = {
  dx: number
  dy: number
  dw: number
  dh: number
}

type RuntimeRenderer = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  layersDirty: boolean
  importedColorImage: HTMLImageElement | null
  setTrackingPoint: (point: TrackingPoint) => void
  render: () => void
  drawPaperTexture: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  drawImportedMonoLayer: (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) => void
  drawImportedColorLayer: (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) => void
}

type ViewportState = {
  x: number
  y: number
  lastPoint: TrackingPoint | null
}

const EDGE_ZONE_RATIO = 0.16
const MAX_EDGE_ZONE = 180
const PAN_SPEED = 0.006

export function installImportedMuralView(renderer: MuralRenderer) {
  const runtime = renderer as unknown as RuntimeRenderer
  const state: ViewportState = {
    x: 0.5,
    y: 0.5,
    lastPoint: null,
  }

  const originalSetTrackingPoint = runtime.setTrackingPoint.bind(renderer)
  const originalRender = runtime.render.bind(renderer)

  runtime.setTrackingPoint = (point: TrackingPoint) => {
    state.lastPoint = point
    originalSetTrackingPoint(point)
  }

  runtime.render = () => {
    updateAutoPan(runtime, state)
    originalRender()
    drawMiniMap(runtime, state)
  }

  runtime.drawImportedMonoLayer = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) => {
    drawImportedMonoLayer(runtime, state, ctx, image, width, height)
  }

  runtime.drawImportedColorLayer = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) => {
    drawImportedColorLayer(state, ctx, image, width, height)
  }

  return {
    hasImportedImage() {
      return Boolean(runtime.importedColorImage)
    },
  }
}

function updateAutoPan(runtime: RuntimeRenderer, state: ViewportState) {
  if (!runtime.importedColorImage || !state.lastPoint?.active) return

  const width = runtime.canvas.clientWidth
  const height = runtime.canvas.clientHeight
  const edgeX = Math.min(MAX_EDGE_ZONE, width * EDGE_ZONE_RATIO)
  const edgeY = Math.min(MAX_EDGE_ZONE, height * EDGE_ZONE_RATIO)
  const point = state.lastPoint
  let nextX = state.x
  let nextY = state.y

  if (point.x < edgeX) {
    nextX -= ((edgeX - point.x) / edgeX) * PAN_SPEED
  } else if (point.x > width - edgeX) {
    nextX += ((point.x - (width - edgeX)) / edgeX) * PAN_SPEED
  }

  if (point.y < edgeY) {
    nextY -= ((edgeY - point.y) / edgeY) * PAN_SPEED
  } else if (point.y > height - edgeY) {
    nextY += ((point.y - (height - edgeY)) / edgeY) * PAN_SPEED
  }

  nextX = clamp01(nextX)
  nextY = clamp01(nextY)

  if (Math.abs(nextX - state.x) > 0.0001 || Math.abs(nextY - state.y) > 0.0001) {
    state.x = nextX
    state.y = nextY
    runtime.layersDirty = true
  }
}

function drawImportedColorLayer(
  state: ViewportState,
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const placement = getPanPlacement(image, width, height, state)
  drawImportedBackdrop(ctx, width, height)
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, placement.dx, placement.dy, placement.dw, placement.dh)
}

function drawImportedMonoLayer(
  runtime: RuntimeRenderer,
  state: ViewportState,
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const placement = getPanPlacement(image, width, height, state)
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.max(1, Math.round(width))
  tempCanvas.height = Math.max(1, Math.round(height))

  const tempContext = tempCanvas.getContext('2d')
  if (!tempContext) return

  drawImportedBackdrop(tempContext, tempCanvas.width, tempCanvas.height)
  tempContext.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    placement.dx,
    placement.dy,
    placement.dw,
    placement.dh,
  )

  const source = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const sourceData = source.data
  const widthPx = tempCanvas.width
  const heightPx = tempCanvas.height
  const gray = new Float32Array(widthPx * heightPx)

  for (let i = 0, pixel = 0; i < sourceData.length; i += 4, pixel += 1) {
    gray[pixel] = sourceData[i] * 0.299 + sourceData[i + 1] * 0.587 + sourceData[i + 2] * 0.114
  }

  const output = tempContext.createImageData(widthPx, heightPx)
  const outputData = output.data

  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      const index = y * widthPx + x
      const pixel = index * 4
      const current = gray[index]
      const left = gray[y * widthPx + Math.max(0, x - 1)]
      const right = gray[y * widthPx + Math.min(widthPx - 1, x + 1)]
      const top = gray[Math.max(0, y - 1) * widthPx + x]
      const bottom = gray[Math.min(heightPx - 1, y + 1) * widthPx + x]
      const edge = Math.min(255, Math.hypot(right - left, bottom - top) * 2.4)
      const shade = 236 - (255 - current) * 0.16
      const ink = Math.max(22, shade - edge * 1.25)

      outputData[pixel] = ink
      outputData[pixel + 1] = ink * 0.98
      outputData[pixel + 2] = ink * 0.9
      outputData[pixel + 3] = 255
    }
  }

  tempContext.putImageData(output, 0, 0)
  tempContext.globalCompositeOperation = 'multiply'
  tempContext.fillStyle = 'rgba(78, 58, 38, 0.12)'
  tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
  tempContext.globalCompositeOperation = 'source-over'

  drawImportedBackdrop(ctx, width, height)
  ctx.drawImage(tempCanvas, 0, 0, width, height)
  runtime.drawPaperTexture(ctx, width, height)
}

function drawImportedBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const paper = ctx.createLinearGradient(0, 0, 0, height)
  paper.addColorStop(0, '#f1eadc')
  paper.addColorStop(0.5, '#e2d6c1')
  paper.addColorStop(1, '#cfc0a6')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
}

function getPanPlacement(image: HTMLImageElement, width: number, height: number, state: ViewportState): ImagePlacement {
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = width / height

  if (imageRatio >= canvasRatio) {
    const dh = height
    const dw = height * imageRatio
    const overflow = Math.max(0, dw - width)

    return {
      dx: -overflow * state.x,
      dy: 0,
      dw,
      dh,
    }
  }

  const dw = width
  const dh = width / imageRatio
  const overflow = Math.max(0, dh - height)

  return {
    dx: 0,
    dy: -overflow * state.y,
    dw,
    dh,
  }
}

function drawMiniMap(runtime: RuntimeRenderer, state: ViewportState) {
  const image = runtime.importedColorImage
  if (!image) return

  const ctx = runtime.context
  const canvasWidth = runtime.canvas.clientWidth
  const canvasHeight = runtime.canvas.clientHeight
  const padding = 18
  const maxWidth = Math.min(300, canvasWidth * 0.3)
  const maxHeight = 120
  const imageRatio = image.naturalWidth / image.naturalHeight
  let previewWidth = maxWidth
  let previewHeight = previewWidth / imageRatio

  if (previewHeight > maxHeight) {
    previewHeight = maxHeight
    previewWidth = previewHeight * imageRatio
  }

  previewWidth = Math.max(120, previewWidth)
  previewHeight = Math.max(32, previewHeight)

  const x = padding
  const y = canvasHeight - previewHeight - padding
  const placement = getPanPlacement(image, canvasWidth, canvasHeight, state)
  const visibleWidthRatio = Math.min(1, canvasWidth / placement.dw)
  const visibleHeightRatio = Math.min(1, canvasHeight / placement.dh)
  const visibleXRatio = placement.dw <= canvasWidth ? 0 : -placement.dx / placement.dw
  const visibleYRatio = placement.dh <= canvasHeight ? 0 : -placement.dy / placement.dh

  ctx.save()
  ctx.globalAlpha = 0.92
  ctx.fillStyle = 'rgba(16, 13, 10, 0.68)'
  ctx.strokeStyle = 'rgba(255, 234, 193, 0.3)'
  ctx.lineWidth = 1
  roundRect(ctx, x - 8, y - 8, previewWidth + 16, previewHeight + 16, 14)
  ctx.fill()
  ctx.stroke()

  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, x, y, previewWidth, previewHeight)

  ctx.strokeStyle = 'rgba(255, 218, 130, 0.98)'
  ctx.lineWidth = 2
  ctx.strokeRect(
    x + visibleXRatio * previewWidth,
    y + visibleYRatio * previewHeight,
    visibleWidthRatio * previewWidth,
    visibleHeightRatio * previewHeight,
  )
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}
