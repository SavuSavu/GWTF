// src/main.js
import { fmt } from './utils/math.js';
import { GCodeBuilder } from './gcode/gcodeBuilder.js';
import { parseGcodeSettings, parseGcodeForVisualization, parseExternalGcode } from './gcode/gcodeParser.js';
import { initThree, updatePreview, setSimSpeed } from './preview/threePreview.js';
import { readParams, resetDefaults, clampHoleDiameter, loadSettingsToUI, syncWallModeUI, syncBlobVaseLayersUI } from './ui/params.js';
import { downloadGcode, saveDownloadFilename, restoreDownloadFilename, copyGcode, switchTab, toggleSection } from './ui/actions.js';
import { updateStatistics, toggleStatsPanel } from './ui/stats.js';
import {
  initDesignPresets,
  restoreSavedSettings,
  saveCurrentSettings,
  selectDesignTab,
  applyCustomFeatureFromEditor,
  saveCustomFeature,
  exportFeatureLibrary,
  importFeatureLibrary,
} from './ui/presets.js';

// ============================================================
// APP ACTIONS
// ============================================================

let currentGcode = '';
let lastGenerateTimeMs = 0;
let autoGenerateEnabled = true;
let autoGenerateTimer = null;
let AUTO_GENERATE_DELAY = 500;
const SLOW_GENERATION_THRESHOLD = 15000; // 15 seconds
const STORAGE_KEYS = {
  settings: 'gwtf.savedSettings',
  activeDesign: 'gwtf.activeDesign',
};
const HELP_TEXT_BY_ID = {
  outer_d: 'Bottom diameter. Larger increases base footprint and overall volume.',
  top_outer_d: 'Top diameter. Adjusts taper; smaller cones inward, larger flares outward.',
  height: 'Overall height. Taller increases print time and spiral length.',
  hole_d: 'Inner hole diameter for lamp shade sockets. Larger reduces wall thickness near the top.',
  base_layers: 'Number of solid base layers before spiral. More improves base strength but adds time.',
  gradual_layers: 'Blend from base layer height to vase height over this many layers. More hides seams but slows print.',
  wave_amp: 'Radial wave amplitude. Higher adds deeper waves and larger diameter swings.',
  wave_count: 'Waves per revolution. Higher makes finer texture but can reduce flow stability.',
  wave_shape: 'Morphs wave from sine to square to triangle. Sharper shapes make crisp ridges but need slower speed.',
  interference: 'Offsets wave phase between layers. Higher spreads peaks; lower aligns ripples vertically.',
  slow_down_time_ms: 'Pause at each wave peak and valley. Longer dwell improves cooling but can cause blobs.',
  slow_down_length_mm: 'Deceleration distance into peaks and valleys. Longer ramps smooth speed changes but slow print.',
  z_wave_amp: 'Vertical modulation amplitude. Adds height variation; larger makes stronger Z ripples.',
  z_wave_cycles: 'Number of Z waves over the height. Higher makes more vertical undulations.',
  base_pattern: 'Base infill pattern. Concentric follows spiral; rectilinear or grid add stiffness but increase travel.',
  base_layer_height: 'Base layer height. Thicker is faster but less detailed; thinner improves adhesion.',
  base_line_width: 'Base line width. Wider lines increase strength but can over-extrude if too high.',
  base_flow: 'Flow multiplier for base layers. Higher increases extrusion; too high causes squish.',
  filament_d: 'Filament diameter for extrusion math. Must match filament size for accurate flow.',
  layer_height: 'Spiral wall layer height. Larger is faster but less smooth; smaller is finer detail.',
  line_width: 'Spiral wall line width. Wider makes thicker walls and uses more material.',
  flow: 'Flow multiplier for spiral wall. Adjusts extrusion; too low weakens walls, too high bulges.',
  seam_align: 'Layer start strategy. Aligned starts in one spot; staggered spreads; random hides patterns.',
  base_nozzle_temp: 'Base layer nozzle temperature. Higher improves adhesion but can string if too hot.',
  base_bed_temp: 'Base layer bed temperature. Higher improves stick but can warp if too hot.',
  base_print_speed: 'Base layer print speed. Slower improves adhesion and accuracy.',
  travel_speed: 'Non-print travel speed. Higher reduces time but can cause ringing.',
  nozzle_temp: 'Wall nozzle temperature. Higher improves layer bonding but can string.',
  bed_temp: 'Wall bed temperature. Keep stable to reduce warping during the spiral.',
  print_speed: 'Wall print speed. Higher is faster but reduces surface quality.',
  fan_percent: 'Cooling fan for wall. Higher improves overhangs but reduces layer bonding.',
  blob_dots_per_rev: 'Blobs per revolution. More makes finer patterns; fewer makes larger spacing.',
  blob_dot_height: 'Vertical rise while extruding a blob. Higher makes taller blobs but can topple.',
  blob_layer_offset: 'Fractional offset per layer to stagger blobs. 0 aligns, 0.5 makes a brick pattern.',
  blob_clearance_z: 'Z lift when traveling between blobs. Higher avoids collisions but adds time.',
  blob_hops: 'Skip positions between blobs each pass. Higher spreads blobs over multiple rotations.',
  blob_offset_start: 'Radial start offset for blob path. Negative moves inward, positive outward.',
  blob_offset_end: 'Radial end offset at the top of the blob. Controls outward or inward flare.',
  blob_wave: 'Curvature of the blob path. Positive bows outward, negative bows inward.',
  blob_transition_curvature: 'Curvature for blob-to-blob XY travel. 0 is straight; negative bends inward; positive bends outward.',
  blob_transition_path_increase: 'Adds extra XY arc length between blobs when curvature is non-zero.',
  blob_layer_transition_offset: 'Biases distance between last blob of one layer and first blob of next layer. Negative tightens, positive loosens.',
  blob_dot_extrusion: 'Filament length per blob. Higher makes larger blobs but can ooze.',
  blob_extrude_speed: 'Vertical speed during blob extrusion. Slower improves adhesion; faster reduces dwell.',
  blob_dwell_ms: 'Pause after each blob. Longer lets material pool but can cause sagging.',
  blob_retract_len: 'Retract length after each blob. Reduces ooze; too high can cause gaps.',
  blob_retract_speed: 'Retract speed. Faster reduces stringing but can grind filament.',
  blob_nozzle_temp: 'Blob nozzle temperature. Higher helps blobs fuse; too high can droop.',
  blob_fan_percent: 'Cooling for blobs. Lower helps fusion; higher keeps shapes crisp.',
  blob_vase_layers: 'Enable normal spiral layers on top of blob layers.',
  blob_vl_every_n: 'Print vase layers every N blob layers. Larger N means fewer spiral bands.',
  blob_vl_count: 'Number of consecutive vase layers when triggered. More builds thicker bands.',
  blob_vl_walls: 'Wall lines per vase layer. More lines make thicker, stronger bands.',
  blob_vl_line_width: 'Line width for vase layers in blob mode. Wider increases strength.',
  blob_vl_layer_height: 'Layer height for vase layers in blob mode. Taller is faster but less smooth.',
  blob_vl_print_speed: 'Print speed for vase layers on blobs. Independent of main wall speed.',
  segments_per_rev: 'Path resolution per revolution. Higher makes smoother curves but increases G-code size.',
  bed_origin: 'Coordinate origin. Center uses bed center; corner uses front-left.',
  center_x: 'X offset for model center. Adjusts position on the bed.',
  center_y: 'Y offset for model center. Adjusts position on the bed.',
  home: 'Run G28 to home axes before print. Improves safety but adds time.',
  absolute_e: 'Use absolute extrusion (M82). Must match firmware expectations.',
  print_accel: 'Print acceleration in mm/s². Lower gives smoother surfaces; higher is faster.',
  travel_accel: 'Travel acceleration in mm/s². Higher speeds up non-print moves.',
  custom_start_gcode: 'Commands inserted before printing. Use for homing, heating, and priming.',
  custom_end_gcode: 'Commands appended after printing. Use for cooldown and parking.',
};
const HELP_TIP_ID_BY_INPUT = {
  hole_d: 'hole-hint',
};

function setStatus(type, text) {
  const dot = document.getElementById('status-dot');
  const msg = document.getElementById('status-msg');
  if (dot) { dot.className = 'status-indicator ' + type; }
  if (msg) { msg.textContent = text; }
}

export function generate() {
  const overlay = document.getElementById('gen-overlay');

  setStatus('generating', 'Generating…');
  overlay.classList.add('active');

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        const params = readParams();
        const builder = new GCodeBuilder(params);
        const startTime = performance.now();
        currentGcode = builder.build();
        const elapsed = performance.now() - startTime;
        lastGenerateTimeMs = elapsed;

        // Check if generation is too slow for auto-generate
        if (elapsed > SLOW_GENERATION_THRESHOLD && autoGenerateEnabled) {
          autoGenerateEnabled = false;
          const toggle = document.getElementById('auto-generate-toggle');
          if (toggle) toggle.checked = false;
          setStatus('warning', `Auto-generate disabled — took ${(elapsed / 1000).toFixed(1)}s`);
        }

        // Update editor
        document.getElementById('gcode-editor').value = currentGcode;

        // G-code editor stats
        const lineCount = builder.lines.length;
        const sizeKB = (new Blob([currentGcode]).size / 1024).toFixed(1);
        document.getElementById('gcode-lines').textContent = lineCount.toLocaleString();
        document.getElementById('gcode-size').textContent = `${sizeKB} KB`;
        document.getElementById('gcode-extrusion').textContent = `${fmt(builder.e)} mm`;

        // 3D preview + stats panel
        updatePreview(builder);
        updateStatistics(builder, params);

        saveCurrentSettings();

        if (autoGenerateEnabled) {
          setStatus('ready', `Generated ${lineCount.toLocaleString()} lines in ${elapsed.toFixed(0)}ms`);
        }
        document.getElementById('status-right').textContent = `${sizeKB} KB · E${fmt(builder.e)} mm`;
      } catch (err) {
        setStatus('error', `Error: ${err.message}`);
        console.error(err);
      } finally {
        overlay.classList.remove('active');
      }
    }, 30);
  });
}

/** Schedule auto-generate after user changes a setting */
function scheduleAutoGenerate() {
  if (!autoGenerateEnabled) return;
  if (autoGenerateTimer) clearTimeout(autoGenerateTimer);
  autoGenerateTimer = setTimeout(() => {
    generate();
  }, AUTO_GENERATE_DELAY);
}

function toggleAutoGenerate(enabled) {
  autoGenerateEnabled = !!enabled;
  localStorage.setItem('gwtf.autoGenerate', autoGenerateEnabled ? '1' : '0');
}

function setAutoGenerateDelay(ms) {
  AUTO_GENERATE_DELAY = Math.max(100, parseInt(ms) || 500);
  localStorage.setItem('gwtf.autoGenerateDelay', String(AUTO_GENERATE_DELAY));
}

export function importGcode(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const gcodeText = e.target.result;
    parseAndLoadGcode(gcodeText);
  };
  reader.readAsText(file);

  // Reset file input so the same file can be re-imported
  event.target.value = '';
}

function parseAndLoadGcode(gcodeText) {
  const overlay = document.getElementById('gen-overlay');

  setStatus('generating', 'Importing G-code…');
  overlay.classList.add('active');

  setTimeout(() => {
    try {
      const settings = parseGcodeSettings(gcodeText);

      if (settings) {
        // Our generated format → load settings back into UI
        loadSettingsToUI(settings);
        setStatus('ready', 'Settings loaded from G-code');

        // Visualization
        const builder = parseGcodeForVisualization(gcodeText, settings);
        updatePreview(builder);
        updateStatistics(builder, settings);
      } else {
        // External G-code → visualization only
        setStatus('ready', 'External G-code imported (visualization only)');

        // Switch to G-code tab
        const gcodeTab = document.querySelector('.tab[data-panel="panel-gcode"]');
        if (gcodeTab) switchTab(gcodeTab);
        document.getElementById('gcode-editor').value = gcodeText;

        const builder = parseExternalGcode(gcodeText);
        if (builder.extrudePoints.length > 0) {
          updatePreview(builder);
          updateStatistics(builder, null);
        }
      }

      // Update G-code stats
      const lines = gcodeText.split('\n');
      document.getElementById('gcode-lines').textContent = lines.length.toLocaleString();
      const sizeKB = (new Blob([gcodeText]).size / 1024).toFixed(1);
      document.getElementById('gcode-size').textContent = `${sizeKB} KB`;
    } catch (err) {
      setStatus('error', `Import error: ${err.message}`);
      console.error('Import error:', err);
    } finally {
      overlay.classList.remove('active');
    }
  }, 50);
}

// ============================================================
// EXPOSE TO GLOBAL SCOPE (inline onclick/oninput in HTML)
// ============================================================

window.generate = generate;
window.downloadGcode = downloadGcode;
window.saveDownloadFilename = saveDownloadFilename;
window.copyGcode = copyGcode;
window.resetDefaults = resetDefaults;
window.switchTab = switchTab;
window.toggleSection = toggleSection;
window.importGcode = importGcode;
window.toggleStatsPanel = toggleStatsPanel;
window.toggleAutoGenerate = toggleAutoGenerate;
window.setAutoGenerateDelay = setAutoGenerateDelay;
window.clampHoleDiameter = clampHoleDiameter;
window.syncWallModeUI = syncWallModeUI;
window.syncBlobVaseLayersUI = syncBlobVaseLayersUI;
window.setSimSpeed = setSimSpeed;
window.selectDesignTab = selectDesignTab;
window.applyCustomFeatureFromEditor = applyCustomFeatureFromEditor;
window.saveCustomFeature = saveCustomFeature;
window.exportFeatureLibrary = exportFeatureLibrary;
window.importFeatureLibrary = importFeatureLibrary;

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.feather) window.feather.replace();
  const restored = restoreSavedSettings();
  restoreDownloadFilename();
  initHelpTips();
  initDesignPresets({ skipAutoApply: restored });
  initThree();

  // Restore auto-generate preferences
  const savedAutoGen = localStorage.getItem('gwtf.autoGenerate');
  if (savedAutoGen !== null) {
    autoGenerateEnabled = savedAutoGen === '1';
    const toggle = document.getElementById('auto-generate-toggle');
    if (toggle) toggle.checked = autoGenerateEnabled;
  }
  const savedDelay = localStorage.getItem('gwtf.autoGenerateDelay');
  if (savedDelay !== null) {
    AUTO_GENERATE_DELAY = Math.max(100, parseInt(savedDelay) || 500);
    const delayInput = document.getElementById('auto-generate-delay');
    if (delayInput) delayInput.value = AUTO_GENERATE_DELAY;
  }

  // Wire auto-generate on sidebar input changes
  setupAutoGenerate();

  // Scroll to designer and show return banner if we have saved state
  handleReturnState(restored);

  // Auto-generate on load
  setTimeout(generate, 200);
});

/** Attach auto-generate listeners to all sidebar inputs */
function setupAutoGenerate() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const inputs = sidebar.querySelectorAll('input, select, textarea');
  inputs.forEach((el) => {
    // Skip textareas (custom gcode)
    if (el.tagName === 'TEXTAREA') return;
    el.addEventListener('input', scheduleAutoGenerate);
    el.addEventListener('change', scheduleAutoGenerate);
  });
}

function initHelpTips() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  Object.entries(HELP_TEXT_BY_ID).forEach(([id, text]) => {
    const input = sidebar.querySelector(`#${id}`);
    if (!input) return;
    const field = input.closest('.field');
    const fieldCheck = input.closest('.field-check');
    const label = field?.querySelector('label') || fieldCheck?.querySelector(`label[for="${id}"]`) || fieldCheck?.querySelector('label');
    if (!label) return;
    attachHelpTip(label, text, HELP_TIP_ID_BY_INPUT[id]);
  });

  sidebar.querySelectorAll('[title]').forEach((el) => el.removeAttribute('title'));

  const closeAll = () => {
    sidebar.querySelectorAll('.help-tip[data-open="true"]').forEach((tip) => tip.removeAttribute('data-open'));
  };

  sidebar.addEventListener('click', (event) => {
    const tip = event.target.closest('.help-tip');
    if (!tip) {
      closeAll();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const isOpen = tip.getAttribute('data-open') === 'true';
    closeAll();
    if (!isOpen) tip.setAttribute('data-open', 'true');
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.help-tip')) return;
    closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

function attachHelpTip(label, text, tipId) {
  if (!text) return;
  if (label.querySelector('.help-tip')) return;
  const tip = document.createElement('button');
  tip.type = 'button';
  tip.className = 'help-tip';
  tip.setAttribute('data-help', text);
  tip.setAttribute('aria-label', 'Help');
  tip.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  if (tipId) tip.id = tipId;

  const val = label.querySelector('.val');
  if (val) {
    label.insertBefore(tip, val);
  } else {
    label.appendChild(tip);
  }
}

function handleReturnState(restored) {
  const hasSavedSettings = !!localStorage.getItem(STORAGE_KEYS.settings);
  const hasActiveDesign = !!localStorage.getItem(STORAGE_KEYS.activeDesign);
  const shouldPrompt = restored || hasSavedSettings || hasActiveDesign;

  if (shouldPrompt) {
    const designer = document.getElementById('designer');
    if (designer) designer.scrollIntoView({ behavior: 'smooth' });

    const banner = document.getElementById('return-banner');
    if (banner) banner.classList.remove('hidden');

    const keepBtn = document.getElementById('btn-keep-project');
    const newBtn = document.getElementById('btn-new-project');
    const exportNewBtn = document.getElementById('btn-export-new');

    if (keepBtn) {
      keepBtn.onclick = () => {
        if (banner) banner.classList.add('hidden');
      };
    }

    if (newBtn) {
      newBtn.onclick = () => {
        if (banner) banner.classList.add('hidden');
        openTransferModal();
      };
    }

    if (exportNewBtn) {
      exportNewBtn.onclick = () => {
        exportLatestProject();
        if (banner) banner.classList.add('hidden');
        openTransferModal();
      };
    }
  }
}

function openTransferModal() {
  const modal = document.getElementById('transfer-modal');
  if (modal) modal.classList.remove('hidden');

  const btnFresh = document.getElementById('btn-start-fresh');
  const btnSelected = document.getElementById('btn-transfer-selected');
  const btnAll = document.getElementById('btn-transfer-all');

  if (btnFresh) {
    btnFresh.onclick = () => startNewProject({ transferMode: 'none' });
  }
  if (btnSelected) {
    btnSelected.onclick = () => startNewProject({ transferMode: 'selected' });
  }
  if (btnAll) {
    btnAll.onclick = () => startNewProject({ transferMode: 'all' });
  }
}

function closeTransferModal() {
  const modal = document.getElementById('transfer-modal');
  if (modal) modal.classList.add('hidden');
}

function exportLatestProject() {
  const rawSettings = localStorage.getItem(STORAGE_KEYS.settings);
  const settings = rawSettings ? JSON.parse(rawSettings) : readParams();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeDesign: localStorage.getItem(STORAGE_KEYS.activeDesign) || 'vase',
    settings,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gwtf-latest-project.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function startNewProject({ transferMode }) {
  const rawSettings = localStorage.getItem(STORAGE_KEYS.settings);
  const previous = rawSettings ? JSON.parse(rawSettings) : readParams();

  const selected = {
    bed: document.getElementById('transfer-bed')?.checked,
    filament: document.getElementById('transfer-filament')?.checked,
    temps: document.getElementById('transfer-temps')?.checked,
    fan: document.getElementById('transfer-fan')?.checked,
  };

  let transferKeys = [];
  if (transferMode === 'all') {
    transferKeys = [
      'bedOrigin', 'centerX', 'centerY',
      'filamentD',
      'baseNozzleTemp', 'nozzleTemp', 'baseBedTemp', 'bedTemp',
      'fanPercent', 'travelSpeed',
    ];
  } else if (transferMode === 'selected') {
    if (selected.bed) transferKeys.push('bedOrigin', 'centerX', 'centerY');
    if (selected.filament) transferKeys.push('filamentD');
    if (selected.temps) transferKeys.push('baseNozzleTemp', 'nozzleTemp', 'baseBedTemp', 'bedTemp');
    if (selected.fan) transferKeys.push('fanPercent', 'travelSpeed');
  }

  localStorage.removeItem(STORAGE_KEYS.settings);
  localStorage.removeItem(STORAGE_KEYS.activeDesign);
  resetDefaults();

  if (transferKeys.length) {
    const transferSettings = {};
    transferKeys.forEach((key) => {
      if (previous && previous[key] !== undefined) transferSettings[key] = previous[key];
    });
    loadSettingsToUI(transferSettings);
  }

  const vaseTab = document.querySelector('.design-subtab[data-design="vase"]')
    || document.querySelector('.design-tab[data-design="vase"]');
  if (vaseTab) selectDesignTab(vaseTab);

  closeTransferModal();
  generate();
}
