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

type PointerSource = 'mouse' | 'touch' | 'pen'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root element')
}

app.innerHTML = `
  <main class="stage-shell">
    <canvas id="mural-canvas" aria-label="Interactive mural flashlight demo"></canvas>

    <section class="hud" aria-label="Controls">
      <div>
        <p class="eyebrow">Step 1 / Pointer Prototype</p>
        <h1>Mural Flashlight</h1>
        <p class="hint">Move your mouse or finger over the mural to reveal the illuminated color layer.</p>
      </div>

      <label>
        <span>Radius</span>
        <input id="radius" type="range" min="80" max="320" value="170" />
      </label>

      <label>
        <span>Feather</span>
        <input id="feather" type="range" min="20" max="180" value="85" />
      </label>

      <label>
        <span>Glow</span>
        <input id="intensity" type="range" min="0" max="100" value="75" />
      </label>
    </section>
  </main>
`

const canvas = document.querySelector<HTMLCanvasElement>('#mural-canvas')
const radiusInput = document.querySelector<HTMLInputElement>('#radius')
const featherInput = document.querySelector<HTMLInputElement>('#feather')
const intensityInput = document.querySelector<HTMLInputElement>('#intensity')

if (!canvas || !radiusInput || !featherInput || !intensityInput) {
  throw new Error('Missing required UI elements')
}

const context = canvas.getContext('2d', { alpha: false })

if (!context) {
  throw new Error('Canvas 2D context is not available')
}

const offscreen = document.createElement('canvas')
const offscreenContext = offscreen.getContext('2d')

if (!offscreenContext) {
  throw new Error('Offscreen Canvas 2D context is not available')
}

const light: LightState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  targetX: window.innerWidth / 2,
  targetY: window.innerHeight / 2,
  radius: Number(radiusInput.value),
  feather: Number(featherInput.value),
  intensity: Number(intensityInput.value) / 100,
  visible: 1,
  targetVisible: 1,
}

let lastPointerSource: PointerSource = 'mouse'
let frame = 0

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight

  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  offscreen.width = Math.round(width * ratio)
  offscreen.height = Math.round(height * ratio)
  offscreenContext.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function getCanvasPoint(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function updatePointer(event: PointerEvent) {
  const point = getCanvasPoint(event)
  lastPointerSource = event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse'
  light.targetX = point.x
  light.targetY = point.y
  light.targetVisible = 1
}

function drawMuralBase(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height)

  if (colorMode) {
    skyGradient.addColorStop(0, '#203d61')
    skyGradient.addColorStop(0.42, '#92704d')
    skyGradient.addColorStop(1, '#1b2432')
  } else {
    skyGradient.addColorStop(0, '#e8e0ce')
    skyGradient.addColorStop(0.5, '#cfc4b1')
    skyGradient.addColorStop(1, '#918879')
  }

  ctx.fillStyle = skyGradient
  ctx.fillRect(0, 0, width, height)

  drawMountains(ctx, width, height, colorMode)
  drawCity(ctx, width, height, colorMode)
  drawBridge(ctx, width, height, colorMode)
  drawWater(ctx, width, height, colorMode)
  drawInkTexture(ctx, width, height, colorMode)
}

function drawMountains(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const ridges = [
    { y: 0.31, amp: 0.07, peaks: 5, offset: 0.02 },
    { y: 0.38, amp: 0.08, peaks: 7, offset: 0.19 },
    { y: 0.46, amp: 0.05, peaks: 8, offset: 0.31 },
  ]

  ridges.forEach((ridge, index) => {
    ctx.beginPath()
    ctx.moveTo(0, height)

    for (let i = 0; i <= ridge.peaks; i += 1) {
      const x = (i / ridge.peaks) * width
      const y = height * ridge.y - Math.sin(i * 1.7 + ridge.offset) * height * ridge.amp
      ctx.lineTo(x, y)
    }

    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = colorMode
      ? [`#2d4c5f`, '#27424a', '#24363b'][index]
      : [`#b7ad9c`, '#aaa190', '#989081'][index]
    ctx.globalAlpha = colorMode ? 0.82 : 0.7
    ctx.fill()
    ctx.globalAlpha = 1
  })
}

function drawCity(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const groundY = height * 0.66
  const buildingCount = Math.max(18, Math.floor(width / 70))

  for (let i = 0; i < buildingCount; i += 1) {
    const x = (i / buildingCount) * width + Math.sin(i * 3.1) * 16
    const w = 28 + ((i * 17) % 42)
    const h = 70 + ((i * 29) % 120)
    const y = groundY - h

    ctx.fillStyle = colorMode ? (i % 3 === 0 ? '#8f4a2d' : '#5d3d32') : '#5d574f'
    ctx.strokeStyle = colorMode ? '#2b1b19' : '#393631'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.fill()
    ctx.stroke()

    drawRoof(ctx, x, y, w, colorMode)
    drawWindows(ctx, x, y, w, h, colorMode, i)
  }
}

function drawRoof(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colorMode: boolean) {
  ctx.beginPath()
  ctx.moveTo(x - 8, y + 4)
  ctx.lineTo(x + width / 2, y - 18)
  ctx.lineTo(x + width + 8, y + 4)
  ctx.closePath()
  ctx.fillStyle = colorMode ? '#b76135' : '#4e4a43'
  ctx.fill()
  ctx.strokeStyle = colorMode ? '#321d18' : '#36322d'
  ctx.stroke()
}

function drawWindows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colorMode: boolean,
  seed: number,
) {
  const rows = Math.floor(height / 28)
  const columns = Math.max(1, Math.floor(width / 22))

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if ((row + column + seed) % 3 === 0) continue

      ctx.fillStyle = colorMode ? '#ffd27a' : '#d6cdbb'
      ctx.globalAlpha = colorMode ? 0.9 : 0.55
      ctx.fillRect(x + 8 + column * 20, y + 18 + row * 26, 8, 12)
      ctx.globalAlpha = 1
    }
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const bridgeY = height * 0.69
  ctx.strokeStyle = colorMode ? '#d09a5d' : '#544f48'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(width * 0.18, bridgeY)
  ctx.quadraticCurveTo(width * 0.5, bridgeY - height * 0.13, width * 0.82, bridgeY)
  ctx.stroke()

  ctx.lineWidth = 3
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14
    const x = width * 0.18 + (width * 0.64) * t
    const y = bridgeY - Math.sin(t * Math.PI) * height * 0.13
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, bridgeY + 45)
    ctx.stroke()
  }

  ctx.fillStyle = colorMode ? '#ffb65e' : '#d0c4af'
  for (let i = 0; i < 10; i += 1) {
    const t = i / 9
    const x = width * 0.22 + (width * 0.56) * t
    const y = bridgeY - Math.sin(t * Math.PI) * height * 0.1 - 18
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWater(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const waterY = height * 0.67
  const gradient = ctx.createLinearGradient(0, waterY, 0, height)
  gradient.addColorStop(0, colorMode ? '#214553' : '#807a70')
  gradient.addColorStop(1, colorMode ? '#10232f' : '#57534d')
  ctx.fillStyle = gradient
  ctx.fillRect(0, waterY, width, height - waterY)

  ctx.strokeStyle = colorMode ? 'rgba(112, 208, 213, 0.48)' : 'rgba(230, 225, 214, 0.34)'
  ctx.lineWidth = 2

  for (let y = waterY + 24; y < height; y += 28) {
    ctx.beginPath()
    for (let x = 0; x <= width; x += 32) {
      const waveY = y + Math.sin((x + frame * 0.8) * 0.025 + y * 0.02) * 5
      if (x === 0) ctx.moveTo(x, waveY)
      else ctx.lineTo(x, waveY)
    }
    ctx.stroke()
  }
}

function drawInkTexture(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.globalAlpha = colorMode ? 0.1 : 0.18
  ctx.strokeStyle = colorMode ? '#f3d2a2' : '#302b25'
  ctx.lineWidth = 1

  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 97) % width) + Math.sin(i) * 8
    const y = ((i * 57) % height) + Math.cos(i * 2) * 8
    const length = 18 + ((i * 13) % 52)

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + length, y + Math.sin(i * 5) * 10)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}

function render() {
  frame += 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  light.radius = Number(radiusInput.value)
  light.feather = Number(featherInput.value)
  light.intensity = Number(intensityInput.value) / 100

  light.x += (light.targetX - light.x) * 0.18
  light.y += (light.targetY - light.y) * 0.18
  light.visible += (light.targetVisible - light.visible) * 0.12

  context.clearRect(0, 0, width, height)
  drawMuralBase(context, width, height, false)

  offscreenContext.clearRect(0, 0, width, height)
  drawLightMask(offscreenContext, width, height)
  offscreenContext.globalCompositeOperation = 'source-in'
  drawMuralBase(offscreenContext, width, height, true)
  offscreenContext.globalCompositeOperation = 'source-over'

  context.drawImage(offscreen, 0, 0, width, height)
  drawGlow(context)
  drawCursorHint(context, width, height)

  requestAnimationFrame(render)
}

function drawLightMask(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const inner = Math.max(1, light.radius - light.feather)
  const gradient = ctx.createRadialGradient(light.x, light.y, inner * 0.25, light.x, light.y, light.radius)
  const alpha = Math.min(1, Math.max(0, light.visible))

  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  gradient.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.92})`)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function drawGlow(ctx: CanvasRenderingContext2D) {
  const glowRadius = light.radius * 1.35
  const alpha = light.intensity * light.visible
  const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, glowRadius)

  gradient.addColorStop(0, `rgba(255, 205, 120, ${0.35 * alpha})`)
  gradient.addColorStop(0.42, `rgba(255, 128, 48, ${0.14 * alpha})`)
  gradient.addColorStop(1, 'rgba(255, 128, 48, 0)')

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(light.x, light.y, glowRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCursorHint(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const label = lastPointerSource === 'touch' ? 'touch flashlight' : 'pointer flashlight'
  ctx.save()
  ctx.globalAlpha = 0.72
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillStyle = '#f7ead1'
  ctx.fillText(`${label}  x:${Math.round(light.x)} y:${Math.round(light.y)}`, 24, height - 24)
  ctx.restore()

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.9)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

radiusInput.addEventListener('input', () => {
  light.radius = Number(radiusInput.value)
})

featherInput.addEventListener('input', () => {
  light.feather = Number(featherInput.value)
})

intensityInput.addEventListener('input', () => {
  light.intensity = Number(intensityInput.value) / 100
})

canvas.addEventListener('pointermove', updatePointer)
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId)
  updatePointer(event)
})
canvas.addEventListener('pointerleave', () => {
  light.targetVisible = 0.35
})
canvas.addEventListener('pointerenter', () => {
  light.targetVisible = 1
})

window.addEventListener('resize', resizeCanvas)

resizeCanvas()
render()
