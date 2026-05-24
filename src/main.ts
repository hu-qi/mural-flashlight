import './styles.css'
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
      <div class="view-actions" aria-label="Imported mural view mode">
        <button id="fit-view" class="top-action-button is-active" type="button">Fit</button>
        <button id="pan-view" class="top-action-button" type="button">Pan</button>
      </div>
      <a class="top-action-button" href="https://github.com/hu-qi/mural-flashlight" target="_blank" rel="noreferrer">
        Source ↗
      </a>
    </div>
    <input id="mural-file" class="visually-hidden" type="file" accept="image/*" />

    <div class="pan-control" id="pan-control" aria-label="Pan mural position">
      <span>Pan</span>
      <input id="pan-offset" type="range" min="0" max="100" value="50" />
    </div>

    <video id="camera-video" class="camera-video" autoplay playsinline muted></video>
    <canvas id="mural-canvas" aria-label="Interactive mural flashlight demo"></canvas>

    <section class="hud" aria-label="Controls">
      <div>
        <p class="eyebrow">Step 3 / Modular Tracking</p>
        <h1>Mural Flashlight</h1>
        <p class="hint">Renderer, Input, and Mapper are now separate. Import your own mural, then reveal its color layer with pointer or MediaPipe Hands.</p>
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

const canvas = queryRequired<HTMLCanvasElement>('#mural-canvas')
const video = queryRequired<HTMLVideoElement>('#camera-video')
const radiusInput = queryRequired<HTMLInputElement>('#radius')
const featherInput = queryRequired<HTMLInputElement>('#feather')
const intensityInput = queryRequired<HTMLInputElement>('#intensity')
const handToggle = queryRequired<HTMLButtonElement>('#hand-toggle')
const trackingStatus = queryRequired<HTMLSpanElement>('#tracking-status')
const importMuralButton = queryRequired<HTMLButtonElement>('#import-mural')
const muralFileInput = queryRequired<HTMLInputElement>('#mural-file')
const fitViewButton = queryRequired<HTMLButtonElement>('#fit-view')
const panViewButton = queryRequired<HTMLButtonElement>('#pan-view')
const panControl = queryRequired<HTMLDivElement>('#pan-control')
const panOffsetInput = queryRequired<HTMLInputElement>('#pan-offset')

const mapper = new CanvasMapper(canvas)
const renderer = new MuralRenderer(canvas)
const importedMuralView = installImportedMuralView(renderer)
const pointerInput = new PointerInput(canvas, mapper)
const handInput = new MediaPipeHandInput(video, mapper)
let activeInput: TrackingInput = pointerInput
let handTrackingEnabled = false
let importedViewMode: 'fit' | 'pan' = 'fit'

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

async function importMural(file: File) {
  importMuralButton.disabled = true
  trackingStatus.textContent = 'Generating monochrome line-art layer...'

  try {
    await renderer.importColorImage(file)
    updateViewMode(importedViewMode)
    trackingStatus.textContent = `Imported mural: ${file.name}`
  } catch (error) {
    console.error(error)
    trackingStatus.textContent = error instanceof Error ? error.message : 'Failed to import mural image'
  } finally {
    importMuralButton.disabled = false
    muralFileInput.value = ''
  }
}

function updateViewMode(mode: 'fit' | 'pan') {
  importedViewMode = mode
  importedMuralView.setMode(mode)
  importedMuralView.setPanOffset(Number(panOffsetInput.value) / 100)
  fitViewButton.classList.toggle('is-active', mode === 'fit')
  panViewButton.classList.toggle('is-active', mode === 'pan')
  panControl.classList.toggle('is-active', mode === 'pan' && importedMuralView.hasImportedImage())
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
fitViewButton.addEventListener('click', () => updateViewMode('fit'))
panViewButton.addEventListener('click', () => updateViewMode('pan'))
panOffsetInput.addEventListener('input', () => {
  importedMuralView.setPanOffset(Number(panOffsetInput.value) / 100)
})
window.addEventListener('resize', resize)
window.addEventListener('beforeunload', () => activeInput.stop())

resize()
updateViewMode('fit')
void enablePointerMode()
renderLoop()
