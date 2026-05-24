import './styles.css'
import { DEFAULT_MURAL_URL, DEFAULT_MURAL_NAME } from './assets/defaultMural'
import { PointerInput } from './inputs/PointerInput'
import { MediaPipeHandInput } from './inputs/MediaPipeHandInput'
import { CanvasMapper } from './mapping/CanvasMapper'
import { installImportedMuralView } from './renderer/importedMuralView'
import { MuralRenderer } from './renderer/MuralRenderer'
import type { TrackingInput, TrackingPoint } from './types'

function queryRequired<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector)

  if (!element) {
    throw new Error(`Missing required element: ${selector}`)
  }

  return element
}

const app = queryRequired<HTMLDivElement>('#app')

app.innerHTML = `
  <main class="stage-shell">
    <div class="top-actions" aria-label="Project actions">
      <button id="import-mural" class="top-action-button" type="button">Import mural</button>
      <a class="top-action-button" href="https://github.com/hu-qi/mural-flashlight" target="_blank" rel="noreferrer">
        Source ↗
      </a>
    </div>
    <input id="mural-file" class="visually-hidden" type="file" accept="image/*" />

    <video id="camera-video" class="camera-video" autoplay playsinline muted></video>
    <canvas id="mural-canvas" aria-label="Interactive mural flashlight demo"></canvas>

    <details class="hud" aria-label="Controls">
      <summary class="hud-summary">
        <span class="hud-brand">Mural Flashlight</span>
        <span id="tracking-status" class="hud-status">Loading default mural...</span>
        <span class="hud-settings">Settings</span>
      </summary>

      <div class="hud-panel">
        <p class="hint">Move the flashlight to reveal color. Hold near edges to explore the long mural.</p>

        <div class="mode-row">
          <button id="hand-toggle" type="button">Start hand tracking</button>
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
      </div>
    </details>
  </main>
`

const canvas = queryRequired<HTMLCanvasElement>('#mural-canvas')
const video = queryRequired<HTMLVideoElement>('#camera-video')
const radiusInput = queryRequired<HTMLInputElement>('#radius')
const featherInput = queryRequired<HTMLInputElement>('#feather')
const intensityInput = queryRequired<HTMLInputElement>('#intensity')
const handToggle = queryRequired<HTMLButtonElement>('#hand-toggle')
const trackingStatus = queryRequired<HTMLSpanElement>('#tracking-status')
const importMuralButton = queryRequired<HTMLButtonElement>('#import-mural')
const muralFileInput = queryRequired<HTMLInputElement>('#mural-file')

const mapper = new CanvasMapper(canvas)
const renderer = new MuralRenderer(canvas)
installImportedMuralView(renderer)
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

async function loadDefaultMural() {
  try {
    await renderer.setDefaultImage(DEFAULT_MURAL_URL)
    trackingStatus.textContent = `${DEFAULT_MURAL_NAME} loaded · Edge explore ready`
  } catch (error) {
    console.error(error)
    trackingStatus.textContent = 'Pointer mode'
  }
}

async function importMural(file: File) {
  importMuralButton.disabled = true
  trackingStatus.textContent = 'Generating line-art layer...'

  try {
    await renderer.importColorImage(file)
    trackingStatus.textContent = `Imported: ${file.name}`
  } catch (error) {
    console.error(error)
    trackingStatus.textContent = error instanceof Error ? error.message : 'Failed to import mural image'
  } finally {
    importMuralButton.disabled = false
    muralFileInput.value = ''
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
importMuralButton.addEventListener('click', () => {
  muralFileInput.click()
})
muralFileInput.addEventListener('change', () => {
  const file = muralFileInput.files?.[0]
  if (file) void importMural(file)
})
window.addEventListener('resize', resize)
window.addEventListener('beforeunload', () => activeInput.stop())

resize()
void loadDefaultMural()
void enablePointerMode()
renderLoop()
