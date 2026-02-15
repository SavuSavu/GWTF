# Copilot instructions for GWTF (G-code Designer)

## Big picture / architecture
- Single-page static app: index.html wires UI and inline handlers; logic lives in ES modules under src/.
- Data flow is intentionally one-way: UI → params → G-code → preview/stats. Import reverses that by parsing header comments.
- Key modules and boundaries:
  - src/main.js orchestrates generate/import flows and exposes handlers to window for inline HTML hooks.
  - src/ui/ handles UI reads/writes only (no geometry): params.js (read/defaults/clamp), actions.js (download/copy/tab/section), stats.js (derived metrics).
  - src/gcode/ is the engine: gcodeBuilder.js builds lines + extrudePoints; gcodeParser.js round-trips settings from header comments.
  - src/preview/threePreview.js renders toolpath and sim controls using extrudePoints.

## Critical patterns and conventions
- Inline handlers in index.html call globals set in src/main.js (e.g., window.generate, window.toggleSection). Keep new handlers exported there.
- G-code header comments are the source of truth for import; keys are snake_case in file and normalized to camelCase in parser.
  - Example header keys: outer_d, wave_amp, base_layer_height, segments_per_rev (see src/gcode/gcodeBuilder.js).
- Presets and user settings live in localStorage with keys: gwtf.savedSettings, gwtf.activeDesign, gwtf.customFeatures (see src/ui/presets.js).
- Theme preference stored in localStorage key: gwtf.theme (see inline script in index.html).
- Preview expects builder-like objects with extrudePoints, travelPoints, lines, e; use parseGcodeForVisualization for imports.

## Developer workflow
- No build step or bundler; run by opening index.html in a browser.
- Three.js is loaded via importmap from CDN in index.html; keep imports ESM-compatible (e.g., three/addons/...).

## Where to make changes
- New geometry or print behavior: src/gcode/gcodeBuilder.js and header parsing in src/gcode/gcodeParser.js.
- UI parameter changes (inputs/ids): update index.html and map in src/ui/params.js (readParams/loadSettingsToUI/defaults).
- Preview/simulation behavior: src/preview/threePreview.js.
- Presets/features: src/ui/presets.js (DEFAULT_PRESETS and feature JSON handling).

## Examples of existing patterns
- `generate()` in src/main.js: readParams → GCodeBuilder.build() → updatePreview/updateStatistics.
- Import flow: parseGcodeSettings → loadSettingsToUI → parseGcodeForVisualization → updatePreview.
