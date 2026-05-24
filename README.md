# Mural Flashlight

A browser-based interactive mural prototype. It simulates a handheld flashlight revealing a colored layer inside a monochrome ink mural.

## Step 1: pointer-driven reveal

The demo renders a procedural mural in two layers:

- a muted ink / line-art base layer
- a warm illuminated color layer

Moving the pointer over the canvas moves a soft radial mask. The mask reveals the color layer and adds a warm glow, simulating a flashlight illuminating a mural.

## Step 2: MediaPipe Hands input

Click **Start hand tracking** to enable the webcam and load MediaPipe Hands. The app tracks the index fingertip landmark and maps it to the canvas, so your finger controls the flashlight position.

Notes:

- Pointer input remains available when hand tracking is off.
- The camera preview is mirrored, and fingertip coordinates are mirrored to match the preview.
- The fingertip point is smoothed before driving the flashlight to reduce jitter.
- Browsers require HTTPS or localhost for camera access.

## Run locally

```bash
npm install
npm run dev
```

For camera testing from another device on the same network, use HTTPS:

```bash
npm run dev:https
```

Then open the local Vite URL in a browser.

## Controls

- Move mouse / touch screen: move the flashlight in pointer mode
- Start hand tracking: use the index fingertip to move the flashlight
- Radius: adjust the lit area size
- Feather: adjust edge softness
- Glow: adjust warm light intensity

## Planned next steps

1. Add gesture-based flashlight activation, for example pinch to turn on.
2. Replace MediaPipe with AprilTag tracking for a physical flashlight prop.
3. Add four-point calibration for camera-to-screen coordinate mapping.
