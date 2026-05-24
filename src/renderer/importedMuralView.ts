import type { MuralRenderer } from './MuralRenderer'

export type ImportedMuralViewMode = 'fit' | 'pan'

type ImagePlacement = {
  dx: number
  dy: number
  dw: number
  dh: number
}

type RuntimeRenderer = MuralRenderer & {
  getContainPlacement: (image: HTMLImageElement, width: number, height: number) => ImagePlacement
  layersDirty: boolean
  importedColorImage: HTMLImageElement | null
  __importedMuralViewMode?: ImportedMuralViewMode
  __importedMuralPanOffset?: number
}

export function installImportedMuralView(renderer: MuralRenderer) {
  const runtime = renderer as RuntimeRenderer
  const getFitPlacement = runtime.getContainPlacement.bind(renderer)

  runtime.__importedMuralViewMode = 'fit'
  runtime.__importedMuralPanOffset = 0.5

  runtime.getContainPlacement = (image, width, height) => {
    if (runtime.__importedMuralViewMode !== 'pan') {
      return getFitPlacement(image, width, height)
    }

    return getPanPlacement(image, width, height, runtime.__importedMuralPanOffset ?? 0.5)
  }

  return {
    setMode(mode: ImportedMuralViewMode) {
      runtime.__importedMuralViewMode = mode
      runtime.layersDirty = true
    },

    setPanOffset(offset: number) {
      runtime.__importedMuralPanOffset = Math.max(0, Math.min(1, offset))
      runtime.layersDirty = true
    },

    hasImportedImage() {
      return Boolean(runtime.importedColorImage)
    },
  }
}

function getPanPlacement(image: HTMLImageElement, width: number, height: number, offset: number): ImagePlacement {
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = width / height

  if (imageRatio >= canvasRatio) {
    const dh = height
    const dw = height * imageRatio
    const overflow = Math.max(0, dw - width)

    return {
      dx: -overflow * offset,
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
    dy: -overflow * offset,
    dw,
    dh,
  }
}
