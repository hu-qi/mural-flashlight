import './styles.css'
import { PointerInput } from './inputs/PointerInput'
import { MediaPipeHandInput } from './inputs/MediaPipeHandInput'
import { CanvasMapper } from './mapping/CanvasMapper'
import { MuralRenderer } from './renderer/MuralRenderer'
import type { TrackingInput, TrackingPoint } from './types'

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
        <p class="eyebrow">Step 3 / Modular Tracking</p>
        <h1>Mural Flashlight</h1>
        <p class="hint">Renderer, Input, and Mapper are now separate. Pointer and MediaPipe Hands both feed the same tracking point pipeline.</p>
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

const mapper = new CanvasMapper(canvas)
const renderer = new MuralRenderer(canvas)
const pointerInput = new PointerInput(canvas, mapper)
const handInput = new MediaPipeHandInput(video, mapper)
let activeInput: TrackingInput = pointerInput
let handTrackingEnabled = false

function updateRendererConfig() {
  renderer.updateConfig({
    radius: Number(radiusInput.value),
    feather: Number(featherInput.value),
    intensity: Number(intensityInput.value) / 100,
  })
}

function handleTrackingPoint(point: TrackingPoint) {
  renderer.setTrackingPoint(point)
}

function handleStatus(message: string) {
  trackingStatus.textContent = message
}

function wireInput(input: TrackingInput) {
  input.onPoint(handleTrackingPoint)
  input.onStatus(handleStatus)
}

async function enablePointerMode() {
  handInput.stop()
  activeInput = pointerInput
  handTrackingEnabled = false
  handToggle.disabled = false
  handToggle.textContent = 'Start hand tracking'
  await pointerInput.start()
}

async function enableHandMode() {
  handTrackingEnabled = true
  handToggle.disabled = true
  handToggle.textContent = 'Loading...'
  pointerInput.stop()
  activeInput = handInput

  try {
    await handInput.start()
    handToggle.textContent = 'Stop hand tracking'
  } finally {
    handToggle.disabled = false
  }
}

function renderLoop() {
  updateRendererConfig()
  renderer.render()
  requestAnimationFrame(renderLoop)
}

function resize() {
  renderer.resize()
}

wireInput(pointerInput)
wireInput(handInput)
handToggle.addEventListener('click', () => {
  void (handTrackingEnabled ? enablePointerMode() : enableHandMode())
})
window.addEventListener('resize', resize)
window.addEventListener('beforeunload', () => activeInput.stop())

resize()
void enablePointerMode()
renderLoop()
