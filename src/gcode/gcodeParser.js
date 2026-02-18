// src/gcode/gcodeParser.js
// Parsing settings out of our generated header + lightweight visualization parsing.

const SNAKE_TO_CAMEL = {
  // Geometry
  outer_d: 'outerD',
  top_outer_d: 'topOuterD',
  height: 'height',
  hole_d: 'holeD',
  base_layers: 'baseLayers',
  gradual_layers: 'gradualLayers',

  // Wave
  wave_amp: 'waveAmp',
  wave_count: 'waveCount',
  wave_shape: 'waveShape',
  interference: 'interference',
  phase_offset_per_turn: 'phaseOffsetPerTurn',

  // Z wave
  z_wave_mode: 'zWaveMode',
  z_wave_amp: 'zWaveAmp',
  z_wave_cycles: 'zWaveCycles',
  z_wave_max_amp: 'zWaveMaxAmp',
  z_wave_profile: 'zWaveProfile',

  // Base
  base_layer_height: 'baseLayerHeight',
  base_line_width: 'baseLineWidth',
  base_flow: 'baseFlow',
  base_nozzle_temp: 'baseNozzleTemp',
  base_bed_temp: 'baseBedTemp',
  base_print_speed: 'basePrintSpeed',
  base_pattern: 'basePattern',

  // Wall
  layer_height: 'layerHeight',
  line_width: 'lineWidth',
  flow: 'flow',
  nozzle_temp: 'nozzleTemp',
  bed_temp: 'bedTemp',
  print_speed: 'printSpeed',
  seam_align: 'seamAlign',

  // Common
  filament_d: 'filamentD',
  fan_percent: 'fanPercent',
  travel_speed: 'travelSpeed',

  // Advanced
  segments_per_rev: 'segmentsPerRev',
  bed_origin: 'bedOrigin',
  center_x: 'centerX',
  center_y: 'centerY',
  slow_down_time_ms: 'slowDownTimeMs',
  slow_down_length_mm: 'slowDownLengthMm',
  home: 'home',
  absolute_e: 'absoluteExtrusion',
  print_accel: 'printAccel',
  travel_accel: 'travelAccel',

  // IM-Vase blob
  wall_mode: 'wallMode',
  blob_dots_per_rev: 'blobDotsPerRev',
  blob_dot_height: 'blobDotHeight',
  blob_dot_extrusion: 'blobDotExtrusion',
  blob_dwell_ms: 'blobDwellMs',
  blob_extrude_speed: 'blobExtrudeSpeed',
  blob_retract_len: 'blobRetractLen',
  blob_retract_speed: 'blobRetractSpeed',
  blob_layer_offset: 'blobLayerOffset',
  blob_clearance_z: 'blobClearanceZ',
  blob_nozzle_temp: 'blobNozzleTemp',
  blob_fan_percent: 'blobFanPercent',
  blob_hops: 'blobHops',
  blob_offset_start: 'blobOffsetStart',
  blob_offset_end: 'blobOffsetEnd',
  blob_wave: 'blobWave',
  blob_transition_curvature: 'blobTransitionCurvature',
  blob_transition_path_increase: 'blobTransitionPathIncrease',
  blob_layer_transition_offset: 'blobLayerTransitionOffset',

  // Toolpath direction
  dir_alternation: 'dirAlternation',
  dir_alternation_n: 'dirAlternationN',
  start_direction: 'startDirection',

  // Vase layers on top of blobs
  blob_vase_layers: 'blobVaseLayers',
  blob_vl_every_n: 'blobVlEveryN',
  blob_vl_count: 'blobVlCount',
  blob_vl_walls: 'blobVlWalls',
  blob_vl_line_width: 'blobVlLineWidth',
  blob_vl_layer_height: 'blobVlLayerHeight',
  blob_vl_print_speed: 'blobVlPrintSpeed',
};

// Accept either snake_case or already-normalized camelCase
function normalizeKey(key) {
  if (SNAKE_TO_CAMEL[key]) return SNAKE_TO_CAMEL[key];
  return key;
}

function coerceValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'center' || v === 'corner') return v;
  if (v === 'aligned' || v === 'staggered' || v === 'random') return v;
  if (v === 'never' || v === 'every_turn' || v === 'every_n') return v;
  if (v === 'ccw' || v === 'cw') return v;
  if (v === 'vase' || v === 'blob') return v;
  if (v === 'off' || v === 'auto' || v === 'manual') return v;
  if (v === 'concentric' || v === 'rectilinear' || v === 'grid') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

export function parseGcodeSettings(gcodeText) {
  const lines = gcodeText.split('\n');
  const settings = {};

  for (const line of lines) {
    if (!line.startsWith(';')) continue;
    const match = line.match(/;\s*([\w_]+)=([^\s;]+)/);
    if (!match) continue;
    const [, rawKey, rawVal] = match;
    settings[normalizeKey(rawKey)] = coerceValue(rawVal);
  }

  // If the file was produced by us, we should have these
  const looksOurs =
    settings.outerD !== undefined &&
    settings.height !== undefined &&
    settings.waveAmp !== undefined;

  if (!looksOurs) return null;

  // Derive phaseOffsetPerTurn when only interference is present
  if (settings.phaseOffsetPerTurn === undefined && settings.interference !== undefined) {
    settings.phaseOffsetPerTurn = settings.interference * Math.PI;
  }

  // Extract custom start/end G-code from tagged blocks
  settings.customStartGcode = extractTaggedBlock(gcodeText, '; --- custom start gcode ---', '; --- end custom start gcode ---');
  settings.customEndGcode = extractTaggedBlock(gcodeText, '; --- custom end gcode ---', '; --- end custom end gcode ---');

  return settings;
}

/**
 * Extract text between two tag lines (exclusive of the tags themselves).
 * Returns the trimmed content or '' if the tags are not found.
 */
function extractTaggedBlock(text, openTag, closeTag) {
  const startIdx = text.indexOf(openTag);
  if (startIdx === -1) return '';
  const afterOpen = startIdx + openTag.length;
  const endIdx = text.indexOf(closeTag, afterOpen);
  if (endIdx === -1) return '';
  return text.substring(afterOpen, endIdx).trim();
}

export function parseGcodeForVisualization(gcodeText, settings = {}) {
  // Mock builder-compatible object: { extrudePoints, travelPoints, lines, e, p }
  const builder = {
    extrudePoints: [],
    travelPoints: [],
    lines: gcodeText.split('\n'),
    e: 0,
    p: settings,
  };

  let x = 0, y = 0, z = 0;
  let prevExtrudeX = 0, prevExtrudeY = 0, prevExtrudeZ = 0;
  let hadExtrude = false;

  for (const line of builder.lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;

    if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
      const xMatch = trimmed.match(/X(-?[\d.]+)/);
      const yMatch = trimmed.match(/Y(-?[\d.]+)/);
      const zMatch = trimmed.match(/Z(-?[\d.]+)/);
      const eMatch = trimmed.match(/E(-?[\d.]+)/);

      const hasE = eMatch !== null;

      if (xMatch) x = parseFloat(xMatch[1]);
      if (yMatch) y = parseFloat(yMatch[1]);
      if (zMatch) z = parseFloat(zMatch[1]);
      if (eMatch) builder.e = parseFloat(eMatch[1]);

      if (hasE) {
        // Push segment pair (from → to)
        builder.extrudePoints.push({ x: hadExtrude ? prevExtrudeX : x, y: hadExtrude ? prevExtrudeY : y, z: hadExtrude ? prevExtrudeZ : z });
        builder.extrudePoints.push({ x, y, z });
        prevExtrudeX = x; prevExtrudeY = y; prevExtrudeZ = z;
        hadExtrude = true;
      } else {
        builder.travelPoints.push({ x, y, z });
        // After a travel, next extrude starts from this position
        prevExtrudeX = x; prevExtrudeY = y; prevExtrudeZ = z;
      }
    }
  }

  return builder;
}

export function parseExternalGcode(gcodeText) {
  return parseGcodeForVisualization(gcodeText, {});
}
