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

type Building = {
  x: number
  y: number
  width: number
  floors: number
  scale: number
}

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
        <p class="hint">Move your mouse or finger like a prop flashlight. The ink mural stays monochrome while the lit patch warms up with lantern color and water glow.</p>
      </div>

      <label>
        <span>Radius</span>
        <input id="radius" type="range" min="70" max="260" value="145" />
      </label>

      <label>
        <span>Feather</span>
        <input id="feather" type="range" min="25" max="170" value="92" />
      </label>

      <label>
        <span>Glow</span>
        <input id="intensity" type="range" min="0" max="100" value="88" />
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

const revealLayer = document.createElement('canvas')
const revealContext = revealLayer.getContext('2d')

if (!revealContext) {
  throw new Error('Reveal Canvas 2D context is not available')
}

const light: LightState = {
  x: window.innerWidth * 0.48,
  y: window.innerHeight * 0.52,
  targetX: window.innerWidth * 0.48,
  targetY: window.innerHeight * 0.52,
  radius: Number(radiusInput.value),
  feather: Number(featherInput.value),
  intensity: Number(intensityInput.value) / 100,
  visible: 1,
  targetVisible: 1,
}

const buildings: Building[] = [
  { x: 0.08, y: 0.52, width: 0.12, floors: 2, scale: 1.15 },
  { x: 0.22, y: 0.43, width: 0.16, floors: 3, scale: 1.2 },
  { x: 0.43, y: 0.39, width: 0.17, floors: 3, scale: 1.3 },
  { x: 0.67, y: 0.46, width: 0.14, floors: 2, scale: 1.05 },
  { x: 0.86, y: 0.5, width: 0.12, floors: 3, scale: 1.1 },
  { x: 0.14, y: 0.75, width: 0.11, floors: 2, scale: 0.9 },
  { x: 0.73, y: 0.76, width: 0.13, floors: 2, scale: 0.95 },
]

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

  revealLayer.width = Math.round(width * ratio)
  revealLayer.height = Math.round(height * ratio)
  revealContext.setTransform(ratio, 0, 0, ratio, 0, 0)
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

function drawMonochromeMural(ctx: CanvasRenderingContext2D, width: number, height: number) {
  drawPaper(ctx, width, height)
  drawDistantCity(ctx, width, height)
  drawRiver(ctx, width, height, false)
  buildings.forEach((building, index) => drawPagoda(ctx, width, height, building, false, index))
  drawArchedBridge(ctx, width, height, false)
  drawMarketDetails(ctx, width, height, false)
  drawInkLines(ctx, width, height)
}

function drawIlluminatedMural(ctx: CanvasRenderingContext2D, width: number, height: number) {
  drawColorAtmosphere(ctx, width, height)
  drawRiver(ctx, width, height, true)
  buildings.forEach((building, index) => drawPagoda(ctx, width, height, building, true, index))
  drawArchedBridge(ctx, width, height, true)
  drawMarketDetails(ctx, width, height, true)
  drawLanternBloom(ctx, width, height)
}

function drawPaper(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#f4f1e9')
  gradient.addColorStop(0.56, '#e9e3d7')
  gradient.addColorStop(1, '#d7d0c1')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.22
  ctx.strokeStyle = '#928a7f'
  ctx.lineWidth = 1

  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 131) % width) + Math.sin(i * 2.7) * 8
    const y = ((i * 73) % height) + Math.cos(i * 1.9) * 8
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 18 + (i % 5) * 9, y + Math.sin(i) * 7)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}

function drawDistantCity(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(40, 38, 34, 0.32)'
  ctx.lineWidth = 1.4

  for (let i = 0; i < 17; i += 1) {
    const x = (i / 16) * width
    const baseY = height * (0.22 + 0.09 * Math.sin(i * 0.8))
    const towerHeight = height * (0.08 + ((i * 11) % 9) / 100)
    drawRoofLine(ctx, x - width * 0.035, baseY, width * 0.07, towerHeight)
  }

  ctx.restore()
}

function drawRoofLine(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width * 0.5, y - height)
  ctx.lineTo(x + width, y)
  ctx.moveTo(x + width * 0.1, y + height * 0.22)
  ctx.lineTo(x + width * 0.9, y + height * 0.22)
  ctx.stroke()
}

function drawRiver(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(width * 0.03, height * 0.82)
  ctx.bezierCurveTo(width * 0.28, height * 0.65, width * 0.38, height * 0.78, width * 0.52, height * 0.62)
  ctx.bezierCurveTo(width * 0.67, height * 0.45, width * 0.75, height * 0.5, width * 0.97, height * 0.3)
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()

  if (colorMode) {
    const water = ctx.createLinearGradient(0, height * 0.55, width, height)
    water.addColorStop(0, 'rgba(24, 67, 72, 0.72)')
    water.addColorStop(0.55, 'rgba(20, 150, 150, 0.78)')
    water.addColorStop(1, 'rgba(6, 29, 46, 0.9)')
    ctx.fillStyle = water
    ctx.fill()
  } else {
    ctx.strokeStyle = 'rgba(35, 34, 31, 0.48)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.strokeStyle = colorMode ? 'rgba(150, 249, 241, 0.5)' : 'rgba(35, 34, 31, 0.28)'
  ctx.lineWidth = colorMode ? 2 : 1.2

  for (let i = 0; i < 22; i += 1) {
    const y = height * (0.63 + i * 0.018)
    ctx.beginPath()
    for (let x = width * 0.05; x < width * 0.92; x += 20) {
      const wave = Math.sin(x * 0.02 + i * 0.8 + frame * 0.02) * 5
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
  ctx.strokeStyle = colorMode ? 'rgba(49, 24, 17, 0.9)' : 'rgba(24, 23, 21, 0.8)'
  ctx.lineWidth = colorMode ? 2.4 : 1.8

  for (let floor = 0; floor < building.floors; floor += 1) {
    const floorWidth = width * (1 - floor * 0.13)
    const floorX = x + (width - floorWidth) / 2
    const y = baseY - floor * floorHeight
    const bodyHeight = floorHeight * 0.64

    if (colorMode) {
      ctx.fillStyle = index % 2 === 0 ? 'rgba(140, 72, 39, 0.9)' : 'rgba(105, 55, 36, 0.86)'
      ctx.fillRect(floorX + floorWidth * 0.12, y - bodyHeight, floorWidth * 0.76, bodyHeight)
    }

    ctx.strokeRect(floorX + floorWidth * 0.12, y - bodyHeight, floorWidth * 0.76, bodyHeight)
    drawCurvedRoof(ctx, floorX, y - bodyHeight, floorWidth, colorMode)

    for (let column = 0; column < 4; column += 1) {
      const windowX = floorX + floorWidth * (0.24 + column * 0.15)
      const windowY = y - bodyHeight * 0.64
      ctx.fillStyle = colorMode ? 'rgba(255, 193, 89, 0.95)' : 'rgba(63, 60, 55, 0.18)'
      ctx.fillRect(windowX, windowY, floorWidth * 0.055, bodyHeight * 0.42)
    }
  }

  const topY = baseY - building.floors * floorHeight
  ctx.beginPath()
  ctx.moveTo(x + width * 0.5, topY - floorHeight * 0.78)
  ctx.lineTo(x + width * 0.5, topY)
  ctx.stroke()

  ctx.restore()
}

function drawCurvedRoof(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colorMode: boolean) {
  ctx.save()
  ctx.fillStyle = colorMode ? 'rgba(158, 83, 45, 0.95)' : 'rgba(35, 34, 31, 0.14)'
  ctx.beginPath()
  ctx.moveTo(x - width * 0.08, y + width * 0.03)
  ctx.quadraticCurveTo(x + width * 0.5, y - width * 0.18, x + width * 1.08, y + width * 0.03)
  ctx.quadraticCurveTo(x + width * 0.82, y + width * 0.12, x + width * 0.5, y + width * 0.09)
  ctx.quadraticCurveTo(x + width * 0.18, y + width * 0.12, x - width * 0.08, y + width * 0.03)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawArchedBridge(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  const startX = width * 0.36
  const endX = width * 0.66
  const baseY = height * 0.66

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = colorMode ? 'rgba(184, 107, 59, 0.96)' : 'rgba(28, 27, 25, 0.76)'
  ctx.lineWidth = colorMode ? 10 : 5
  ctx.beginPath()
  ctx.moveTo(startX, baseY)
  ctx.quadraticCurveTo(width * 0.51, height * 0.5, endX, baseY)
  ctx.stroke()

  ctx.lineWidth = colorMode ? 4 : 2
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12
    const x = startX + (endX - startX) * t
    const y = baseY - Math.sin(t * Math.PI) * height * 0.14
    ctx.beginPath()
    ctx.moveTo(x, y - 9)
    ctx.lineTo(x, y + 28)
    ctx.stroke()
  }

  ctx.strokeStyle = colorMode ? 'rgba(255, 202, 117, 0.96)' : 'rgba(28, 27, 25, 0.46)'
  ctx.lineWidth = colorMode ? 3 : 1.6
  ctx.beginPath()
  ctx.moveTo(startX - 12, baseY - 26)
  ctx.quadraticCurveTo(width * 0.51, height * 0.47, endX + 12, baseY - 26)
  ctx.stroke()
  ctx.restore()
}

function drawMarketDetails(ctx: CanvasRenderingContext2D, width: number, height: number, colorMode: boolean) {
  ctx.save()
  ctx.strokeStyle = colorMode ? 'rgba(58, 31, 22, 0.88)' : 'rgba(25, 24, 22, 0.62)'
  ctx.fillStyle = colorMode ? 'rgba(70, 40, 28, 0.9)' : 'rgba(25, 24, 22, 0.58)'
  ctx.lineWidth = 1.6

  for (let i = 0; i < 42; i += 1) {
    const x = width * (0.18 + ((i * 37) % 64) / 100)
    const y = height * (0.55 + ((i * 23) % 28) / 100)
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

  for (let i = 0; i < 18; i += 1) {
    const x = width * (0.06 + ((i * 29) % 88) / 100)
    const y = height * (0.33 + ((i * 17) % 43) / 100)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 24)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y - 7, 7, 0, Math.PI * 2)
    if (colorMode) {
      ctx.fillStyle = 'rgba(255, 162, 58, 0.86)'
      ctx.fill()
    }
    ctx.stroke()
  }

  ctx.restore()
}

function drawInkLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(15, 15, 14, 0.55)'
  ctx.lineWidth = 1.1

  for (let i = 0; i < 120; i += 1) {
    const x = ((i * 89) % width) + Math.sin(i) * 12
    const y = ((i * 47) % height) + Math.cos(i * 1.4) * 8
    const length = 18 + ((i * 17) % 72)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + length * 0.4, y + Math.sin(i) * 18, x + length, y + Math.cos(i) * 10)
    ctx.stroke()
  }

  ctx.restore()
}

function drawColorAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const warmth = ctx.createRadialGradient(width * 0.48, height * 0.57, 0, width * 0.48, height * 0.57, width * 0.32)
  warmth.addColorStop(0, 'rgba(255, 197, 91, 0.96)')
  warmth.addColorStop(0.38, 'rgba(222, 91, 42, 0.62)')
  warmth.addColorStop(0.72, 'rgba(35, 41, 54, 0.22)')
  warmth.addColorStop(1, 'rgba(35, 41, 54, 0)')
  ctx.fillStyle = warmth
  ctx.fillRect(0, 0, width, height)

  const teal = ctx.createRadialGradient(width * 0.58, height * 0.68, 0, width * 0.58, height * 0.68, width * 0.18)
  teal.addColorStop(0, 'rgba(50, 225, 210, 0.78)')
  teal.addColorStop(1, 'rgba(50, 225, 210, 0)')
  ctx.fillStyle = teal
  ctx.fillRect(0, 0, width, height)
}

function drawLanternBloom(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < 26; i += 1) {
    const x = width * (0.39 + ((i * 17) % 24) / 100)
    const y = height * (0.47 + ((i * 11) % 22) / 100)
    const radius = 14 + (i % 5) * 5
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, 'rgba(255, 226, 122, 0.9)')
    glow.addColorStop(0.42, 'rgba(255, 129, 42, 0.36)')
    glow.addColorStop(1, 'rgba(255, 129, 42, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawRevealMask(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const alpha = Math.min(1, Math.max(0, light.visible))
  const radius = light.radius
  const feather = light.feather
  const flicker = Math.sin(frame * 0.055) * 5

  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  const core = ctx.createRadialGradient(light.x, light.y, Math.max(1, radius - feather), light.x, light.y, radius + flicker)
  core.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  core.addColorStop(0.48, `rgba(255, 255, 255, ${alpha * 0.85})`)
  core.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, width, height)

  ctx.globalCompositeOperation = 'lighter'
  const blobs = [
    { x: -0.28, y: -0.1, r: 0.58, a: 0.38 },
    { x: 0.22, y: 0.12, r: 0.54, a: 0.34 },
    { x: 0.04, y: -0.26, r: 0.36, a: 0.2 },
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
  const glowRadius = light.radius * 1.45
  const alpha = light.intensity * light.visible
  const warm = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, glowRadius)
  warm.addColorStop(0, `rgba(255, 208, 122, ${0.4 * alpha})`)
  warm.addColorStop(0.34, `rgba(226, 91, 38, ${0.18 * alpha})`)
  warm.addColorStop(0.76, `rgba(28, 32, 36, ${0.22 * alpha})`)
  warm.addColorStop(1, 'rgba(28, 32, 36, 0)')

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = warm
  ctx.beginPath()
  ctx.arc(light.x, light.y, glowRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const shadow = ctx.createRadialGradient(light.x, light.y, light.radius * 0.62, light.x, light.y, light.radius * 1.05)
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shadow.addColorStop(0.58, `rgba(0, 0, 0, ${0.28 * alpha})`)
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.arc(light.x, light.y, light.radius * 1.05, 0, Math.PI * 2)
  ctx.fill()
}

function drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, height * 0.18, width / 2, height * 0.52, height * 0.86)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.26)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  const label = lastPointerSource === 'touch' ? 'touch flashlight' : 'pointer flashlight'
  ctx.save()
  ctx.globalAlpha = 0.72
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillStyle = '#f7ead1'
  ctx.fillText(`${label}  x:${Math.round(light.x)} y:${Math.round(light.y)}`, 24, height - 24)
  ctx.restore()
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
  drawMonochromeMural(context, width, height)

  drawRevealMask(revealContext, width, height)
  revealContext.globalCompositeOperation = 'source-in'
  drawIlluminatedMural(revealContext, width, height)
  revealContext.globalCompositeOperation = 'source-over'
  context.drawImage(revealLayer, 0, 0, width, height)

  drawFlashlightGlow(context)
  drawOverlay(context, width, height)

  requestAnimationFrame(render)
}

canvas.addEventListener('pointermove', updatePointer)
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId)
  updatePointer(event)
})
canvas.addEventListener('pointerleave', () => {
  light.targetVisible = 0.2
})
canvas.addEventListener('pointerenter', () => {
  light.targetVisible = 1
})
window.addEventListener('resize', resizeCanvas)

resizeCanvas()
render()
