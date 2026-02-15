# GWTF — G-code Designer

**Design seamless spiral vases for 3D printing — entirely in your browser.**

GWTF is a zero-install, open-source web app that generates vase-mode G-code with parametric wave textures, helical toolpaths, and a live 3D preview. No slicer required.

[**Launch the Designer →**](#designer)

---

## Features

| Feature | Description |
|---|---|
| **Seamless Helix** | Single continuous toolpath — no layer seams, no Z-hops, no artifacts. |
| **Wave Patterns** | Blend sine, square, and triangle waves with inter-layer interference for organic textures. |
| **Blob Mode (IM-Vase)** | Injection-molding style dot patterns for unique textured surfaces. |
| **3D Preview & Simulation** | Interactive Three.js viewport with playback, layer scrubbing, and speed controls. |
| **Design Presets** | One-click Vase, Lamp Shade, and Blob Mode presets — or define your own as JSON. |
| **Round-Trip Import** | Import previously generated `.gcode` files and restore all parameters from header comments. |
| **Auto-Generate** | 500 ms debounced regeneration on every parameter change (auto-disables if generation exceeds 15 s). |
| **Multiple UI Layouts** | Command, Float, Drawer, and Horizon layout styles with four color themes. |
| **Session Persistence** | Settings saved to `localStorage` — pick up where you left off, transfer printer settings across projects. |

---

## Quick Start

1. **Open `index.html`** in any modern browser (Chrome, Firefox, Edge, Safari).
2. **Pick a preset** — Vase, Lamp Shade, or Blob Mode.
3. **Tweak parameters** in the sidebar: geometry, wave pattern, temperatures, speed.
4. **Preview** the spiral toolpath in 3D, scrub layers, play the simulation.
5. **Download** the `.gcode` file and send it to your printer.

> No build step, no bundler, no server. Just open the HTML file.

---

## How It Works

```
UI Inputs  →  params.js  →  main.js  →  GCodeBuilder  →  G-code + Preview + Stats
```

1. **Parameters** are read from the sidebar inputs and clamped to safe ranges.
2. **GCodeBuilder** computes base layers (concentric/rectilinear/grid fill), then a continuous spiral wall with wave distortions, flow ramping, and seam alignment.
3. The generated G-code string is rendered in the **3D viewport** (Three.js `LineSegments`) and available for download.
4. **Import** reverses the flow: header comments are parsed back into UI parameters.

---

## Presets

| Preset | Mode | Key Characteristics |
|---|---|---|
| **Vase** | Spiral | Classic seamless vase — soft waves, 0.45 mm layer height, 1.9 mm line width |
| **Lamp Shade** | Spiral | Wider flare, bulb socket hole, taller walls with Z-wave contour |
| **Blob Mode** | IM-Vase | Discrete blobs deposited in concentric rings with optional vase-layer bands |
| **Custom** | Any | User-defined JSON presets, saved to browser `localStorage` |

---

## Parameter Reference

### Geometry
- **Bottom / Top Diameter** — Taper from base to rim (10–500 mm)
- **Height** — Overall spiral height (10–500 mm)
- **Hole Diameter** — Inner opening for lamp shade sockets
- **Base Layers** — Flat solid layers before spiral begins (1–10)
- **Gradual Layers** — Smooth transition from base to vase layer height (0–20)

### Wave Pattern
- **Amplitude** — Radial wave depth (mm)
- **Wave Count** — Waves per revolution
- **Wave Shape** — Morphs sine → square → triangle (0–1)
- **Interference** — Phase offset between layers (0 = aligned ripples, 1 = max gap)
- **Slow Down Zones** — Dwell time and ramp length at wave peaks/valleys

### Z-Wave Contour
- **Z Wave Amplitude / Cycles** — Vertical undulation of the wall radius

### Print Settings
- **Base Pattern** — Concentric, rectilinear, or grid fill for base layers
- **Layer Height / Line Width / Flow** — Separate settings for base and wall
- **Seam Alignment** — Aligned, staggered (golden angle), or random

### Blob Mode (IM-Vase)
- **Dots per Revolution** — Blob density around circumference
- **Dot Height / Extrusion / Dwell** — Blob geometry and timing
- **Retraction** — Length and speed to prevent ooze
- **Hops** — Skip positions per pass for multi-pass fill
- **Path Shape** — Radial offset start/end + wave curvature
- **Vase Layers on Blobs** — Optional spiral bands interleaved with blob layers

### Advanced
- **Segments per Revolution** — Path resolution (120–1000)
- **Bed Origin** — Center or corner coordinate system
- **Acceleration** — Print and travel accel (mm/s²)
- **Custom Start / End G-code** — Inject arbitrary commands

---

## G-code Import

GWTF embeds all parameters as `; key=value` comments in the G-code header. When a file is imported:

1. **Our format detected** → all parameters are restored to the UI, preview regenerated.
2. **External G-code** → visualization-only mode; toolpath rendered from parsed `G0`/`G1` moves.

---

## Project Structure

```
index.html                    Landing page + designer UI (no logic)
styles/
  app.css                     Core layout and component styles
  themes.css                  Color themes + layout variants + responsive
src/
  main.js                     App orchestration, generate/import flows, window globals
  gcode/
    gcodeBuilder.js           G-code engine: base layers, spiral wall, blob wall, extrusion math
    gcodeParser.js            Parse settings from header comments, visualization parser
  preview/
    threePreview.js           Three.js viewport, simulation, layer slider, timeline
  ui/
    params.js                 Read/write/reset UI parameters, input clamping
    actions.js                Download, copy, tab switching, section toggle
    stats.js                  Print statistics: time, filament, weight, temperatures
    presets.js                Design presets, custom features, localStorage persistence
  utils/
    math.js                   fmt(), clamp(), lerp()
```

---

## Technical Details

- **Runtime**: Pure ES modules — no build step, no bundler, no framework.
- **Three.js**: Loaded via `importmap` from CDN (`three@0.160.0`).
- **Icons**: Feather Icons via CDN.
- **Fonts**: Inter + JetBrains Mono from Google Fonts.
- **Storage**: `localStorage` keys prefixed `gwtf.*` for settings, theme, style, presets.
- **Browser support**: Any browser with ES module + `importmap` support (Chrome 89+, Firefox 108+, Safari 16.4+, Edge 89+).

---

## Key Algorithms

### Spiral Wall Generation
- Z increments continuously: `z_per_segment = layer_height / segments_per_rev`
- Gradual transition uses cubic ease-in-out from `baseLayerHeight` to `layerHeight`
- Flow ramps from 25% → 100% on the first revolution to prevent elephant's foot

### Wave Distortion
- Base shape: `sin(waveCount * theta + phase)`
- Shape morphing: sine → `tanh` square approximation → `asin` triangle
- Inter-layer interference: phase offset = `interference * π` per turn

### Blob Mode
- Blobs deposited at discrete angular positions around circumference
- Multi-pass hop pattern fills all slots with configurable stride
- Each blob: travel → lower → extrude up → dwell → retract → lift
- Optional vase-layer spiral bands interleaved every N blob layers

---

## Browser Storage Keys

| Key | Purpose |
|---|---|
| `gwtf.savedSettings` | Full parameter snapshot (JSON) |
| `gwtf.activeDesign` | Active preset tab ID |
| `gwtf.customFeatures` | User-defined JSON presets |
| `gwtf.theme` | Color theme (`midnight`, `cyberpunk`, `forest`, `arctic`) |
| `gwtf.style` | Layout style (`command`, `float`, `drawer`, `horizon`) |
| `gwtf.autoGenerate` | Auto-generate enabled flag |
| `gwtf.autoGenerateDelay` | Auto-generate debounce delay (ms) |

---

## Contributing

1. Fork this repository.
2. Open `index.html` in your browser — that's the entire dev workflow.
3. Make changes, refresh, test.
4. Submit a pull request.

No dependencies to install. No build commands.

---

## Version

**v0.1** — Initial public release.

---

## License

XD License

Next to come 
