// src/preview/threePreview.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { lerp } from '../utils/math.js';
import { readParams } from '../ui/params.js';

// ============================================================
// THREE.JS STATE
// ============================================================

let scene, camera, renderer, controls;
let previewMesh = null;
let travelMesh = null;
let gridHelper = null;

// Simulation state
let allPoints = [];
let allPositions = null;
let allColors = null;
let layerBreaks = [];
let totalLayers = 0;

let simPlaying = false;
let simProgress = 1.0;   // 0..1
let simSpeed = 10;       // multiplier over real-time
let simCurrentIdx = 0;

// Time-based simulation data
let simTimeline = [];      // cumulative seconds at each point-pair end
let simTotalTimeS = 0;     // total print time in seconds
let simTimeS = 0;          // current playback position in seconds
let simLastFrameMs = 0;    // last frame timestamp for delta-time

let userDraggingProgress = false;
let userDraggingLayer = false;

// ============================================================
// THREE.JS SETUP
// ============================================================

export function initThree() {
  const container = document.getElementById('viewport');
  const w = container.clientWidth;
  const h = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1117);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
  camera.position.set(120, 120, 120);
  camera.lookAt(0, 60, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 60, 0);
  controls.update();

  // Grid
  gridHelper = new THREE.GridHelper(300, 30, 0x2e3347, 0x1a1d27);
  scene.add(gridHelper);

  // Axes helper (subtle)
  const axesHelper = new THREE.AxesHelper(30);
  axesHelper.material.transparent = true;
  axesHelper.material.opacity = 0.4;
  scene.add(axesHelper);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(100, 200, 100);
  scene.add(dirLight);

  // Wire up simulation controls
  initSimControls();

  window.addEventListener('resize', resizeThree);
  animate();
}

export function resizeThree() {
  const container = document.getElementById('viewport');
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!renderer || w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  if (simPlaying) simTick();
  controls.update();
  renderer.render(scene, camera);
}

// ============================================================
// SIMULATION CONTROLS
// ============================================================

function initSimControls() {
  const playBtn = document.getElementById('sim-play-btn');
  const progressSlider = document.getElementById('sim-progress');
  const layerSlider = document.getElementById('layer-slider');

  playBtn.addEventListener('click', togglePlay);

  // Progress slider → updates draw range AND syncs the layer slider
  progressSlider.addEventListener('input', () => {
    userDraggingProgress = true;
    const v = parseInt(progressSlider.value);
    simProgress = v / 1000;
    simCurrentIdx = Math.round(simProgress * allPoints.length);
    // Snap to even for segment pairs
    simCurrentIdx = simCurrentIdx - (simCurrentIdx % 2);
    // Sync time position from point index
    simTimeS = pointIndexToTime(simCurrentIdx);
    updateDrawRange();
    syncLayerSliderFromProgress();
    updateSimUI();
  });
  progressSlider.addEventListener('change', () => { userDraggingProgress = false; });

  // Layer slider → updates draw range AND syncs the progress slider
  layerSlider.addEventListener('input', () => {
    userDraggingLayer = true;
    const v = parseInt(layerSlider.value);
    applyLayerFilter(v);
  });
  layerSlider.addEventListener('change', () => { userDraggingLayer = false; });
}

function syncLayerSliderFromProgress() {
  if (!allPoints.length || !layerBreaks.length) return;

  let layerIdx = 0;
  for (let i = layerBreaks.length - 1; i >= 0; i--) {
    if (simCurrentIdx >= layerBreaks[i]) {
      layerIdx = i;
      break;
    }
  }

  if (simCurrentIdx >= allPoints.length) layerIdx = totalLayers;

  const layerSlider = document.getElementById('layer-slider');
  if (!userDraggingLayer) layerSlider.value = layerIdx;
  document.getElementById('layer-current').textContent = layerIdx >= totalLayers ? 'All' : (layerIdx + 1);
}

function syncProgressSliderFromLayer() {
  if (!userDraggingProgress) {
    document.getElementById('sim-progress').value = Math.round(simProgress * 1000);
  }
  document.getElementById('sim-percent').textContent = Math.round(simProgress * 100);
}

function togglePlay() {
  if (allPoints.length === 0) return;
  simPlaying = !simPlaying;

  if (simPlaying) {
    // If at the end, restart from beginning
    if (simCurrentIdx >= allPoints.length) {
      simCurrentIdx = 0;
      simProgress = 0;
      simTimeS = 0;
    }
    simLastFrameMs = performance.now();
  }
  updatePlayIcon();
}

function updatePlayIcon() {
  const icon = document.getElementById('sim-play-icon');
  if (simPlaying) {
    icon.innerHTML = '<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
  } else {
    icon.innerHTML = '<polygon points="6,3 20,12 6,21"/>';
  }
}

export function setSimSpeed(s) {
  simSpeed = s;
  document.querySelectorAll('.sim-btn-sm[data-speed]').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === s);
  });
}

function simTick() {
  if (!allPoints.length || !previewMesh || simTotalTimeS <= 0) return;

  const now = performance.now();
  const dtMs = now - simLastFrameMs;
  simLastFrameMs = now;

  // Clamp dt to avoid huge jumps after tab-switch or lag spike
  const dtS = Math.min(dtMs / 1000, 0.1);

  simTimeS += dtS * simSpeed;

  if (simTimeS >= simTotalTimeS) {
    simTimeS = simTotalTimeS;
    simCurrentIdx = allPoints.length;
    simProgress = 1;
    simPlaying = false;
    updatePlayIcon();
  } else {
    // Binary search timeline to find the point-pair index for simTimeS
    simCurrentIdx = timeToPointIndex(simTimeS);
    simProgress = simCurrentIdx / allPoints.length;
  }

  updateDrawRange();
  updateSimUI();
  syncLayerSliderFromProgress();
}

/** Binary search the cumulative-time timeline → point-pair index */
function timeToPointIndex(timeS) {
  if (simTimeline.length === 0) return 0;
  let lo = 0, hi = simTimeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (simTimeline[mid] < timeS) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first segment whose end-time >= timeS
  // Each timeline entry maps to a point-pair at index lo*2 .. lo*2+1
  const pairIdx = lo;
  const pts = (pairIdx + 1) * 2;
  return Math.min(pts, allPoints.length);
}

/** Convert a point index back to its cumulative time */
function pointIndexToTime(idx) {
  if (simTimeline.length === 0 || idx <= 0) return 0;
  const pairIdx = Math.floor(idx / 2) - 1;
  if (pairIdx < 0) return 0;
  if (pairIdx >= simTimeline.length) return simTotalTimeS;
  return simTimeline[pairIdx];
}

/**
 * Build a timeline from G-code lines: for each extrude-point pair,
 * compute the real-time duration (seconds) from feedrate + distance,
 * including G4 dwell pauses. Returns cumulative-time array aligned
 * with extrudePoints pairs.
 */
function buildTimeline(gcodeLines, extrudePoints) {
  const nPairs = Math.floor(extrudePoints.length / 2);
  const timeline = new Array(nPairs);
  let cumTime = 0;

  // Parse G-code lines into timed events
  // We need to map each extrude segment to its duration.
  // Strategy: walk G-code lines, track feedrate and dwell,
  // and for each G1 with E, compute duration and attach a dwell
  // from any preceding G4.
  let currentFeedMmMin = 1500; // default 25mm/s
  let pendingDwellS = 0;
  let x = 0, y = 0, z = 0;
  let extrudeIdx = 0; // which pair we're filling

  for (const line of gcodeLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;

    // G4 dwell: accumulate pause time
    const g4Match = trimmed.match(/^G4\s+P(\d+)/i);
    if (g4Match) {
      pendingDwellS += parseInt(g4Match[1]) / 1000; // P is milliseconds
      continue;
    }

    // G0 / G1 moves
    if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
      const fMatch = trimmed.match(/F([\d.]+)/);
      if (fMatch) currentFeedMmMin = parseFloat(fMatch[1]);

      const xMatch = trimmed.match(/X(-?[\d.]+)/);
      const yMatch = trimmed.match(/Y(-?[\d.]+)/);
      const zMatch = trimmed.match(/Z(-?[\d.]+)/);
      const eMatch = trimmed.match(/E(-?[\d.]+)/);

      const nx = xMatch ? parseFloat(xMatch[1]) : x;
      const ny = yMatch ? parseFloat(yMatch[1]) : y;
      const nz = zMatch ? parseFloat(zMatch[1]) : z;

      if (eMatch && extrudeIdx < nPairs) {
        // This is an extrude move — compute real duration
        const dx = nx - x;
        const dy = ny - y;
        const dz = nz - z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const feedMmS = Math.max(0.1, currentFeedMmMin / 60);
        const moveTimeS = dist / feedMmS;

        cumTime += moveTimeS + pendingDwellS;
        pendingDwellS = 0;
        timeline[extrudeIdx] = cumTime;
        extrudeIdx++;
      } else if (!eMatch) {
        // Travel move — still takes time, accumulate it
        const dx = nx - x;
        const dy = ny - y;
        const dz = nz - z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const feedMmS = Math.max(0.1, currentFeedMmMin / 60);
        cumTime += dist / feedMmS;
      }

      x = nx; y = ny; z = nz;
    }
  }

  // Fill any remaining entries (shouldn't happen but safety)
  for (let i = extrudeIdx; i < nPairs; i++) {
    cumTime += 0.01;
    timeline[i] = cumTime;
  }

  return { timeline, totalTimeS: cumTime };
}

function updateDrawRange() {
  if (!previewMesh) return;
  let count = Math.max(0, Math.min(simCurrentIdx, allPoints.length));
  // Snap to even so LineSegments never gets a lone dangling vertex
  count = count - (count % 2);
  previewMesh.geometry.setDrawRange(0, count);
}

function updateSimUI() {
  syncProgressSliderFromLayer();
  // Show elapsed / total time
  const timeEl = document.getElementById('sim-time');
  if (timeEl) {
    const elapsed = formatTime(simTimeS);
    const total = formatTime(simTotalTimeS);
    timeEl.textContent = `${elapsed} / ${total}`;
  }
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function applyLayerFilter(layerVal) {
  if (!previewMesh || !allPoints.length) return;
  const maxLayer = totalLayers;
  document.getElementById('layer-current').textContent = layerVal >= maxLayer ? 'All' : (layerVal + 1);

  if (layerVal >= maxLayer) {
    simCurrentIdx = allPoints.length;
    simProgress = 1;
    simTimeS = simTotalTimeS;
    updateDrawRange();
    updateSimUI();
    return;
  }

  const endIdx = layerVal < layerBreaks.length - 1 ? layerBreaks[layerVal + 1] : allPoints.length;
  // Snap to even for paired segment rendering
  simCurrentIdx = endIdx - (endIdx % 2);
  simProgress = simCurrentIdx / allPoints.length;
  simTimeS = pointIndexToTime(simCurrentIdx);
  updateDrawRange();
  updateSimUI();
}

// ============================================================
// COMPUTE LAYER BREAKS
// ============================================================

function computeLayerBreaks(pts, baseLayerHeight, wallLayerHeight, baseLayers) {
  const breaks = [0];
  if (pts.length < 2) return breaks;

  // Points come in pairs (from→to).  Use the "to" point (odd indices) for Z.
  let currentLayerZ = pts[1].z;
  let layerCount = 0;

  for (let i = 3; i < pts.length; i += 2) {
    const threshold = (layerCount < baseLayers ? baseLayerHeight : wallLayerHeight) * 0.6;

    if (pts[i].z > currentLayerZ + threshold) {
      // Snap to the segment-pair boundary (must be even)
      const breakIdx = i - 1;
      breaks.push(breakIdx);
      currentLayerZ = pts[i].z;
      layerCount++;
    }
  }
  return breaks;
}

// ============================================================
// UPDATE 3D PREVIEW
// ============================================================

export function updatePreview(builder) {
  if (!scene) return;

  // Remove old meshes
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
    previewMesh = null;
  }
  if (travelMesh) {
    scene.remove(travelMesh);
    travelMesh.geometry.dispose();
    travelMesh.material.dispose();
    travelMesh = null;
  }

  const pts = builder.extrudePoints;
  allPoints = pts;
  if (!pts || pts.length < 2) return;

  const params = readParams();

  // Build time-based timeline from G-code lines
  const gcodeLines = builder.lines || [];
  const timeData = buildTimeline(gcodeLines, pts);
  simTimeline = timeData.timeline;
  simTotalTimeS = timeData.totalTimeS;

  const positions = new Float32Array(pts.length * 3);
  const colors = new Float32Array(pts.length * 3);

  // Find max Z for color mapping
  let maxZ = 0;
  for (const p of pts) { if (p.z > maxZ) maxZ = p.z; }
  if (maxZ === 0) maxZ = 1;

  for (let i = 0; i < pts.length; i++) {
    positions[i * 3]     = pts[i].x;
    positions[i * 3 + 1] = pts[i].z; // height -> Y in Three.js
    positions[i * 3 + 2] = pts[i].y;

    const t = pts[i].z / maxZ;

    // Check if this point is in a slow-down zone (near wave peaks/valleys)
    let isSlowZone = false;
    if (params.slowDownLengthMm > 0 && params.slowDownTimeMs > 0 && params.waveCount > 0 && params.waveAmp > 0) {
      const cx = params.centerX || 0;
      const cy = params.centerY || 0;
      const dx = pts[i].x - cx;
      const dy = pts[i].y - cy;
      const angle = Math.atan2(dy, dx);
      const phase = (angle * params.waveCount) % (2 * Math.PI);
      const absSin = Math.abs(Math.sin(phase));
      // Near peak (sin ~= 1) or valley (sin ~= 0)
      if (absSin > 0.85 || absSin < 0.15) {
        isSlowZone = true;
      }
    }

    if (isSlowZone) {
      // Orange/yellow highlight for slow-down zones
      colors[i * 3]     = 1.0;
      colors[i * 3 + 1] = 0.7;
      colors[i * 3 + 2] = 0.2;
    } else {
      colors[i * 3]     = lerp(0.3, 1.0, t);
      colors[i * 3 + 1] = lerp(0.5, 0.6, Math.sin(t * Math.PI));
      colors[i * 3 + 2] = lerp(1.0, 0.3, t);
    }
  }

  allPositions = positions;
  allColors = colors;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1 });
  previewMesh = new THREE.LineSegments(geom, mat);
  scene.add(previewMesh);

  // Layer info
  layerBreaks = computeLayerBreaks(pts, params.baseLayerHeight, params.layerHeight, params.baseLayers);
  totalLayers = layerBreaks.length;

  // Update layer slider
  const layerSlider = document.getElementById('layer-slider');
  layerSlider.max = totalLayers;
  layerSlider.value = totalLayers;
  document.getElementById('layer-total').textContent = totalLayers;
  document.getElementById('layer-current').textContent = 'All';

  // Reset simulation to show all
  simCurrentIdx = pts.length;
  simProgress = 1;
  simTimeS = simTotalTimeS;
  simPlaying = false;
  updatePlayIcon();
  updateDrawRange();
  updateSimUI();

  // Update badges
  const totalTimeMin = (simTotalTimeS / 60).toFixed(1);
  document.getElementById('badge-verts').textContent = `Verts: ${pts.length.toLocaleString()}`;
  document.getElementById('badge-lines').textContent = `~${totalTimeMin} min`;

  // Center camera target on model
  const totalHeight = params.height + params.baseLayers * params.layerHeight;
  controls.target.set(params.centerX, totalHeight / 2, params.centerY);
  controls.update();
}
