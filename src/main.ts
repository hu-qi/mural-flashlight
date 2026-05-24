import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import './styles.css'

type LightState = {
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

type InputSource = 'mouse' | 'touch' | 'pen' | 'hand'

type Building = {
  x: number
  y: number
  width: number
  floors: number
  scale: number
}

const HAND_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root element')
}

app.innerHTML = `
  <main class="stage-shell">
    <video id="camera-video" class="camera-video" autoplay playsinline muted></video>
    <canvas id="mural-canvas" aria-label="Interactive mural flashlight demo"></canvas>

    <section class="hud" aria-label="Controls">
      <div>
        <p class="eyebrow">Step 2 / MediaPipe Hands</p>
        <h1>Mural Flashlight</h1>
        <p class="hint">Move the pointer, or start hand tracking and use your index fingertip to drive the flashlight.</p>
      </div>

      <div class="mode-row">
        <button id="hand-toggle" type="button">Start hand tracking</button>
        <span id="tracking-status">Pointer mode</span>
      </div>

      <label>
        <span>Radius</span>
        <input id="radius" type="range" min="80" max="320" value="185" />
      </label>

      <label>
        <span>Feather</span>
        <input id="feather" type="range" min="25" max="190" value="95" />
      </label>

      <label>
        <span>Glow</span>
        <input id="intensity" type="range" min="0" max="100" value="90" />
      </label>
    </section>
  </main>
`

const canvas = document.querySelector<HTMLCanvasElement>('#mural-canvas')
const video = document.querySelector<HTMLVideoElement>('#camera-video')
const radiusInput = document.querySelector<HTMLInputElement>('#radius')
const featherInput = document.querySelector<HTMLInputElement>('#feather')
const intensityInput = document.querySelector<HTMLInputElement>('#intensity')
const handToggle = document.querySelector<HTMLButtonElement>('#hand-toggle')
const trackingStatus = document.querySelector<HTMLSpanElement>('#tracking-status')

if (!canvas || !video || !radiusInput || !featherInput || !intensityInput || !handToggle || !trackingStatus) {
  throw new Error('Missing required UI elements')
}

const context = canvas.getContext('2d', { alpha: false })

if (!context) {
  throw new Error('Canvas 2D context is not available')
}

const monoLayer = document.createElement('canvas')
const colorLayer = document.createElement('canvas')
const revealLayer = document.createElement('canvas')
const monoContext = monoLayer.getContext('2d')
const colorContext = colorLayer.getContext('2d')
const revealContext = revealLayer.getContext('2d')

if (!monoContext || !colorContext || !revealContext) {
  throw new Error('Offscreen Canvas 2D context is not available')
}

const light: LightState = {
  x: window.innerWidth * 0.48,
  y: window.innerHeight * 0.56,
  targetX: window.innerWidth * 0.48,
  targetY: window.innerHeight * 0.56,
  radius: Number(radiusInput.value),
  feather: Number(featherInput.value),
  intensity: Number(intensityInput.value) / 100,
  visible: 1,
  targetVisible: 1,
}

const buildings: Building[] = [
  { x: 0.08, y: 0.5, width: 0.12, floors: 2, scale: 1.12 },
  { x: 0.22, y: 0.42, width: 0.16, floors: 3, scale: 1.2 },
  { x: 0.43, y: 0.39, width: 0.18, floors: 3, scale: 1.28 },
  { x: 0.68, y: 0.46, width: 0.14, floors: 2, scale: 1.05 },
  { x: 0.86, y: 0.5, width: 0.12, floors: 3, scale: 1.1 },
  { x: 0.14, y: 0.76, width: 0.11, floors: 2, scale: 0.92 },
  { x: 0.74, y: 0.76, width: 0.13, floors: 2, scale: 0.95 },
]

let lastInputSource: InputSource = 'mouse'
let frame = 0
let layersDirty = true
let handLandmarker: HandLandmarker | null = null
let cameraStream: MediaStream | null = null
let handTrackingEnabled = false
let handTrackingStarting = false
let lastVideoTime = -1
let handAnimationId = 0
let lastHandPoint: { x: number; y: number } | null = null
let lastHandSeenAt = 0

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight

  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  for (const layer of [monoLayer, colorLayer, revealLayer]) {
    layer.width = Math.round(width * ratio)
    layer.height = Math.round(height * ratio)
  }

  for (const ctx of [monoContext, colorContext, revealContext]) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  layersDirty = true
}

function getCanvasPoint(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function updatePointer(event: PointerEvent) {
  if (handTrackingEnabled) return

  const point = getCanvasPoint(event)
  lastInputSource = event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse'
  light.targetX = point.x
  light.targetY = point.y
  light.targetVisible = 1
}

async function toggleHandTracking() {
  if (handTrackingEnabled) {
    stopHandTracking()
    return
  }

  await startHandTracking()
}

async function startHandTracking() {
  if (handTrackingStarting || handTrackingEnabled) return

  handTrackingStarting = true
  handToggle.disabled = true
  trackingStatus.textContent = 'Loading MediaPipe...'

  try {
    if (!handLandmarker) {
      const vision = await FilesetResolver.forVisionTasks(HAND_WASM_URL)
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
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
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })

    video.srcObject = cameraStream
    await video.play()

    handTrackingEnabled = true
    lastInputSource = 'hand'
    handToggle.textContent = 'Stop hand tracking'
    trackingStatus.textContent = 'Show your index finger'
    video.classList.add('is-active')
    runHandTrackingLoop()
  } catch (error) {
    console.error(error)
    trackingStatus.textContent = 'Camera or MediaPipe failed; pointer mode active'
    stopHandTracking()
  } finally {
    handTrackingStarting = false
    handToggle.disabled = false
  }
}

function stopHandTracking() {
  handTrackingEnabled = false
  handToggle.textContent = 'Start hand tracking'
  trackingStatus.textContent = 'Pointer mode'
  video.classList.remove('is-active')
  lastHandPoint = null

  if (handAnimationId) {
    cancelAnimationFrame(handAnimationId)
    handAnimationId = 0
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop())
    cameraStream = null
  }

  video.srcObject = null
  light.targetVisible = 1
}

function runHandTrackingLoop() {
  if (!handTrackingEnabled || !handLandmarker) return

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime
    const result = handLandmarker.detectForVideo(video, performance.now())
    updateHandPoint(result)
  }

  if (performance.now() - lastHandSeenAt > 700) {
    trackingStatus.textContent = 'Hand not found'
    light.targetVisible = 0.2
    lastHandPoint = null
  }

  handAnimationId = requestAnimationFrame(runHandTrackingLoop)
}

function updateHandPoint(result: HandLandmarkerResult) {
  const landmarks = result.landmarks[0]

  if (!landmarks) return

  const indexTip = landmarks[8]

  if (!indexTip) return

  const point = mapHandLandmarkToCanvas(indexTip)
  const stabilizedPoint = stabilizeHandPoint(point)

  lastInputSource = 'hand'
  lastHandSeenAt = performance.now()
  light.targetX = stabilizedPoint.x
  light.targetY = stabilizedPoint.y
  light.targetVisible = 1
  trackingStatus.textContent = `Hand tracking: index fingertip ${Math.round(stabilizedPoint.x)}, ${Math.round(stabilizedPoint.y)}`
}

function mapHandLandmarkToCanvas(landmark: NormalizedLandmark) {
  return {
    x: (1 - landmark.x) * canvas.clientWidth,
    y: landmark.y * canvas.clientHeight,
  }
}

function stabilizeHandPoint(point: { x: number; y: number }) {
  if (!lastHandPoint) {
    lastHandPoint = point
    return point
  }

  lastHandPoint = {
    x: lastHandPoint.x + (point.x - lastHandPoint.x) * 0.38,
    y: lastHandPoint.y + (point.y - lastHandPoint.y) * 0.38,
  }

  return lastHandPoint
}

function rebuildLayers(width: number, height: number) {
  monoContext.clearRect(0, 0, width, height)
  colorContext.clearRect(0, 0, width, height)

  drawMonochromeMural(monoContext, width, height)
  drawColorMural(colorContext, width, height)
  layersDirty = false
}

function drawMonochromeMural(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const paper = ctx.createLinearGradient(0, 0, 0, height)
  paper.addColorStop(0, '#f8f6ef')
  paper.addColorStop(0.58, '#e8e2d6')
  paper.addColorStop(1, '#d3cbba')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)

  drawDistantRoofs(ctx, width, height, false)
  drawRiver(ctx, width, height, false)
  buildings.forEach((building, index) => drawPagoda(ctx, width, height, building, false, index))
  drawBridge(ctx, width, height, false)
  drawPeopleAndLanterns(ctx, width, height, false)
  drawInkTexture(ctx, width, height)
}

function drawColorMural(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const colorWash = ctx.createLinearGradient(0, 0, 0, height)
  colorWash.addColorStop(0, '#e4d5ba')
  colorWash.addColorStop(0.45, '#be7542')
  colorWash.addColorStop(0.72, '#205d67')
  colorWash.addColorStop(1, '#0a2638')
  ctx.fillStyle = colorWash
  ctx.fillRect(0, 0, width, height)

  const warmCore = ctx.createRadialGradient(width * 0.48, height * 0.56, 0, width * 0.48, height * 0.56, width * 0.3)
  warmCore.addColorStop(0, 'rgba(255, 221, 119, 0.95)')
  warmCore.addColorStop(0.4, 'rgba(246, 105, 37, 0.7)')
  warmCore.addColorStop(1, 'rgba(246, 105, 37, 0)')
  ctx.fillStyle = warmCore
  ctx.fillRect(0, 0, width, height)

  drawDistantRoofs(ctx, width, height, true)
  drawRiver(ctx, width, height, true)
  buildings.forEach((building, index) => drawPagoda(ctx, width, height, building, true, index))
  drawBridge(ctx, width, height, true)
  drawPeopleAndLanterns(ctx, width, height, true)
  drawColoredHighlights(ctx, width, height)
}

function drawDistantRoofs(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.save()
  ctx.strokeStyle = colorMode ? 'rgba(64, 34, 24, 0.55)' : 'rgba(24, 23, 21, 0.34)'
  ctx.fillStyle = colorMode ? 'rgba(115, 61, 41, 0.38)' : 'rgba(24, 23, 21, 0.06)'
  ctx.lineWidth = 1.4

  for (let i = 0; i < 18; i += 1) {
    const x = (i / 17) * width
    const y = height * (0.2 + 0.12 * Math.sin(i * 0.8))
    const roofWidth = width * (0.055 + (i % 3) * 0.008)
    const roofHeight = height * (0.06 + (i % 4) * 0.01)
    drawCurvedRoof(ctx, x - roofWidth / 2, y, roofWidth, roofHeight, colorMode)
    ctx.strokeRect(x - roofWidth * 0.34, y + roofHeight * 0.18, roofWidth * 0.68, roofHeight * 0.72)
  }

  ctx.restore()
}

function drawRiver(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(width * 0.02, height * 0.83)
  ctx.bezierCurveTo(width * 0.24, height * 0.65, width * 0.38, height * 0.78, width * 0.53, height * 0.62)
  ctx.bezierCurveTo(width * 0.66, height * 0.48, width * 0.78, height * 0.48, width * 0.98, height * 0.3)
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()

  if (colorMode) {
    const water = ctx.createLinearGradient(width * 0.1, height * 0.58, width * 0.8, height * 0.9)
    water.addColorStop(0, 'rgba(36, 92, 92, 0.82)')
    water.addColorStop(0.55, 'rgba(18, 184, 174, 0.95)')
    water.addColorStop(1, 'rgba(5, 32, 54, 0.96)')
    ctx.fillStyle = water
    ctx.fill()
  } else {
    ctx.strokeStyle = 'rgba(22, 22, 20, 0.52)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.strokeStyle = colorMode ? 'rgba(181, 255, 241, 0.62)' : 'rgba(22, 22, 20, 0.28)'
  ctx.lineWidth = colorMode ? 2.4 : 1.1
  for (let i = 0; i < 22; i += 1) {
    const y = height * (0.62 + i * 0.018)
    ctx.beginPath()
    for (let x = width * 0.05; x < width * 0.93; x += 24) {
      const wave = Math.sin(x * 0.02 + i * 0.9) * 4
      if (x === width * 0.05) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }

  ctx.restore()
}

function drawPagoda(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  building: Building,
  colorMode: boolean,
  index: number,
) {
  const x = canvasWidth * building.x
  const baseY = canvasHeight * building.y
  const width = canvasWidth * building.width
  const floorHeight = canvasHeight * 0.045 * building.scale

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = colorMode ? 'rgba(55, 26, 18, 0.92)' : 'rgba(18, 18, 16, 0.82)'
  ctx.lineWidth = colorMode ? 2.6 : 1.8

  for (let floor = 0; floor < building.floors; floor += 1) {
    const floorWidth = width * (1 - floor * 0.13)
    const floorX = x + (width - floorWidth) / 2
    const y = baseY - floor * floorHeight
    const bodyHeight = floorHeight * 0.66

    ctx.fillStyle = colorMode
      ? index % 2 === 0
        ? 'rgba(142, 72, 39, 0.9)'
        : 'rgba(103, 54, 38, 0.86)'
      : 'rgba(20, 20, 18, 0.035)'
    ctx.fillRect(floorX + floorWidth * 0.12, y - bodyHeight, floorWidth * 0.76, bodyHeight)
    ctx.strokeRect(floorX + floorWidth * 0.12, y - bodyHeight, floorWidth * 0.76, bodyHeight)
    drawCurvedRoof(ctx, floorX, y - bodyHeight, floorWidth, floorHeight, colorMode)

    for (let column = 0; column < 4; column += 1) {
      const windowX = floorX + floorWidth * (0.24 + column * 0.15)
      const windowY = y - bodyHeight * 0.64
      ctx.fillStyle = colorMode ? 'rgba(255, 205, 93, 0.95)' : 'rgba(35, 34, 31, 0.18)'
      ctx.fillRect(windowX, windowY, floorWidth * 0.055, bodyHeight * 0.42)
    }
  }

  ctx.restore()
}

function drawCurvedRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colorMode: boolean,
) {
  ctx.save()
  ctx.fillStyle = colorMode ? 'rgba(164, 81, 42, 0.94)' : 'rgba(24, 23, 21, 0.08)'
  ctx.beginPath()
  ctx.moveTo(x - width * 0.1, y + height * 0.2)
  ctx.quadraticCurveTo(x + width * 0.5, y - height * 0.48, x + width * 1.1, y + height * 0.2)
  ctx.quadraticCurveTo(x + width * 0.83, y + height * 0.36, x + width * 0.5, y + height * 0.32)
  ctx.quadraticCurveTo(x + width * 0.17, y + height * 0.36, x - width * 0.1, y + height * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawBridge(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const startX = width * 0.36
  const endX = width * 0.66
  const baseY = height * 0.66

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = colorMode ? 'rgba(190, 103, 58, 0.96)' : 'rgba(20, 20, 18, 0.78)'
  ctx.lineWidth = colorMode ? 10 : 5
  ctx.beginPath()
  ctx.moveTo(startX, baseY)
  ctx.quadraticCurveTo(width * 0.51, height * 0.49, endX, baseY)
  ctx.stroke()

  ctx.lineWidth = colorMode ? 4 : 2
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12
    const x = startX + (endX - startX) * t
    const y = baseY - Math.sin(t * Math.PI) * height * 0.14
    ctx.beginPath()
    ctx.moveTo(x, y - 8)
    ctx.lineTo(x, y + 30)
    ctx.stroke()
  }

  ctx.strokeStyle = colorMode ? 'rgba(255, 218, 130, 0.98)' : 'rgba(20, 20, 18, 0.44)'
  ctx.lineWidth = colorMode ? 3 : 1.6
  ctx.beginPath()
  ctx.moveTo(startX - 12, baseY - 25)
  ctx.quadraticCurveTo(width * 0.51, height * 0.47, endX + 12, baseY - 25)
  ctx.stroke()
  ctx.restore()
}

function drawPeopleAndLanterns(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.save()
  ctx.strokeStyle = colorMode ? 'rgba(64, 32, 22, 0.9)' : 'rgba(18, 18, 16, 0.64)'
  ctx.fillStyle = colorMode ? 'rgba(72, 39, 26, 0.88)' : 'rgba(18, 18, 16, 0.55)'
  ctx.lineWidth = 1.4

  for (let i = 0; i < 48; i += 1) {
    const x = width * (0.18 + ((i * 37) % 66) / 100)
    const y = height * (0.54 + ((i * 23) % 29) / 100)
    const size = 4 + (i % 4)
    ctx.beginPath()
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y + size * 0.45)
    ctx.lineTo(x - size * 0.45, y + size * 2)
    ctx.lineTo(x + size * 0.45, y + size * 2)
    ctx.stroke()
  }

  for (let i = 0; i < 22; i += 1) {
    const x = width * (0.08 + ((i * 29) % 84) / 100)
    const y = height * (0.33 + ((i * 17) % 43) / 100)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 24)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y - 7, 7, 0, Math.PI * 2)
    if (colorMode) {
      ctx.fillStyle = 'rgba(255, 171, 51, 0.96)'
      ctx.fill()
    }
    ctx.stroke()
  }

  ctx.restore()
}

function drawColoredHighlights(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < 30; i += 1) {
    const x = width * (0.38 + ((i * 17) % 27) / 100)
    const y = height * (0.46 + ((i * 11) % 22) / 100)
    const radius = 18 + (i % 5) * 6
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, 'rgba(255, 235, 126, 0.98)')
    glow.addColorStop(0.45, 'rgba(255, 123, 39, 0.46)')
    glow.addColorStop(1, 'rgba(255, 123, 39, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const teal = ctx.createRadialGradient(width * 0.58, height * 0.68, 0, width * 0.58, height * 0.68, width * 0.18)
  teal.addColorStop(0, 'rgba(87, 255, 230, 0.85)')
  teal.addColorStop(1, 'rgba(87, 255, 230, 0)')
  ctx.fillStyle = teal
  ctx.fillRect(0, 0, width, height)

  ctx.restore()
}

function drawInkTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(12, 12, 11, 0.55)'
  ctx.lineWidth = 1.05

  for (let i = 0; i < 135; i += 1) {
    const x = ((i * 89) % width) + Math.sin(i) * 12
    const y = ((i * 47) % height) + Math.cos(i * 1.4) * 8
    const length = 16 + ((i * 17) % 74)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + length * 0.4, y + Math.sin(i) * 18, x + length, y + Math.cos(i) * 10)
    ctx.stroke()
  }

  ctx.restore()
}

function drawRevealMask(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const alpha = Math.min(1, Math.max(0, light.visible))
  const radius = light.radius
  const feather = light.feather
  const flicker = Math.sin(frame * 0.055) * 5

  const core = ctx.createRadialGradient(light.x, light.y, Math.max(1, radius - feather), light.x, light.y, radius + flicker)
  core.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  core.addColorStop(0.46, `rgba(255, 255, 255, ${alpha * 0.94})`)
  core.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, width, height)

  ctx.globalCompositeOperation = 'lighter'
  const blobs = [
    { x: -0.24, y: -0.1, r: 0.62, a: 0.42 },
    { x: 0.24, y: 0.12, r: 0.58, a: 0.36 },
    { x: 0.03, y: -0.25, r: 0.4, a: 0.24 },
  ]

  blobs.forEach((blob, index) => {
    const x = light.x + blob.x * radius + Math.sin(frame * 0.04 + index) * 4
    const y = light.y + blob.y * radius + Math.cos(frame * 0.035 + index) * 4
    const blobRadius = radius * blob.r
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, blobRadius)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * blob.a})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, blobRadius, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.globalCompositeOperation = 'source-over'
}

function drawFlashlightGlow(ctx: CanvasRenderingContext2D) {
  const glowRadius = light.radius * 1.5
  const alpha = light.intensity * light.visible
  const warm = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, glowRadius)
  warm.addColorStop(0, `rgba(255, 220, 128, ${0.46 * alpha})`)
  warm.addColorStop(0.35, `rgba(230, 93, 35, ${0.2 * alpha})`)
  warm.addColorStop(0.78, `rgba(28, 32, 36, ${0.24 * alpha})`)
  warm.addColorStop(1, 'rgba(28, 32, 36, 0)')

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = warm
  ctx.beginPath()
  ctx.arc(light.x, light.y, glowRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawHandDebug(ctx: CanvasRenderingContext2D) {
  if (!lastHandPoint || lastInputSource !== 'hand') return

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 238, 166, 0.9)'
  ctx.fillStyle = 'rgba(255, 238, 166, 0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(lastHandPoint.x, lastHandPoint.y, 12, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(lastHandPoint.x, lastHandPoint.y, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, height * 0.18, width / 2, height * 0.52, height * 0.86)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  const sourceLabel = lastInputSource === 'hand' ? 'hand index fingertip' : `${lastInputSource} flashlight`
  ctx.save()
  ctx.globalAlpha = 0.72
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillStyle = '#f7ead1'
  ctx.fillText(`${sourceLabel}  x:${Math.round(light.x)} y:${Math.round(light.y)}`, 24, height - 24)
  ctx.restore()
}

function render() {
  frame += 1

  const width = canvas.clientWidth
  const height = canvas.clientHeight

  if (layersDirty) {
    rebuildLayers(width, height)
  }

  light.radius = Number(radiusInput.value)
  light.feather = Number(featherInput.value)
  light.intensity = Number(intensityInput.value) / 100
  light.x += (light.targetX - light.x) * 0.18
  light.y += (light.targetY - light.y) * 0.18
  light.visible += (light.targetVisible - light.visible) * 0.12

  context.clearRect(0, 0, width, height)
  context.drawImage(monoLayer, 0, 0, width, height)

  revealContext.clearRect(0, 0, width, height)
  revealContext.globalCompositeOperation = 'source-over'
  revealContext.drawImage(colorLayer, 0, 0, width, height)
  revealContext.globalCompositeOperation = 'destination-in'
  drawRevealMask(revealContext, width, height)
  revealContext.globalCompositeOperation = 'source-over'
  context.drawImage(revealLayer, 0, 0, width, height)

  drawFlashlightGlow(context)
  drawHandDebug(context)
  drawOverlay(context, width, height)

  requestAnimationFrame(render)
}

canvas.addEventListener('pointermove', updatePointer)
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId)
  updatePointer(event)
})
canvas.addEventListener('pointerleave', () => {
  if (!handTrackingEnabled) light.targetVisible = 0.2
})
canvas.addEventListener('pointerenter', () => {
  if (!handTrackingEnabled) light.targetVisible = 1
})
handToggle.addEventListener('click', () => {
  void toggleHandTracking()
})
window.addEventListener('resize', resizeCanvas)
window.addEventListener('beforeunload', stopHandTracking)

resizeCanvas()
render()
