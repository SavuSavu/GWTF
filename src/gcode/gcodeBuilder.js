// src/gcode/gcodeBuilder.js
import { fmt, clamp, lerp } from '../utils/math.js';

// ============================================================
// EXTRUSION + WAVE HELPERS
// ============================================================

export function extrusionPerMm(lineWidth, layerHeight, filamentD, flow) {
  const filamentArea = Math.PI * Math.pow(filamentD * 0.5, 2);
  return (lineWidth * layerHeight / filamentArea) * flow;
}

// Ported from original: waveRadius(baseR, theta, turnIndex, params)
export function waveRadius(baseR, theta, turnIndex, params) {
  if (params.waveAmp <= 0 || params.waveCount <= 0) return baseR;
  const phase = turnIndex * params.phaseOffsetPerTurn;
  const angle = params.waveCount * theta + phase;
  const raw = Math.sin(angle);

  // Shape blending: 0=sine (spiral wave), 0.5=square-ish, 1=triangle
  const shape = clamp(params.waveShape, 0, 1);
  const squareK = 8.0;
  const square = Math.tanh(squareK * raw) / Math.tanh(squareK);
  const triangle = (2 / Math.PI) * Math.asin(raw);

  let shaped = 0;
  if (shape <= 0) {
    shaped = raw;
  } else if (shape < 0.5) {
    shaped = lerp(raw, square, shape / 0.5);
  } else if (shape < 1) {
    shaped = lerp(square, triangle, (shape - 0.5) / 0.5);
  } else {
    shaped = triangle;
  }

  return baseR + params.waveAmp * shaped;
}

// ============================================================
// G-CODE BUILDER
// ============================================================

export class GCodeBuilder {
  constructor(params) {
    this.p = params;
    this.lines = [];
    this.x = 0; this.y = 0; this.z = 0; this.e = 0;

    // Extrusion rates for base + wall
    this.baseEPerMm = extrusionPerMm(params.baseLineWidth, params.baseLayerHeight, params.filamentD, params.baseFlow);
    this.wallEPerMm = extrusionPerMm(params.lineWidth, params.layerHeight, params.filamentD, params.flow);
    this.ePerMm = this.baseEPerMm; // start with base settings

    // For 3D preview
    this.extrudePoints = [];
    this.travelPoints = [];
  }

  w(s) { this.lines.push(s); }

  header() {
    const p = this.p;

    // Regeneratable header (key=value in comments)
    this.w('; ===================================================');
    this.w('; WAVY VASE LAMPSHADE G-CODE');
    this.w('; Generated: ' + new Date().toISOString());
    this.w('; ===================================================');
    this.w('; ');
    this.w('; GEOMETRY SETTINGS:');
    this.w(`; outer_d=${p.outerD}`);
    this.w(`; top_outer_d=${p.topOuterD}`);
    this.w(`; height=${p.height}`);
    this.w(`; hole_d=${p.holeD}`);
    this.w(`; base_layers=${p.baseLayers}`);
    this.w(`; gradual_layers=${p.gradualLayers}`);
    this.w('; ');
    this.w('; WAVE PATTERN:');
    this.w(`; wave_amp=${p.waveAmp}`);
    this.w(`; wave_count=${p.waveCount}`);
    this.w(`; wave_shape=${p.waveShape}`);
    this.w(`; interference=${fmt(p.phaseOffsetPerTurn / Math.PI)}`);
    this.w(`; phase_offset_per_turn=${fmt(p.phaseOffsetPerTurn)}`);
    this.w('; ');
    this.w('; Z-WAVE CONTOUR:');
    this.w(`; z_wave_amp=${p.zWaveAmp}`);
    this.w(`; z_wave_cycles=${p.zWaveCycles}`);
    this.w('; ');
    this.w('; BASE LAYER SETTINGS:');
    this.w(`; base_layer_height=${p.baseLayerHeight}`);
    this.w(`; base_line_width=${p.baseLineWidth}`);
    this.w(`; base_flow=${p.baseFlow}`);
    this.w(`; base_nozzle_temp=${p.baseNozzleTemp}`);
    this.w(`; base_bed_temp=${p.baseBedTemp}`);
    this.w(`; base_print_speed=${p.basePrintSpeed}`);
    this.w(`; base_pattern=${p.basePattern}`);
    this.w('; ');
    this.w('; WALL (VASE MODE) SETTINGS:');
    this.w(`; layer_height=${p.layerHeight}`);
    this.w(`; line_width=${p.lineWidth}`);
    this.w(`; flow=${p.flow}`);
    this.w(`; nozzle_temp=${p.nozzleTemp}`);
    this.w(`; bed_temp=${p.bedTemp}`);
    this.w(`; print_speed=${p.printSpeed}`);
    this.w(`; seam_align=${p.seamAlign || 'aligned'}`);
    this.w('; ');
    this.w('; COMMON SETTINGS:');
    this.w(`; filament_d=${p.filamentD}`);
    this.w(`; fan_percent=${p.fanPercent}`);
    this.w(`; travel_speed=${p.travelSpeed}`);
    this.w('; ');
    this.w('; SLOW DOWN ZONES:');
    this.w(`; slow_down_time_ms=${p.slowDownTimeMs}`);
    this.w(`; slow_down_length_mm=${p.slowDownLengthMm}`);
    this.w('; ');
    this.w('; ADVANCED:');
    this.w(`; segments_per_rev=${p.segmentsPerRev}`);
    this.w(`; bed_origin=${p.bedOrigin}`);
    this.w(`; center_x=${p.centerX}`);
    this.w(`; center_y=${p.centerY}`);
    this.w(`; home=${p.home}`);
    this.w(`; absolute_e=${p.absoluteExtrusion}`);
    this.w(`; print_accel=${p.printAccel}`);
    this.w(`; travel_accel=${p.travelAccel}`);
    this.w('; ');
    this.w('; IM-VASE BLOB SETTINGS:');
    this.w(`; wall_mode=${p.wallMode || 'vase'}`);
    this.w(`; blob_dots_per_rev=${p.blobDotsPerRev}`);
    this.w(`; blob_dot_height=${p.blobDotHeight}`);
    this.w(`; blob_dot_extrusion=${p.blobDotExtrusion}`);
    this.w(`; blob_dwell_ms=${p.blobDwellMs}`);
    this.w(`; blob_extrude_speed=${p.blobExtrudeSpeed}`);
    this.w(`; blob_retract_len=${p.blobRetractLen || 0}`);
    this.w(`; blob_retract_speed=${p.blobRetractSpeed || 30}`);
    this.w(`; blob_layer_offset=${p.blobLayerOffset}`);
    this.w(`; blob_clearance_z=${p.blobClearanceZ}`);
    this.w(`; blob_nozzle_temp=${p.blobNozzleTemp}`);
    this.w(`; blob_fan_percent=${p.blobFanPercent}`);
    this.w(`; blob_hops=${p.blobHops}`);
    this.w(`; blob_offset_start=${p.blobOffsetStart}`);
    this.w(`; blob_offset_end=${p.blobOffsetEnd}`);
    this.w(`; blob_wave=${p.blobWave}`);
    this.w(`; blob_transition_curvature=${p.blobTransitionCurvature || 0}`);
    this.w(`; blob_transition_path_increase=${p.blobTransitionPathIncrease || 0}`);
    this.w(`; blob_layer_transition_offset=${p.blobLayerTransitionOffset || 0}`);
    this.w('; ');
    this.w('; VASE LAYERS ON BLOBS:');
    this.w(`; blob_vase_layers=${p.blobVaseLayers}`);
    this.w(`; blob_vl_every_n=${p.blobVlEveryN}`);
    this.w(`; blob_vl_count=${p.blobVlCount}`);
    this.w(`; blob_vl_walls=${p.blobVlWalls}`);
    this.w(`; blob_vl_line_width=${p.blobVlLineWidth}`);
    this.w(`; blob_vl_layer_height=${p.blobVlLayerHeight}`);
    this.w(`; blob_vl_print_speed=${p.blobVlPrintSpeed}`);
    this.w('; ===================================================');
    this.w('');

    if (p.customStartGcode) {
      this.w('; --- custom start gcode ---');
      this.w(p.customStartGcode);
      this.w('G92 E0');
      this.e = 0;
      return;
    }

    // Default start G-code
    this.w('; --- start gcode ---');
    this.w('G21 ; mm');
    this.w('G90 ; absolute XYZ');
    this.w(p.absoluteExtrusion ? 'M82 ; absolute extrusion' : 'M83 ; relative extrusion');
    this.w('G92 E0');

    this.w(`M140 S${p.baseBedTemp} ; base bed temp`);
    this.w(`M104 S${p.baseNozzleTemp} ; base nozzle temp`);
    this.w(`M190 S${p.baseBedTemp}`);
    this.w(`M109 S${p.baseNozzleTemp}`);

    if (p.home) this.w('G28');

    // Acceleration
    if (p.printAccel || p.travelAccel) {
      this.w(`M204 P${p.printAccel || 500} T${p.travelAccel || 1000} ; print / travel accel`);
    }

    this.w(`M106 S${Math.round(clamp(p.fanPercent, 0, 100) * 255 / 100)}`);
    this.w('G92 E0');
    this.e = 0;
  }

  footer() {
    if (this.p.customEndGcode) {
      this.w('; --- custom end gcode ---');
      this.w(this.p.customEndGcode);
      return;
    }

    this.w('; --- end gcode ---');
    this.w('M104 S0');
    this.w('M140 S0');
    this.w('M106 S0');
    this.w('G91');
    this.w('G1 Z10 F3000');
    this.w('G90');
    this.w('G1 X0 Y0 F6000');
    this.w('M84');
  }

  move(x, y, z, f) {
    const parts = ['G0'];
    if (x !== null && x !== undefined) { this.x = x; parts.push(`X${fmt(x)}`); }
    if (y !== null && y !== undefined) { this.y = y; parts.push(`Y${fmt(y)}`); }
    if (z !== null && z !== undefined) { this.z = z; parts.push(`Z${fmt(z)}`); }
    if (f !== null && f !== undefined) { parts.push(`F${Math.round(f * 60)}`); }
    this.w(parts.join(' '));
    this.travelPoints.push({ x: this.x, y: this.y, z: this.z });
  }

  extrudeTo(x, y, z, f) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const de = dist * this.ePerMm;
    let eField;

    if (this.p.absoluteExtrusion) {
      this.e += de;
      eField = `E${fmt(this.e)}`;
    } else {
      eField = `E${fmt(de)}`;
    }

    const fromX = this.x, fromY = this.y, fromZ = this.z;
    this.x = x; this.y = y; this.z = z;
    this.w(`G1 X${fmt(x)} Y${fmt(y)} Z${fmt(z)} ${eField} F${Math.round(f * 60)}`);
    // Push segment pair (from → to) so the preview can render discrete segments
    this.extrudePoints.push({ x: fromX, y: fromY, z: fromZ });
    this.extrudePoints.push({ x, y, z });
  }

  // ============================================================
  // BASE LAYER PATTERNS (flat – no wave distortion)
  // ============================================================

  /** Circular perimeter at given radius. direction: 1 = CCW, -1 = CW */
  basePerimeter(cx, cy, z, radius, direction = 1) {
    const steps = this.p.segmentsPerRev;
    this.move(cx + radius, cy, z, this.p.travelSpeed);
    for (let i = 1; i <= steps; i++) {
      const theta = direction * 2 * Math.PI * (i / steps);
      this.extrudeTo(
        cx + radius * Math.cos(theta),
        cy + radius * Math.sin(theta),
        z, this.p.basePrintSpeed
      );
    }
  }

  /** Concentric Archimedean-spiral fill (no waves) */
  baseConcentricFill(cx, cy, z, innerR, outerR) {
    const p = this.p;
    const pitch = p.baseLineWidth;
    if (outerR <= innerR + pitch) return;

    const a = Math.max(innerR, pitch * 0.5);
    const b = pitch / (2 * Math.PI);
    const thetaEnd = (outerR - a) / b;

    this.move(cx + a, cy, z, p.travelSpeed);
    const steps = Math.max(250, Math.round(thetaEnd * p.segmentsPerRev / (2 * Math.PI)));
    for (let i = 1; i <= steps; i++) {
      const theta = thetaEnd * (i / steps);
      const r = a + b * theta;
      this.extrudeTo(
        cx + r * Math.cos(theta),
        cy + r * Math.sin(theta),
        z, p.basePrintSpeed
      );
    }
  }

  /** Helper: rectilinear line-segments clipped to an annulus */
  _rectilinearSegments(innerR, outerR, angle, spacing) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const lines = [];
    const n = Math.ceil(outerR / spacing);
    for (let k = -n; k <= n; k++) {
      const d = k * spacing;
      if (Math.abs(d) >= outerR) continue;
      const oh = Math.sqrt(outerR * outerR - d * d);
      const segs = [];
      if (innerR > 0 && Math.abs(d) < innerR) {
        const ih = Math.sqrt(innerR * innerR - d * d);
        segs.push({ s: -oh, e: -ih });
        segs.push({ s: ih, e: oh });
      } else {
        segs.push({ s: -oh, e: oh });
      }
      lines.push({ d, segs, cosA, sinA });
    }
    return lines;
  }

  /** Extrude rectilinear segments in zigzag order */
  _extrudeLines(cx, cy, z, lines) {
    let fwd = true;
    for (const ln of lines) {
      const ordered = fwd ? ln.segs : [...ln.segs].reverse();
      for (const seg of ordered) {
        const sT = fwd ? seg.s : seg.e;
        const eT = fwd ? seg.e : seg.s;
        this.move(
          cx + sT * ln.cosA - ln.d * ln.sinA,
          cy + sT * ln.sinA + ln.d * ln.cosA,
          z, this.p.travelSpeed
        );
        this.extrudeTo(
          cx + eT * ln.cosA - ln.d * ln.sinA,
          cy + eT * ln.sinA + ln.d * ln.cosA,
          z, this.p.basePrintSpeed
        );
      }
      fwd = !fwd;
    }
  }

  /** Rectilinear fill – alternates 0° / 90° each layer */
  baseRectilinearFill(cx, cy, z, innerR, outerR, layerIdx) {
    const angle = layerIdx % 2 === 0 ? 0 : Math.PI / 2;
    this._extrudeLines(cx, cy, z,
      this._rectilinearSegments(innerR, outerR, angle, this.p.baseLineWidth));
  }

  /** Grid fill – 0° + 90° on every layer */
  baseGridFill(cx, cy, z, innerR, outerR) {
    const sp = this.p.baseLineWidth;
    this._extrudeLines(cx, cy, z, this._rectilinearSegments(innerR, outerR, 0, sp));
    this._extrudeLines(cx, cy, z, this._rectilinearSegments(innerR, outerR, Math.PI / 2, sp));
  }

  /** Dispatch one complete base layer (perimeters + fill) */
  baseLayer(cx, cy, z, innerR, outerR, layerIdx) {
    const pattern = this.p.basePattern || 'concentric';

    if (pattern !== 'concentric') {
      // Perimeters (extra on first layer for bed adhesion)
      const nPeri = layerIdx === 0 ? 2 : 1;
      for (let i = 0; i < nPeri; i++) {
        const r = outerR - i * this.p.baseLineWidth;
        if (r > innerR + this.p.baseLineWidth) this.basePerimeter(cx, cy, z, r);
      }
      if (innerR > this.p.baseLineWidth) {
        this.basePerimeter(cx, cy, z, innerR, -1);
      }

      const fillOuter = outerR - nPeri * this.p.baseLineWidth;
      const fillInner = innerR > 0 ? innerR + this.p.baseLineWidth : 0;

      if (fillOuter > fillInner + this.p.baseLineWidth) {
        if (pattern === 'rectilinear') {
          this.baseRectilinearFill(cx, cy, z, fillInner, fillOuter, layerIdx);
        } else {
          this.baseGridFill(cx, cy, z, fillInner, fillOuter);
        }
      }
    } else {
      // Concentric spiral already fills edge-to-edge
      this.baseConcentricFill(cx, cy, z, innerR, outerR);
    }
  }

  wallHelix(cx, cy, startZ, endZ, bottomR, topR) {
    const p = this.p;
    const height = endZ - startZ;
    if (height <= 0) return;

    const turns = height / p.layerHeight;
    const totalTheta = turns * 2 * Math.PI;
    const steps = Math.max(1, Math.round(turns * p.segmentsPerRev));

    // --- Seam alignment: rotate the start angle each turn ---
    // 'aligned' = 0 offset (all layers start at same spot)
    // 'staggered' = golden-angle offset per turn (~137.5°) for even distribution
    // 'random' = pseudo-random offset per turn (seeded from turn index)
    const seamAlign = p.seamAlign || 'aligned';
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399 rad ≈ 137.5°
    // Simple seeded PRNG: multiply turn index by large prime, take fractional part
    const seamRandom = (turn) => ((turn * 2654435761) % 4294967296) / 4294967296 * 2 * Math.PI;

    // --- Wave amplitude ramp (matches gradual layer transition) ---
    const waveRampTurns = p.gradualLayers > 0 ? p.gradualLayers : 0;
    const waveParams = { ...p }; // mutable copy – only waveAmp changes

    // --- Flow ramp on first revolution (prevents elephant-foot) ---
    //     Wider nozzles displace more material → lower starting flow.
    const flowRampTurns = 1;
    const flowStart = clamp(0.4 / Math.max(0.4, p.lineWidth), 0.15, 0.5);

    // --- E-rate baseline for the gradual layer-height transition ---
    const gradualBaseE = extrusionPerMm(p.lineWidth, p.baseLayerHeight, p.filamentD, p.flow);

    // Initial seam offset for the starting position (turn 0)
    let startSeamOffset = 0;
    const startTurnIdx = p.baseLayers;
    if (seamAlign === 'staggered') {
      startSeamOffset = startTurnIdx * goldenAngle;
    } else if (seamAlign === 'random') {
      startSeamOffset = seamRandom(startTurnIdx);
    }

    // Start at flat wall radius (base layers are circular, no waves)
    this.move(
      cx + bottomR * Math.cos(startSeamOffset),
      cy + bottomR * Math.sin(startSeamOffset),
      startZ, p.travelSpeed
    );

    let accumulatedZ = 0;

    for (let i = 1; i <= steps; i++) {
      const theta = totalTheta * (i / steps);
      const currentTurn = theta / (2 * Math.PI);

      // --- Z: continuous spiral + gradual layer-height transition ---
      let z;
      let easedProgress = 1;
      if (p.gradualLayers > 0 && currentTurn < p.gradualLayers) {
        const transitionProgress = currentTurn / p.gradualLayers;
        easedProgress = transitionProgress < 0.5
          ? 4 * transitionProgress * transitionProgress * transitionProgress
          : 1 - Math.pow(-2 * transitionProgress + 2, 3) / 2;

        const currentLayerHeight = lerp(p.baseLayerHeight, p.layerHeight, easedProgress);
        const thetaIncrement = totalTheta / steps;
        accumulatedZ += (currentLayerHeight / (2 * Math.PI)) * thetaIncrement;
        z = startZ + accumulatedZ;
      } else {
        if (p.gradualLayers > 0) {
          const gradualHeightGained = p.gradualLayers * ((p.baseLayerHeight + p.layerHeight) / 2);
          z = startZ + gradualHeightGained + (currentTurn - p.gradualLayers) * p.layerHeight;
        } else {
          z = startZ + currentTurn * p.layerHeight;
        }
      }
      if (z > endZ) z = endZ;

      const turnIndex = Math.floor(currentTurn) + p.baseLayers;
      const t = (z - startZ) / Math.max(1e-9, endZ - startZ);
      let baseR = lerp(bottomR, topR, t);

      // --- Seam offset applied to theta for this step ---
      let seamOffset = 0;
      if (seamAlign === 'staggered') {
        seamOffset = turnIndex * goldenAngle;
      } else if (seamAlign === 'random') {
        seamOffset = seamRandom(turnIndex);
      }
      const adjustedTheta = theta + seamOffset;

      if (p.zWaveAmp !== 0) {
        baseR += p.zWaveAmp * Math.sin(p.zWaveCycles * 2 * Math.PI * t);
      }

      // --- Gradually introduce wave amplitude (quadratic ease-in) ---
      if (waveRampTurns > 0 && currentTurn < waveRampTurns) {
        const rampT = currentTurn / waveRampTurns;
        waveParams.waveAmp = p.waveAmp * rampT * rampT;
      } else {
        waveParams.waveAmp = p.waveAmp;
      }
      const r = waveRadius(baseR, adjustedTheta, turnIndex, waveParams);

      // --- Dynamic E-rate: gradual height + flow ramp ---
      let eRate;
      if (p.gradualLayers > 0 && currentTurn < p.gradualLayers) {
        eRate = lerp(gradualBaseE, this.wallEPerMm, easedProgress);
      } else {
        eRate = this.wallEPerMm;
      }
      if (currentTurn < flowRampTurns) {
        eRate *= lerp(flowStart, 1.0, currentTurn / flowRampTurns);
      }
      this.ePerMm = eRate;

      // --- Slow-down near wave peaks ---
      let speed = p.printSpeed;
      if (p.slowDownLengthMm > 0 && p.slowDownTimeMs > 0) {
        const phase = p.waveCount * theta + turnIndex * p.phaseOffsetPerTurn;
        const distToPeak = Math.abs(((phase - Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI);
        const phaseThreshold = (p.slowDownLengthMm / r) * p.waveCount;
        if (distToPeak < phaseThreshold) {
          speed = (2.0 * p.slowDownLengthMm) / (p.slowDownTimeMs / 1000.0);
        }
      }

      const x = cx + r * Math.cos(adjustedTheta);
      const y = cy + r * Math.sin(adjustedTheta);
      this.extrudeTo(x, y, z, speed);
    }
  }

  // ============================================================
  // IM-VASE BLOB WALL
  // ============================================================

  /**
   * Print N circular vase-mode spirals at a given Z height on top of a blob layer.
   * Each spiral is a single-turn helix using the vase-layer-specific line width
   * and layer height. Multiple wall lines are offset inward by vlLineWidth.
   */
  vaseLayersOnBlobs(cx, cy, z, radius, vlCount, vlWalls, vlLineWidth, vlLayerHeight, vlEPerMm) {
    const p = this.p;
    const steps = p.segmentsPerRev;
    const savedEPerMm = this.ePerMm;
    const vlSpeed = p.blobVlPrintSpeed || p.printSpeed;

    this.ePerMm = vlEPerMm;

    // Restore wall (vase) nozzle temp & full fan for clean spiral layers
    this.w(`M104 S${p.nozzleTemp} ; vase-layer nozzle temp (non-blocking)`);
    this.w(`M106 S${Math.round(clamp(p.fanPercent, 0, 100) * 255 / 100)} ; vase-layer fan`);

    // Lead-in arc length: ~1/4 turn of non-extruding travel at target speed
    // so firmware accelerates to cruise speed before real extrusion begins.
    const leadInSteps = Math.max(1, Math.round(steps / 4));

    for (let vl = 0; vl < vlCount; vl++) {
      const layerBaseZ = z + vl * vlLayerHeight;
      this.w(`; vase layer ${vl + 1}/${vlCount} z=${fmt(layerBaseZ)}`);

      for (let wall = 0; wall < vlWalls; wall++) {
        const wallR = radius - wall * vlLineWidth;
        if (wallR <= 0) break;

        // Lead-in: travel along the arc backwards so the print head
        // is already moving at vlSpeed when extrusion starts at theta=0.
        const leadInStartTheta = -2 * Math.PI * (leadInSteps / steps);
        const leadInStartX = cx + wallR * Math.cos(leadInStartTheta);
        const leadInStartY = cy + wallR * Math.sin(leadInStartTheta);
        this.move(leadInStartX, leadInStartY, layerBaseZ, p.travelSpeed);

        // Non-extruding arc from lead-in start to theta=0 at target speed
        for (let li = 1; li <= leadInSteps; li++) {
          const theta = leadInStartTheta + 2 * Math.PI * (li / steps);
          const lx = cx + wallR * Math.cos(theta);
          const ly = cy + wallR * Math.sin(theta);
          this.move(lx, ly, layerBaseZ, vlSpeed);
        }

        // Full-turn spiral with vlLayerHeight rise — constant speed throughout
        for (let i = 1; i <= steps; i++) {
          const theta = 2 * Math.PI * (i / steps);
          const segZ = layerBaseZ + vlLayerHeight * (i / steps);
          const x = cx + wallR * Math.cos(theta);
          const y = cy + wallR * Math.sin(theta);
          this.extrudeTo(x, y, segZ, vlSpeed);
        }
      }
    }

    // Restore blob extrusion + temperature for next blob layer
    this.ePerMm = savedEPerMm;
    if (p.blobNozzleTemp) {
      this.w(`M104 S${p.blobNozzleTemp} ; back to blob temp (non-blocking)`);
    }
    this.w(`M106 S${Math.round(clamp(p.blobFanPercent, 0, 100) * 255 / 100)} ; back to blob fan`);
  }

  /**
   * Deposits discrete blobs in concentric rings to form a vase wall.
   * Each blob: move to position → slowly extrude upward → dwell → lift for clearance.
   * Layers are offset rotationally for a staggered brick-like pattern.
   *
   * If blobVaseLayers is enabled, normal vase-mode spirals are printed on top
   * of every Nth blob layer.
   */
  buildBlobLayerOrder(dotsPerRev, stride) {
    const order = [];
    for (let pass = 0; pass < stride; pass++) {
      const passDots = [];
      for (let dot = pass; dot < dotsPerRev; dot += stride) {
        passDots.push(dot);
      }
      for (let i = passDots.length - 1; i >= 0; i--) {
        order.push(passDots[i]);
      }
    }
    return order;
  }

  rotateBlobLayerOrder(order, startIdx) {
    if (!Array.isArray(order) || order.length === 0) return [];
    const n = order.length;
    const idx = ((startIdx % n) + n) % n;
    if (idx === 0) return [...order];
    return [...order.slice(idx), ...order.slice(0, idx)];
  }

  pickBlobLayerStartIndex(order, dotsPerRev, layerAngleOffset, startRadius, prevLayerLastTop, transitionOffsetMm, cx, cy) {
    if (!prevLayerLastTop || !Array.isArray(order) || order.length === 0) return 0;

    const candidates = [];
    let minDistance = Infinity;

    for (let i = 0; i < order.length; i++) {
      const dot = order[i];
      const theta = (2 * Math.PI * dot / dotsPerRev) + layerAngleOffset;
      const x = cx + startRadius * Math.cos(theta);
      const y = cy + startRadius * Math.sin(theta);
      const distance = Math.hypot(x - prevLayerLastTop.x, y - prevLayerLastTop.y);
      candidates.push({ i, distance });
      if (distance < minDistance) minDistance = distance;
    }

    const targetDistance = Math.max(0, minDistance + (transitionOffsetMm || 0));
    let best = candidates[0];
    let bestScore = Math.abs(candidates[0].distance - targetDistance);

    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i];
      const score = Math.abs(c.distance - targetDistance);
      if (score < bestScore || (score === bestScore && c.distance < best.distance)) {
        best = c;
        bestScore = score;
      }
    }

    return best.i;
  }

  travelBlobArcXYAtSafeZ(toX, toY, safeZ, cx, cy) {
    const p = this.p;
    const fromX = this.x;
    const fromY = this.y;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const chord = Math.hypot(dx, dy);
    if (chord < 1e-6) return;

    const curvature = clamp(p.blobTransitionCurvature || 0, -1, 1);
    if (Math.abs(curvature) < 1e-6) {
      this.move(toX, toY, safeZ, p.travelSpeed);
      return;
    }

    const pathIncrease = clamp(p.blobTransitionPathIncrease || 0, 0, 50);

    const midX = (fromX + toX) * 0.5;
    const midY = (fromY + toY) * 0.5;

    let dirX = midX - cx;
    let dirY = midY - cy;
    let dirLen = Math.hypot(dirX, dirY);
    if (dirLen < 1e-6) {
      dirX = -dy;
      dirY = dx;
      dirLen = Math.hypot(dirX, dirY);
    }
    dirX /= Math.max(dirLen, 1e-9);
    dirY /= Math.max(dirLen, 1e-9);

    const curvatureSagitta = Math.abs(curvature) * chord * 0.5;
    const increaseSagitta = pathIncrease > 0
      ? Math.sqrt(Math.max(0, (3 * chord * pathIncrease) / 8))
      : 0;
    const sagitta = Math.min(curvatureSagitta + increaseSagitta, chord * 2.5);
    const sign = Math.sign(curvature);

    const ctrlX = midX + sign * dirX * sagitta;
    const ctrlY = midY + sign * dirY * sagitta;

    const approxLen = chord + Math.abs(pathIncrease) + Math.abs(curvature) * chord * 0.5;
    const nSegs = Math.round(clamp(approxLen / 1.5, 6, 96));

    for (let i = 1; i <= nSegs; i++) {
      const t = i / nSegs;
      const omt = 1 - t;
      const x = omt * omt * fromX + 2 * omt * t * ctrlX + t * t * toX;
      const y = omt * omt * fromY + 2 * omt * t * ctrlY + t * t * toY;
      this.move(x, y, safeZ, p.travelSpeed);
    }
  }

  travelToBlobStartSafe(target, cx, cy) {
    const p = this.p;
    const safeZ = Math.max(this.z, target.topZ + p.blobClearanceZ);

    if (this.z < safeZ - 1e-6) {
      this.move(null, null, safeZ, p.travelSpeed);
    }

    const xyDist = Math.hypot(target.startX - this.x, target.startY - this.y);
    if (xyDist > 1e-6) {
      this.travelBlobArcXYAtSafeZ(target.startX, target.startY, safeZ, cx, cy);
    }

    if (this.z > target.baseZ + 1e-6 || this.z < target.baseZ - 1e-6) {
      this.move(null, null, target.baseZ, p.travelSpeed * 0.5);
    }
  }

  blobWall(cx, cy, startZ, endZ, bottomR, topR) {
    const p = this.p;
    const height = endZ - startZ;
    if (height <= 0) return;

    const dotH = p.blobDotHeight;
    const nLayers = Math.max(1, Math.round(height / dotH));
    const actualDotH = height / nLayers;

    const hops = Math.max(0, Math.round(p.blobHops || 0));
    const stride = hops + 1; // print every stride-th blob per pass

    const offsetStart = p.blobOffsetStart || 0; // mm radial offset at blob base
    const offsetEnd   = p.blobOffsetEnd   || 0; // mm radial offset at blob top
    const wave        = clamp(p.blobWave  || 0, -1, 1); // sinusoidal curvature
    const layerTransitionOffset = clamp(p.blobLayerTransitionOffset || 0, -5, 5);

    // Vase-layer settings
    const doVaseLayers = p.blobVaseLayers && p.blobVlCount > 0;
    const vlEveryN     = Math.max(1, p.blobVlEveryN || 1);
    const vlCount      = p.blobVlCount || 1;
    const vlWalls      = p.blobVlWalls || 1;
    const vlLineWidth  = p.blobVlLineWidth || 0.45;
    const vlLayerHeight = p.blobVlLayerHeight || 0.2;
    const vlEPerMm     = extrusionPerMm(vlLineWidth, vlLayerHeight, p.filamentD, p.flow);

    // Switch to blob temperature
    if (p.blobNozzleTemp) {
      this.w(`M104 S${p.blobNozzleTemp} ; blob nozzle temp (non-blocking)`);
    }
    // Blob fan
    this.w(`M106 S${Math.round(clamp(p.blobFanPercent, 0, 100) * 255 / 100)} ; blob fan`);

    let prevLayerLastTop = null;
    const layerOrderBase = this.buildBlobLayerOrder(p.blobDotsPerRev, stride);

    for (let layer = 0; layer < nLayers; layer++) {
      const t = nLayers > 1 ? layer / (nLayers - 1) : 0;
      const r = lerp(bottomR, topR, t);
      const baseZ = startZ + layer * actualDotH;

      // Rotational offset per layer for staggered pattern
      const layerAngleOffset = layer * p.blobLayerOffset * (2 * Math.PI / p.blobDotsPerRev);

      const startRadius = r + offsetStart;
      const startIdx = this.pickBlobLayerStartIndex(
        layerOrderBase,
        p.blobDotsPerRev,
        layerAngleOffset,
        startRadius,
        prevLayerLastTop,
        layerTransitionOffset,
        cx,
        cy
      );
      const layerOrder = this.rotateBlobLayerOrder(layerOrderBase, startIdx);

      this.w(`; blob layer ${layer + 1}/${nLayers} z=${fmt(baseZ)} hops=${hops} start_idx=${startIdx}`);

      let layerLastTop = null;

      // Keep existing hop-based placement, but allow a rotated start index so
      // last-layer to next-layer transition distance can be controlled.
      for (let orderIdx = 0; orderIdx < layerOrder.length; orderIdx++) {
          const dot = layerOrder[orderIdx];
          const theta = (2 * Math.PI * dot / p.blobDotsPerRev) + layerAngleOffset;

          // --- Blob path with radial offsets and wave ---
          // Start position (at baseZ): radius shifted by offsetStart
          const rStart = r + offsetStart;
          // End position (at blobTopZ): radius shifted by offsetEnd
          const rEnd = r + offsetEnd;

          const bxStart = cx + rStart * Math.cos(theta);
          const byStart = cy + rStart * Math.sin(theta);
          const blobTopZ = baseZ + actualDotH;

          // 1) Collision-safe transition to next blob start:
          //    - Raise (if needed) to safe Z.
          //    - Move in XY only at that safe Z (straight or curved).
          //    - Lower vertically to the blob base Z.
          //    This prevents diagonal descent collisions when clearance is low.
          this.travelToBlobStartSafe({ startX: bxStart, startY: byStart, baseZ, topZ: blobTopZ }, cx, cy);

          // 2) Extrude upward through the blob height
          //    If offsets differ or wave != 0, we subdivide the rise into segments
          //    to trace the curved/offset path.
          const needSubdiv = (offsetStart !== offsetEnd) || (wave !== 0);
          const nSegs = needSubdiv ? Math.max(4, Math.round(actualDotH / 0.2)) : 1;
          const dePerSeg = p.blobDotExtrusion / nSegs;
          const feedrate = Math.round(p.blobExtrudeSpeed * 60);

          for (let seg = 0; seg < nSegs; seg++) {
            const segT = (seg + 1) / nSegs; // 0→1 progress through blob rise
            const segZ = lerp(baseZ, blobTopZ, segT);

            // Radial offset: linear blend + sinusoidal wave bulge
            const linOffset = lerp(offsetStart, offsetEnd, segT);
            const waveBulge = wave * Math.sin(Math.PI * segT); // peaks at midpoint
            const segR = r + linOffset + waveBulge;

            const segX = cx + segR * Math.cos(theta);
            const segY = cy + segR * Math.sin(theta);

            let eField;
            if (p.absoluteExtrusion) {
              this.e += dePerSeg;
              eField = `E${fmt(this.e)}`;
            } else {
              eField = `E${fmt(dePerSeg)}`;
            }

            const fromX = this.x, fromY = this.y, fromZ = this.z;
            this.x = segX; this.y = segY; this.z = segZ;
            this.w(`G1 X${fmt(segX)} Y${fmt(segY)} Z${fmt(segZ)} ${eField} F${feedrate}`);
            this.extrudePoints.push({ x: fromX, y: fromY, z: fromZ });
            this.extrudePoints.push({ x: segX, y: segY, z: segZ });

            if (seg === nSegs - 1) {
              layerLastTop = { x: segX, y: segY };
            }
          }

          // 3) Retract filament (before dwell) to reduce ooze
          const retractLen = p.blobRetractLen || 0;
          const retractSpeed = p.blobRetractSpeed || 30;
          if (retractLen > 0) {
            let eField;
            if (p.absoluteExtrusion) {
              this.e -= retractLen;
              eField = `E${fmt(this.e)}`;
            } else {
              eField = `E${fmt(-retractLen)}`;
            }
            this.w(`G1 ${eField} F${Math.round(retractSpeed * 60)} ; retract`);
          }

          // 4) Dwell to let material pool
          if (p.blobDwellMs > 0) {
            this.w(`G4 P${p.blobDwellMs} ; dwell`);
          }

          // 5) Lift to safe Z before next blob transition
          this.move(null, null, blobTopZ + p.blobClearanceZ, p.travelSpeed);

          // 6) De-retract while stationary at safe Z (never during XY travel)
          if (retractLen > 0) {
            let eField;
            if (p.absoluteExtrusion) {
              this.e += retractLen;
              eField = `E${fmt(this.e)}`;
            } else {
              eField = `E${fmt(retractLen)}`;
            }
            this.w(`G1 ${eField} F${Math.round(retractSpeed * 60)} ; de-retract`);
          }
      }

      if (layerLastTop) prevLayerLastTop = layerLastTop;

      // --- Vase layers on top of this blob layer ---
      if (doVaseLayers && ((layer + 1) % vlEveryN === 0)) {
        const topOfBlobLayer = baseZ + actualDotH;
        this.w(`; --- vase layers on blob layer ${layer + 1} ---`);
        this.vaseLayersOnBlobs(cx, cy, topOfBlobLayer, r, vlCount, vlWalls,
          vlLineWidth, vlLayerHeight, vlEPerMm);
      }
    }
  }

  build() {
    const p = this.p;

    // Bed origin offset
    let cx = p.centerX;
    let cy = p.centerY;
    if (p.bedOrigin === 'corner') {
      const bedSize = Math.max(p.outerD, p.topOuterD) * 1.5; // heuristic
      cx += bedSize / 2;
      cy += bedSize / 2;
    }

    const outerR = p.outerD / 2;
    const topR = p.topOuterD / 2;
    const holeR = p.holeD / 2;

    const wallRBottom = outerR - p.lineWidth * 0.5;
    const wallRTop = topR - p.lineWidth * 0.5;
    const innerR = holeR > 0 ? holeR + p.baseLineWidth * 0.5 : 0;

    this.header();

    let z = p.baseLayerHeight;

    // Base layers (flat – no wave distortion)
    this.w(`; --- base layers (${p.basePattern || 'concentric'}) ---`);
    this.ePerMm = this.baseEPerMm;
    for (let layer = 0; layer < p.baseLayers; layer++) {
      this.w(`; base layer ${layer + 1}/${p.baseLayers}`);
      this.baseLayer(cx, cy, z, innerR, wallRBottom, layer);
      z += p.baseLayerHeight;
    }

    // Transition to wall settings
    this.w('; --- transition to wall settings ---');
    this.w(`M104 S${p.nozzleTemp} ; wall nozzle temp (non-blocking)`);
    this.w(`M140 S${p.bedTemp} ; wall bed temp`);
    this.ePerMm = this.wallEPerMm;

    // Wall helix
    const startZ = p.baseLayers * p.baseLayerHeight;
    const endZ = startZ + p.height;

    this.w('; --- wall ---');
    if ((p.wallMode || 'vase') === 'blob') {
      this.w('; --- IM-Vase blob wall ---');
      this.blobWall(cx, cy, startZ, endZ, wallRBottom, wallRTop);
    } else {
      this.w('; --- wall helix vase mode ---');
      this.wallHelix(cx, cy, startZ, endZ, wallRBottom, wallRTop);
    }

    this.footer();
    return this.lines.join('\n');
  }
}
