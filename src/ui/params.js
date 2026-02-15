// src/ui/params.js
import { clamp } from '../utils/math.js';

// ============================================================
// READ PARAMS FROM UI
// ============================================================

export function readParams() {
  const val = (id) => parseFloat(document.getElementById(id).value) || 0;
  const intVal = (id) => parseInt(document.getElementById(id).value) || 0;
  const checked = (id) => document.getElementById(id).checked;
  const text = (id) => document.getElementById(id).value.trim();

  const interference = val('interference');

  return {
    outerD: Math.max(10, val('outer_d')),
    topOuterD: Math.max(10, val('top_outer_d')),
    height: clamp(val('height'), 10, 500),
    holeD: val('hole_d'),
    baseLayers: clamp(intVal('base_layers'), 1, 10),
    gradualLayers: clamp(intVal('gradual_layers'), 0, 20),

    waveAmp: Math.max(0, val('wave_amp')),
    waveCount: Math.max(0, intVal('wave_count')),
    waveShape: clamp(val('wave_shape'), 0, 1),
    phaseOffsetPerTurn: interference * Math.PI,

    zWaveAmp: val('z_wave_amp'),
    zWaveCycles: val('z_wave_cycles'),

    // Base layer settings
    basePattern: document.getElementById('base_pattern').value,
    baseLayerHeight: Math.max(0.05, val('base_layer_height')),
    baseLineWidth: Math.max(0.2, val('base_line_width')),
    baseFlow: Math.max(0.1, val('base_flow')),
    baseNozzleTemp: intVal('base_nozzle_temp'),
    baseBedTemp: intVal('base_bed_temp'),
    basePrintSpeed: Math.max(5, val('base_print_speed')),

    // Wall (vase mode) settings
    layerHeight: Math.max(0.05, val('layer_height')),
    lineWidth: Math.max(0.2, val('line_width')),
    flow: Math.max(0.1, val('flow')),
    nozzleTemp: intVal('nozzle_temp'),
    bedTemp: intVal('bed_temp'),
    printSpeed: Math.max(5, val('print_speed')),
    seamAlign: document.getElementById('seam_align')?.value || 'aligned',

    // Common settings
    filamentD: Math.max(1.0, val('filament_d')),
    fanPercent: clamp(intVal('fan_percent'), 0, 100),
    travelSpeed: Math.max(20, val('travel_speed')),

    segmentsPerRev: Math.max(120, intVal('segments_per_rev')),

    bedOrigin: document.getElementById('bed_origin').value,
    centerX: val('center_x'),
    centerY: val('center_y'),

    slowDownTimeMs: Math.max(0, val('slow_down_time_ms')),
    slowDownLengthMm: Math.max(0, val('slow_down_length_mm')),

    home: checked('home'),
    absoluteExtrusion: checked('absolute_e'),

    printAccel: Math.max(50, intVal('print_accel')),
    travelAccel: Math.max(50, intVal('travel_accel')),

    customStartGcode: text('custom_start_gcode'),
    customEndGcode: text('custom_end_gcode'),

    // Wall mode: 'vase' (spiral) or 'blob' (IM-Vase)
    wallMode: document.getElementById('wall_mode')?.value || 'vase',

    // IM-Vase blob settings
    blobDotsPerRev: Math.max(4, intVal('blob_dots_per_rev')),
    blobDotHeight: Math.max(0.3, val('blob_dot_height')),
    blobDotExtrusion: Math.max(0.1, val('blob_dot_extrusion')),
    blobDwellMs: Math.max(0, intVal('blob_dwell_ms')),
    blobExtrudeSpeed: Math.max(0.5, val('blob_extrude_speed')),
    blobRetractLen: Math.max(0, val('blob_retract_len')),
    blobRetractSpeed: Math.max(1, val('blob_retract_speed')),
    blobLayerOffset: val('blob_layer_offset'),
    blobClearanceZ: Math.max(0.5, val('blob_clearance_z')),
    blobNozzleTemp: intVal('blob_nozzle_temp'),
    blobFanPercent: clamp(intVal('blob_fan_percent'), 0, 100),

    // Blob hops & path shape
    blobHops: Math.max(0, intVal('blob_hops')),
    blobOffsetStart: val('blob_offset_start'),
    blobOffsetEnd: val('blob_offset_end'),
    blobWave: clamp(val('blob_wave'), -1, 1),

    // Vase layers on top of blobs
    blobVaseLayers: (document.getElementById('blob_vase_layers')?.value || 'no') === 'yes',
    blobVlEveryN: Math.max(1, intVal('blob_vl_every_n')),
    blobVlCount: clamp(intVal('blob_vl_count'), 0, 999),
    blobVlWalls: Math.max(1, intVal('blob_vl_walls')),
    blobVlLineWidth: Math.max(0.1, val('blob_vl_line_width')),
    blobVlLayerHeight: Math.max(0.05, val('blob_vl_layer_height')),
    blobVlPrintSpeed: Math.max(5, val('blob_vl_print_speed')),
  };
}

// ============================================================
// UI HELPERS
// ============================================================

function setWaveShapeLabel(shape) {
  const el = document.getElementById('wave_shape_val');
  if (!el) return;
  el.textContent =
    shape.toFixed(2) + (shape < 0.3 ? ' (sine)' : shape > 0.7 ? ' (square)' : ' (blend)');
}

function setInterferenceLabel(interf) {
  const el = document.getElementById('interference_val');
  if (!el) return;
  el.textContent =
    interf.toFixed(2) + (interf < 0.1 ? ' (aligned)' : interf > 0.9 ? ' (max gap)' : '');
}

function setFanLabel(pct) {
  const el = document.getElementById('fan_val');
  if (!el) return;
  el.textContent = `${pct}%`;
}

export function clampHoleDiameter() {
  const outerD = parseFloat(document.getElementById('outer_d').value) || 0;
  const holeD = parseFloat(document.getElementById('hole_d').value) || 0;
  const holeDInput = document.getElementById('hole_d');

  // Ensure hole diameter doesn't exceed bottom diameter
  if (holeD > outerD) {
    holeDInput.value = outerD;

    // Visual feedback
    holeDInput.style.borderColor = 'var(--orange)';
    setTimeout(() => { holeDInput.style.borderColor = ''; }, 500);
  }

  holeDInput.setAttribute('max', outerD);
}

export function resetDefaults() {
  const defaults = {
    outer_d: 100, top_outer_d: 100, height: 150, hole_d: 39,
    base_layers: 3, gradual_layers: 5, wave_amp: 1.5, wave_count: 14, wave_shape: 0,
    interference: 1, z_wave_amp: 0, z_wave_cycles: 0,

    // Base layer settings
    base_pattern: 'concentric',
    base_layer_height: 0.20, base_line_width: 0.4, base_flow: 1.0,
    base_nozzle_temp: 220, base_bed_temp: 60, base_print_speed: 20,

    // Wall settings
    layer_height: 0.45, line_width: 1.9, flow: 1.0,
    nozzle_temp: 215, bed_temp: 60, print_speed: 25,

    // Common settings
    filament_d: 1.75, fan_percent: 100, travel_speed: 120,

    segments_per_rev: 420, center_x: 0, center_y: 0,
    slow_down_time_ms: 0, slow_down_length_mm: 0,
    print_accel: 500, travel_accel: 1000,

    seam_align: 'aligned',

    // IM-Vase blob settings
    blob_dots_per_rev: 24, blob_dot_height: 2.0,
    blob_dot_extrusion: 4.0, blob_dwell_ms: 800,
    blob_extrude_speed: 2.0, blob_layer_offset: 0.5,
    blob_retract_len: 0, blob_retract_speed: 30,
    blob_clearance_z: 3.0, blob_nozzle_temp: 230,
    blob_fan_percent: 30,
    blob_hops: 0,
    blob_offset_start: 0,
    blob_offset_end: 0,
    blob_wave: 0,

    // Vase layers on top of blobs
    blob_vase_layers: 'no',
    blob_vl_every_n: 1,
    blob_vl_count: 1,
    blob_vl_walls: 1,
    blob_vl_line_width: 0.45,
    blob_vl_layer_height: 0.2,
    blob_vl_print_speed: 25,
  };

  for (const [id, v] of Object.entries(defaults)) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }

  document.getElementById('home').checked = true;
  document.getElementById('absolute_e').checked = true;
  document.getElementById('bed_origin').value = 'center';
  document.getElementById('base_pattern').value = 'concentric';
  if (document.getElementById('wall_mode')) document.getElementById('wall_mode').value = 'vase';
  if (document.getElementById('seam_align')) document.getElementById('seam_align').value = 'aligned';
  document.getElementById('custom_start_gcode').value = '';
  document.getElementById('custom_end_gcode').value = '';

  // Update range readouts
  document.getElementById('base_layers_val').textContent = '3';
  document.getElementById('gradual_layers_val').textContent = '5';
  setWaveShapeLabel(0);
  setInterferenceLabel(1);
  setFanLabel(100);

  clampHoleDiameter();
}

export function loadSettingsToUI(settings) {
  // settings are expected to be normalized (camelCase) by parseGcodeSettings
  const mapping = {
    outerD: 'outer_d',
    topOuterD: 'top_outer_d',
    height: 'height',
    holeD: 'hole_d',
    baseLayers: 'base_layers',
    gradualLayers: 'gradual_layers',

    waveAmp: 'wave_amp',
    waveCount: 'wave_count',
    waveShape: 'wave_shape',
    interference: 'interference',

    zWaveAmp: 'z_wave_amp',
    zWaveCycles: 'z_wave_cycles',

    baseLayerHeight: 'base_layer_height',
    baseLineWidth: 'base_line_width',
    baseFlow: 'base_flow',
    basePattern: 'base_pattern',
    baseNozzleTemp: 'base_nozzle_temp',
    baseBedTemp: 'base_bed_temp',
    basePrintSpeed: 'base_print_speed',

    layerHeight: 'layer_height',
    lineWidth: 'line_width',
    flow: 'flow',
    nozzleTemp: 'nozzle_temp',
    bedTemp: 'bed_temp',
    printSpeed: 'print_speed',
    seamAlign: 'seam_align',

    filamentD: 'filament_d',
    fanPercent: 'fan_percent',
    travelSpeed: 'travel_speed',

    segmentsPerRev: 'segments_per_rev',
    bedOrigin: 'bed_origin',
    centerX: 'center_x',
    centerY: 'center_y',
    slowDownTimeMs: 'slow_down_time_ms',
    slowDownLengthMm: 'slow_down_length_mm',
    printAccel: 'print_accel',
    travelAccel: 'travel_accel',
    customStartGcode: 'custom_start_gcode',
    customEndGcode: 'custom_end_gcode',
    wallMode: 'wall_mode',
    blobDotsPerRev: 'blob_dots_per_rev',
    blobDotHeight: 'blob_dot_height',
    blobDotExtrusion: 'blob_dot_extrusion',
    blobDwellMs: 'blob_dwell_ms',
    blobExtrudeSpeed: 'blob_extrude_speed',
    blobRetractLen: 'blob_retract_len',
    blobRetractSpeed: 'blob_retract_speed',
    blobLayerOffset: 'blob_layer_offset',
    blobClearanceZ: 'blob_clearance_z',
    blobNozzleTemp: 'blob_nozzle_temp',
    blobFanPercent: 'blob_fan_percent',
    blobHops: 'blob_hops',
    blobOffsetStart: 'blob_offset_start',
    blobOffsetEnd: 'blob_offset_end',
    blobWave: 'blob_wave',
    blobVaseLayers: 'blob_vase_layers',
    blobVlEveryN: 'blob_vl_every_n',
    blobVlCount: 'blob_vl_count',
    blobVlWalls: 'blob_vl_walls',
    blobVlLineWidth: 'blob_vl_line_width',
    blobVlLayerHeight: 'blob_vl_layer_height',
    blobVlPrintSpeed: 'blob_vl_print_speed',
  };

  for (const [key, id] of Object.entries(mapping)) {
    if (settings[key] === undefined) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    // blobVaseLayers is stored as boolean but UI select expects 'yes'/'no'
    if (key === 'blobVaseLayers') {
      el.value = settings[key] ? 'yes' : 'no';
    } else {
      el.value = settings[key];
    }
  }

  if (settings.home !== undefined) document.getElementById('home').checked = !!settings.home;
  if (settings.absoluteExtrusion !== undefined) document.getElementById('absolute_e').checked = !!settings.absoluteExtrusion;

  // Update display values for sliders
  if (settings.baseLayers !== undefined) document.getElementById('base_layers_val').textContent = String(settings.baseLayers);
  if (settings.gradualLayers !== undefined) document.getElementById('gradual_layers_val').textContent = String(settings.gradualLayers);
  if (settings.fanPercent !== undefined) setFanLabel(settings.fanPercent);
  if (settings.waveShape !== undefined) setWaveShapeLabel(settings.waveShape);
  if (settings.interference !== undefined) setInterferenceLabel(settings.interference);

  // Sync wall-mode section visibility
  syncWallModeUI();
  syncBlobVaseLayersUI();

  clampHoleDiameter();
}

/** Show/hide blob vs wave sections based on wall_mode value */
export function syncWallModeUI() {
  const mode = document.getElementById('wall_mode')?.value || 'vase';
  const blobSec = document.getElementById('sec-blob');
  const waveSec = document.getElementById('sec-wave');
  const zwaveSec = document.getElementById('sec-zwave');
  if (blobSec)  blobSec.style.display  = mode === 'blob' ? '' : 'none';
  if (waveSec)  waveSec.style.display   = mode === 'vase' ? '' : 'none';
  if (zwaveSec) zwaveSec.style.display  = mode === 'vase' ? '' : 'none';
}

/** Show/hide vase-layer options inside blob section */
export function syncBlobVaseLayersUI() {
  const enabled = document.getElementById('blob_vase_layers')?.value === 'yes';
  const opts = document.getElementById('blob-vase-layers-opts');
  if (opts) opts.style.display = enabled ? '' : 'none';
}
