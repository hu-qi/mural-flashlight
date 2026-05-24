# Mural Flashlight

A browser-based interactive mural prototype. Step 1 implements the core flashlight reveal effect with mouse and touch input.

## Step 1: pointer-driven reveal

The demo renders a procedural mural in two layers:

- a muted ink / line-art base layer
- a warm illuminated color layer

Moving the pointer over the canvas moves a soft radial mask. The mask reveals the color layer and adds a warm glow, simulating a flashlight illuminating a mural.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in a browser.

## Controls

- Move mouse / touch screen: move the flashlight
- Radius: adjust the lit area size
- Feather: adjust edge softness
- Glow: adjust warm light intensity

## Planned next steps

1. Replace pointer input with MediaPipe hand / finger tracking.
2. Add gesture-based flashlight activation, for example pinch to turn on.
3. Replace MediaPipe with AprilTag tracking for a physical flashlight prop.
4. Add four-point calibration for camera-to-screen coordinate mapping.
