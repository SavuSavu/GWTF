# Project Notes

This `notes.md` file is the **single source of truth** for how this project is designed, how it works, and how it evolves over time.
If future-you (or someone else) asks *“why is this like this?”*, the answer should live here.

---

## Purpose of the Refactor

The original project lived in a single, very large `index.html` file.
While functional, it became hard to:
- reason about changes,
- safely modify features,
- understand data flow,
- reuse or extend parts (UI, G-code logic, preview).

The refactor splits responsibilities into **clear, intentional modules**, without changing behavior.
No logic was rewritten “just because” — only **moved and grouped**.

---

## High-Level Architecture

```
index.html        → Structure + UI wiring
styles/           → All visual styling
src/main.js       → App entry point & orchestration
src/ui/           → UI state, parameters, actions, stats
src/gcode/        → G-code generation & parsing
src/preview/      → Three.js preview & simulation
src/utils/        → Shared math/helpers
```

Think of it as:

- **UI decides *what***
- **G-code decides *how***
- **Preview decides *what it looks like***

---

## File & Folder Responsibilities

### `index.html`
- Pure structure: inputs, buttons, canvas, layout
- Still uses inline handlers (`onclick`, `oninput`) for now
- Loads JS via ES modules + import map

No logic should be added here anymore.

---

### `styles/app.css`
- All styles extracted from `<style>` blocks
- Safe place to tweak layout, colors, spacing, UI polish
- No JS assumptions

---

### `src/main.js`
**The brain glue.**
- Initializes the app
- Connects UI → G-code → Preview
- Exposes functions to `window` so inline HTML handlers still work
- Handles generate / import / reset flows

If something needs access to “everything”, it probably belongs here.

---

### `src/ui/`
UI is intentionally dumb — it **reads values and displays results**, nothing else.

- `params.js`
  - Reads parameters from inputs
  - Applies defaults & clamping
- `actions.js`
  - Download, copy, reset, import triggers
- `stats.js`
  - Layer count, time estimate, filament usage

UI does *not* generate G-code directly.

---

### `src/gcode/`
This is the **engine room**.

- `gcodeBuilder.js`
  - All wave math
  - Extrusion calculations
  - Header + body generation
- `gcodeParser.js`
  - Reads settings from G-code comments
  - Normalizes `snake_case → camelCase`
  - Allows round-trip editing (generate → import → tweak)

If the print changes shape, speed, or material usage — look here.

---

### `src/preview/`
- `threePreview.js`
  - Three.js setup
  - Toolpath visualization
  - Layer slider
  - Animation / simulation

Preview uses **parsed geometry**, not UI inputs directly.

---

### `src/utils/`
- Shared helpers (math, clamps, conversions)
- No side effects
- Safe to reuse anywhere

---

## Data Flow (Important)

```
UI Inputs
   ↓
params.js
   ↓
main.js
   ↓
GCodeBuilder
   ↓
G-code string
   ↓
Preview + Stats + Download
```

**Import flow reverses this**:
```
G-code file
   ↓
gcodeParser.js
   ↓
UI parameters restored
   ↓
Preview regenerated
```

This symmetry is intentional.

---

## Design Rules Going Forward

- ❌ Don’t put logic back into `index.html`
- ❌ Don’t let UI compute geometry
- ✅ One module = one responsibility
- ✅ Changes should touch *one folder*, not five
- ✅ If behavior changes, document it here

---

## Future Improvements (Ideas)

- Replace inline HTML handlers with event listeners
- Add unit tests for G-code math
- Support presets (JSON-based)
- Add export profiles (printer-specific)
- Decouple preview resolution from G-code resolution

---

## Change Log

### Refactor v1
- Split monolithic HTML into modular structure
- Preserved behavior 1:1
- Fixed G-code import field mismatch
- Improved long-term maintainability

### GWTF Platform Expansion
- Added landing page layout with scroll-to-designer flow
- Introduced design presets (vase, lampshade, phone stand) with preset tabs
- Added custom feature JSON editor + local feature library export/import
- Persisted UI settings to browser storage for quick restore
- Updated UI branding to “G-code Designer”

### Editor UI Cleanup + Wave Shape Remap
- Removed the in-editor header branding to minimize distractions
- Moved Reset/Import/Generate/Download into the preview/G-code tab bar
- Hid feature import/export actions unless the Custom tab is active
- Replaced design explanations with hover tooltips on design tabs
- Remapped wave shape control to spiral (0), square (0.5), triangle (1)

### Vase Mode UX Refresh + Auto-Generate
- Removed the Phone Stand preset and consolidated modes under the Vase group
- Added a Vase submenu with Vase Mode, Blob Mode (IM-Vase), and Lamp Shade
- Merged Slow Down Zones into Wave Pattern and highlighted zones in the 3D preview
- Added mode-aware highlights (Lamp Shade hole diameter, Blob Mode section)
- Added auto-generate debounce (500ms) and auto-disable if generation takes >15s
- Added compact stats panel (top-right) with expandable details
- Added return banner for existing sessions with “Keep working / Start new”
- Auto-scrolls to the designer when a previous session is detected
- Expanded return banner to force a decision and added export+new option
- Added transfer-settings modal for printer-related settings on new project start

### Blob Mode Transition Safety + Curved Travel Controls
- Refactored blob-to-blob motion to enforce a collision-safe sequence:
  - finish blob extrusion,
  - dwell,
  - lift to safe Z,
  - travel in XY only at safe Z,
  - descend vertically to next blob start,
  - begin extrusion only during the vertical blob rise.
- Removed the previous angled down-and-forward transition behavior that could collide when clearance was low.
- Added new Blob Mode controls for transition shaping:
  - `blob_transition_curvature` (`-1.0 … +1.0`, default `0`)
  - `blob_transition_path_increase` (`0 … 50 mm`, default `0`)
  - `blob_layer_transition_offset` (`-5 … +5 mm`, default `0`)
- Added XY arc generation for blob-to-blob travel at safe Z:
  - `curvature = 0` keeps straight travel,
  - `curvature ≠ 0` uses curved travel,
  - `pathIncrease` increases arc magnitude / travel length when curvature is active.
- Improved inter-layer continuity by selecting and rotating each layer’s blob start index relative to the previous layer’s last blob, then biasing it with `blob_layer_transition_offset`.
- Preserved hop behavior and existing blob deposition logic while making transition planning modular.
- Added round-trip support for all new settings:
  - header emission in G-code,
  - parser mapping (`snake_case → camelCase`),
  - UI read/default/load mapping,
  - preset defaults,
  - help-tip descriptions.
- Updated Blob Settings UI with explicit controls for Layer Transition Offset, Transition Curvature, and Transition Path Increase.

(Add future changes below 👇)

---

## Research: How Real Slicers Handle Vase Mode Base → Spiral Transition

> Source code analysis of CuraEngine (Ultimaker/CuraEngine) and PrusaSlicer (prusa3d/PrusaSlicer).
> OrcaSlicer is a fork of PrusaSlicer/BambuStudio—its spiral vase logic is essentially the same as PrusaSlicer's.

---

### 1. Bottom Solid Layers — What Gets Printed Before the Spiral

**CuraEngine**
- Setting: `initial_bottom_layers` (integer, number of flat layers before spiral starts).
- Bottom layers are printed **normally**: perimeters use Arachne variable-width wall toolpaths (`wall_toolpaths`), infill/skin is generated with the standard fill pipeline (rectilinear, monotonic, etc., depending on `top_bottom_pattern_0` / `top_bottom_pattern`).
- On the last bottom layer, the surface type is forced to `stTop` so it prints with the top-surface pattern (typically monotonic lines) for a nice finish before the spiral begins.
- During spiral mode the slicer **closes all holes** and keeps only the largest contour per layer. This is applied at slice time, not G-code time.
- When `spiral_vase` is on the UI forces: `top_solid_layers=0`, `fill_density=0`, `support=off`, `thin_walls=off`, `perimeters=1`.

**PrusaSlicer / OrcaSlicer**
- Setting: `bottom_solid_layers` + `bottom_solid_min_thickness` (can define by count or minimum mm).
- Bottom layers are sliced in `SlicingMode::Regular` (normal closed polygons) while layers above switch to the spiralize contour mode.
- The last bottom layer's fill surfaces are re-typed to `stTop` so that the top fill pattern is used for the final flat layer.
- All layers above the bottom count have their surface type set to `stInternal` (no top/bottom skin, just the single spiral wall).
- Like Cura, PrusaSlicer also enforces: 1 perimeter, 0% infill, 0 top layers, no support.

**Key takeaway for GWTF:** Base layers are just normal layers (perimeters + solid infill). The slicer doesn't use a special "base fill pattern"—it uses whatever the user's solid-fill/top-fill pattern settings are. The transition layer gets the top-surface treatment.

---

### 2. Z-Height Transition: How the Nozzle Goes From Flat to Spiral

**CuraEngine** (the more explicit approach)
- On the layer where `layer_nr == initial_bottom_layers` (the first "spiral" layer), the engine does a **two-pass trick**:
  1. First, it prints the outer wall **normally at the current Z** (flat, closed loop). This gives a complete perimeter sitting on top of the last solid layer.
  2. Then it starts a **second outer wall from the same Z** that gradually ramps upward over its circumference—this is the beginning of the true spiral.
- The second wall starts at the pre-computed seam vertex so the transition is seamless.
- From the next layer onward, `spiralizeWallSlice()` handles full spiral layers: Z increases linearly with `factor = len / total_layer_length`, so `new_z = layer_bottom_z + factor * layer_height`.

**PrusaSlicer / OrcaSlicer** (post-process approach)
- PrusaSlicer generates layers normally (each layer as a flat closed loop), then a **post-processing filter** (`SpiralVase::process_layer()`) rewrites the G-code:
  - It removes the initial Z-move at the top of each layer and replaces it with a redundant move to the *previous* layer's Z.
  - As it walks extrusion moves, it computes `factor = accumulated_XY_length / total_layer_length` and sets `Z = layer_start_z + factor * layer_height`.
  - The result: Z climbs smoothly from the bottom of the layer to the top over one revolution.
- The filter tracks an `m_enabled` flag. It only activates *after* the bottom layers are done. The first spiral layer is tagged as a **transition layer** (`m_transition_layer = true`).

**Key takeaway for GWTF:** Both approaches split Z evenly over the perimeter circumference. For our G-code builder this means: on each spiral layer, calculate `z_increment_per_segment = layer_height / segments_per_revolution` and add it to every G1 move.

---

### 3. Preventing the First Spiral Layer from Squishing (Flow Ramping)

This is the most critical technique for print quality.

**CuraEngine**
- In `spiralizeWallSlice()`, when `is_bottom_layer` is true:
  ```
  min_bottom_layer_flow = 0.25
  flow = 0.25 + (1.0 - 0.25) * (wall_length_so_far / total_wall_length)
  ```
  - At the seam (start of spiral): flow = **25%**
  - By the end of the first revolution: flow = **100%**
- Comment in source: *"avoid creating a big elephant's foot by starting with a reduced flow and increasing the flow so that by the time the end of the first spiral is complete, the flow is 100%"*
- For the **top layer** (last spiral layer), the same technique runs in reverse:
  ```
  min_top_layer_flow = 0.25
  flow ramps from 100% → 25%
  then 10mm of coasting (zero extrusion)
  ```

**PrusaSlicer / OrcaSlicer**
- On the **transition layer** (`m_transition_layer`), extrusion values are scaled by `factor`:
  ```
  line.set(E, line.e() * factor)
  ```
  where `factor` goes from 0.0 → 1.0 over the layer's circumference.
  - This means the transition layer starts at **0% flow** and ramps to **100%** over one revolution.
- On the **last layer** (`transition_out`), flow is reversed:
  ```
  line.set(E, line.e() * (1.0 - factor))
  ```
  So the last spiral layer tapers from 100% → 0%.
- Note: These ramps only work when `use_relative_e_distances` is enabled.

**Key takeaway for GWTF:** We should implement a flow ramp on the first spiral layer. A simple linear ramp from ~25% to 100% over the first revolution prevents the "double-height blob" at the transition. Consider also ramping down on the last layer for a clean top finish.

---

### 4. Nozzle Size and Base Layer Generation

Neither slicer has special vase-mode logic for nozzle size in base layers. Instead:

**CuraEngine**
- Base layers use standard wall/infill generation with `wall_line_width_0` for the outer wall and `wall_line_width_x` for inner walls.
- First layer widths can be scaled by `initial_layer_line_width_factor` (default 100%).
- `initial_layer_height` (often 0.2–0.3mm regardless of nozzle) sets the first layer Z.

**PrusaSlicer / OrcaSlicer**
- Uses `Flow` objects that compute extrusion width from nozzle diameter, layer height, and the flow role (`frExternalPerimeter`, `frPerimeter`, `frSolidInfill`, etc.).
- In spiral mode, the **smooth_spiral** XY interpolation radius is set to `2 * max_nozzle_diameter`. This limits how far the XY position can blend between layers.
- No per-layer nozzle-size-dependent changes to the base.

**Key takeaway for GWTF:** Nozzle size affects line width calculation (and thus wall thickness), but base layers in vase mode aren't treated differently than in normal printing. For our builder, `nozzle_d` already determines extrusion width; no additional base-specific logic is needed.

---

### 5. Transition Seam: Where the Last Flat Layer Meets the First Spiral

**CuraEngine** (dedicated seam tracking)
- `findLayerSeamsForSpiralize()` pre-computes a seam vertex index for every spiral layer:
  - First spiral layer: uses the vertex closest to the user's z-seam preference (or `(0,0)` if unset).
  - Subsequent layers: finds the vertex on the current wall closest to the *previous* layer's seam vertex, then verifies the next vertex is **to the left** (anti-clockwise) so the spiral direction stays consistent.
- On the transition layer (`layer_nr == initial_bottom_layers`):
  1. The flat outer wall is printed starting at the spiral's seam vertex.
  2. The spiral wall then starts from the **same vertex**, so there's no travel move or gap.
- `smooth_spiralized_contours`: when enabled, XY coordinates on each spiral layer are **interpolated** between the current layer's wall outline and the previous layer's outline. This smooths out Z-seam-like artifacts. *Not* applied to the first spiral layer (since it sits directly on a normal wall with the same outline).

**PrusaSlicer / OrcaSlicer** (G-code post-processing)
- The G-code filter **skips travel moves** between the end of the bottom layer and the start of the spiral. Comment in source: *"skip travel moves: the move to first perimeter point will cause a visible seam when loops are not aligned in XY; by skipping it we blend the first loop move in the XY plane"*.
- **Smooth spiral** (`m_smooth_spiral`): for non-transition layers, uses an AABB-tree distance query to find the nearest point on the *previous* layer's wall outline and interpolates XY position:
  ```
  target = nearest_on_prev_layer * (1 - factor) + current_point * factor
  ```
  with `max_xy_smoothing = 2 * max_nozzle_diameter` as the distance limit.
- Extrusion is rescaled proportionally to the change in segment length from the XY interpolation.
- The previous layer's XY point cloud is stored in `m_previous_layer` for the next layer's interpolation.

**Key takeaway for GWTF:** The seam position should be consistent between the last flat wall and the first spiral. Starting the spiral at the same vertex as the flat wall's start eliminates a visible blob. XY smoothing between layers is a nice refinement but not essential for a first implementation.

---

### Summary: What GWTF Should Implement

| Feature | Priority | What to do |
|---|---|---|
| Bottom solid layers count | High | Already have `baseLayers` param; generate those as flat layers with full Z-step |
| Z ramping on spiral layers | High | Divide `layer_height` evenly across `segments_per_rev` G1 moves |
| Flow ramp on first spiral layer | High | Ramp E multiplier from ~0.25 → 1.0 over first revolution |
| Transition wall (Cura-style) | Medium | Optionally print one flat perimeter at the spiral start Z before starting the spiral |
| Seam alignment | Medium | Start the spiral at the same angular position where the last flat layer ends |
| XY smoothing between spiral layers | Low | Interpolate XY toward previous layer's contour (cosmetic improvement) |
| Flow taper on last layer | Low | Ramp E from 1.0 → 0.25 + coast for clean top |
| Top surface pattern on last base layer | Low | Use monotonic/concentric fill for the final flat layer |
