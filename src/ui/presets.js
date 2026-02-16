// src/ui/presets.js
import { readParams, loadSettingsToUI } from './params.js';

const STORAGE_KEYS = {
  settings: 'gwtf.savedSettings',
  activeDesign: 'gwtf.activeDesign',
  customFeatures: 'gwtf.customFeatures',
};

const DEFAULT_PRESETS = [
  {
    id: 'vase',
    name: 'Vase',
    icon: 'box',
    description: 'Classic seamless spiral vase with soft waves.',
    settings: {
      outerD: 100,
      topOuterD: 100,
      height: 150,
      holeD: 0,
      baseLayers: 3,
      gradualLayers: 5,
      waveAmp: 1.5,
      waveCount: 14,
      waveShape: 0.2,
      interference: 1,
      zWaveAmp: 0,
      zWaveCycles: 0,
      layerHeight: 0.45,
      lineWidth: 1.9,
      printSpeed: 25,
      wallMode: 'vase',
    },
  },
  {
    id: 'lampshade',
    name: 'Lampshade',
    icon: 'aperture',
    description: 'Light socket opening with taller, airy walls.',
    settings: {
      outerD: 140,
      topOuterD: 180,
      height: 200,
      holeD: 39,
      baseLayers: 4,
      gradualLayers: 6,
      waveAmp: 2.2,
      waveCount: 20,
      waveShape: 0.35,
      interference: 0.85,
      zWaveAmp: 1.5,
      zWaveCycles: 2,
      layerHeight: 0.5,
      lineWidth: 1.4,
      printSpeed: 28,
      wallMode: 'vase',
    },
  },
  {
    id: 'imvase',
    name: 'Blob Mode (IM-Vase)',
    icon: 'droplet',
    description: 'Injection-molding style blob vase / lampshade.',
    settings: {
      outerD: 80,
      topOuterD: 100,
      height: 100,
      holeD: 0,
      baseLayers: 4,
      gradualLayers: 0,
      waveAmp: 0,
      waveCount: 0,
      waveShape: 0,
      interference: 0,
      zWaveAmp: 0,
      zWaveCycles: 0,

      // Standard 0.4 nozzle base
      baseLayerHeight: 0.2,
      baseLineWidth: 0.41,
      baseFlow: 1.0,
      basePattern: 'concentric',
      baseNozzleTemp: 215,
      baseBedTemp: 60,
      basePrintSpeed: 20,

      // Blob wall settings
      wallMode: 'blob',
      layerHeight: 2.0,
      lineWidth: 0.41,
      flow: 1.0,
      nozzleTemp: 230,
      bedTemp: 60,
      printSpeed: 25,

      blobDotsPerRev: 24,
      blobDotHeight: 2.0,
      blobDotExtrusion: 4.0,
      blobDwellMs: 800,
      blobExtrudeSpeed: 2.0,
      blobLayerOffset: 0.5,
      blobClearanceZ: 3.0,
      blobNozzleTemp: 230,
      blobFanPercent: 30,
      blobTransitionCurvature: 0,
      blobTransitionPathIncrease: 0,
      blobLayerTransitionOffset: 0,

      filamentD: 1.75,
      fanPercent: 30,
      travelSpeed: 120,
      segmentsPerRev: 420,
    },
  },
];

function getCustomFeatures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customFeatures);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse custom features:', err);
    return [];
  }
}

function saveCustomFeatures(list) {
  localStorage.setItem(STORAGE_KEYS.customFeatures, JSON.stringify(list));
}

function getPresetById(id) {
  const custom = getCustomFeatures();
  return DEFAULT_PRESETS.find((p) => p.id === id) || custom.find((p) => p.id === id) || null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function setStatus(message) {
  const statusMsg = document.getElementById('status-msg');
  if (!statusMsg) return;
  statusMsg.innerHTML = `<span class="status-indicator ready"></span>${message}`;
}

function setCustomUiVisible(isCustom) {
  const designbar = document.querySelector('.designbar');
  if (designbar) designbar.classList.toggle('show-feature-actions', isCustom);
  const panels = document.querySelector('.design-panels');
  if (panels) panels.classList.toggle('show', isCustom);
}

export function applyPresetById(id, { generateAfter = true } = {}) {
  const preset = getPresetById(id);
  if (!preset) return;

  loadSettingsToUI(preset.settings || {});
  localStorage.setItem(STORAGE_KEYS.activeDesign, id);
  setStatus(`Design preset applied: ${preset.name}`);

  if (generateAfter && typeof window.generate === 'function') {
    window.generate();
  }
}

export function selectDesignTab(tabEl) {
  const id = tabEl?.dataset?.design;
  if (!id) return;

  // Determine if this is a vase-group subtab
  const vaseGroupIds = ['vase', 'lampshade', 'imvase'];
  const isVaseGroup = vaseGroupIds.includes(id);

  // Clear all active states
  document.querySelectorAll('.design-tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.design-subtab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.design-panel').forEach((panel) => panel.classList.remove('active'));

  if (isVaseGroup) {
    // Activate the Vase group tab
    const groupTab = document.querySelector('.design-tab[data-design="vase"]');
    if (groupTab) groupTab.classList.add('active');
    // Activate the specific subtab
    const subtab = document.querySelector(`.design-subtab[data-design="${id}"]`);
    if (subtab) subtab.classList.add('active');
  } else {
    tabEl.classList.add('active');
  }

  const panel = document.getElementById(`design-panel-${id}`);
  if (panel) panel.classList.add('active');

  setCustomUiVisible(id === 'custom');

  // Update wall_mode hidden input based on design
  const wallModeInput = document.getElementById('wall_mode');
  if (wallModeInput) {
    wallModeInput.value = id === 'imvase' ? 'blob' : 'vase';
  }

  // Visual feedback for mode-specific settings
  highlightModeSettings(id);

  if (id !== 'custom') {
    applyPresetById(id, { generateAfter: true });
  }
}

/** Highlight settings relevant to the current mode */
function highlightModeSettings(modeId) {
  const holeField = document.getElementById('field-hole-d');
  const holeHint = document.getElementById('hole-hint');
  const blobSec = document.getElementById('sec-blob');
  const waveSec = document.getElementById('sec-wave');
  const zwaveSec = document.getElementById('sec-zwave');

  // Reset highlights
  if (holeField) holeField.classList.remove('field-highlight');
  document.querySelectorAll('.param-section').forEach(s => s.classList.remove('mode-active-section'));

  if (modeId === 'lampshade') {
    // Highlight the hole diameter field for bulb socket
    if (holeField) holeField.classList.add('field-highlight');
    if (holeHint) holeHint.style.display = 'inline';
  } else {
    if (holeHint) holeHint.style.display = 'none';
  }

  if (modeId === 'imvase') {
    // Show blob section, hide wave sections
    if (blobSec) { blobSec.style.display = ''; blobSec.classList.add('mode-active-section'); }
    if (waveSec) waveSec.style.display = 'none';
    if (zwaveSec) zwaveSec.style.display = 'none';
  } else {
    // Show wave sections, hide blob section
    if (blobSec) blobSec.style.display = 'none';
    if (waveSec) waveSec.style.display = '';
    if (zwaveSec) zwaveSec.style.display = '';
  }
}

function setActiveDesignTab(id) {
  if (!id) return;
  const vaseGroupIds = ['vase', 'lampshade', 'imvase'];
  const isVaseGroup = vaseGroupIds.includes(id);

  document.querySelectorAll('.design-tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.design-subtab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.design-panel').forEach((panel) => panel.classList.remove('active'));

  if (isVaseGroup) {
    const groupTab = document.querySelector('.design-tab[data-design="vase"]');
    if (groupTab) groupTab.classList.add('active');
    const subtab = document.querySelector(`.design-subtab[data-design="${id}"]`);
    if (subtab) subtab.classList.add('active');
  } else {
    const tabEl = document.querySelector(`.design-tab[data-design="${id}"]`);
    if (tabEl) tabEl.classList.add('active');
  }

  const panel = document.getElementById(`design-panel-${id}`);
  if (panel) panel.classList.add('active');

  setCustomUiVisible(id === 'custom');
  highlightModeSettings(id);
}

export function applyCustomFeatureFromEditor() {
  const textarea = document.getElementById('feature-json');
  if (!textarea) return;

  try {
    const parsed = JSON.parse(textarea.value);
    if (!parsed || !parsed.settings) {
      alert('Feature JSON must include a settings object.');
      return;
    }
    loadSettingsToUI(parsed.settings);
    setStatus('Custom draft applied.');
    if (typeof window.generate === 'function') window.generate();
  } catch (err) {
    alert('Invalid JSON. Please fix the feature draft.');
  }
}

export function saveCustomFeature() {
  const textarea = document.getElementById('feature-json');
  if (!textarea) return;

  let parsed;
  try {
    parsed = JSON.parse(textarea.value);
  } catch (err) {
    alert('Invalid JSON. Please fix the feature draft.');
    return;
  }

  if (!parsed.name || !parsed.settings) {
    alert('Feature JSON must include a name and settings.');
    return;
  }

  const list = getCustomFeatures();
  const id = parsed.id ? slugify(parsed.id) : slugify(parsed.name);
  const uniqueId = list.some((item) => item.id === id) ? `${id}-${Date.now()}` : id;

  const feature = {
    id: uniqueId,
    name: parsed.name,
    icon: parsed.icon || 'star',
    description: parsed.description || 'Custom feature',
    settings: parsed.settings,
  };

  list.push(feature);
  saveCustomFeatures(list);
  renderCustomFeatureList();
  setStatus(`Saved custom feature: ${feature.name}`);
}

export function exportFeatureLibrary() {
  const list = getCustomFeatures();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    features: list,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gwtf-feature-library.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importFeatureLibrary(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const incoming = Array.isArray(parsed.features) ? parsed.features : [];
      const list = getCustomFeatures();
      const merged = [...list];

      incoming.forEach((feature) => {
        if (!feature || !feature.name || !feature.settings) return;
        const id = slugify(feature.id || feature.name);
        const uniqueId = merged.some((item) => item.id === id) ? `${id}-${Date.now()}` : id;
        merged.push({
          id: uniqueId,
          name: feature.name,
          icon: feature.icon || 'star',
          description: feature.description || 'Imported feature',
          settings: feature.settings,
        });
      });

      saveCustomFeatures(merged);
      renderCustomFeatureList();
      setStatus('Feature library imported.');
    } catch (err) {
      alert('Failed to import feature library.');
    }
  };
  reader.readAsText(file);

  event.target.value = '';
}

export function renderCustomFeatureList() {
  const container = document.getElementById('custom-feature-list');
  if (!container) return;

  const list = getCustomFeatures();
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No custom features saved yet.</div>';
    return;
  }

  container.innerHTML = '';
  list.forEach((feature) => {
    const item = document.createElement('div');
    item.className = 'custom-feature-item';
    item.innerHTML = `
      <div class="custom-feature-info">
        <strong>${feature.name}</strong>
        <span>${feature.description || ''}</span>
      </div>
      <button class="btn btn-secondary" data-feature="${feature.id}">Apply</button>
    `;

    const button = item.querySelector('button');
    button.addEventListener('click', () => applyPresetById(feature.id, { generateAfter: true }));
    container.appendChild(item);
  });
}

export function saveCurrentSettings() {
  const params = readParams();
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(params));
}

export function restoreSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed) return false;
    loadSettingsToUI(parsed);
    return true;
  } catch (err) {
    console.warn('Failed to restore settings:', err);
    return false;
  }
}

function setupAutosave() {
  const inputs = document.querySelectorAll('.app input, .app select, .app textarea');
  let timeoutId;

  const scheduleSave = () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      saveCurrentSettings();
    }, 250);
  };

  inputs.forEach((el) => {
    if (el.id === 'gcode-editor' || el.id === 'feature-json') return;
    el.addEventListener('input', scheduleSave);
    el.addEventListener('change', scheduleSave);
  });
}

export function initDesignPresets({ skipAutoApply = false } = {}) {
  setupAutosave();
  renderCustomFeatureList();

  let activeDesign = localStorage.getItem(STORAGE_KEYS.activeDesign);
  if (activeDesign === 'phonestand') {
    activeDesign = 'vase';
    localStorage.setItem(STORAGE_KEYS.activeDesign, 'vase');
  }
  // Try main tabs first, then subtabs
  let defaultTab = document.querySelector(`.design-tab[data-design="${activeDesign}"]`);
  if (!defaultTab) {
    defaultTab = document.querySelector(`.design-subtab[data-design="${activeDesign}"]`);
  }

  if (defaultTab) {
    if (skipAutoApply) {
      setActiveDesignTab(activeDesign);
    } else {
      selectDesignTab(defaultTab);
    }
  }

  if (!activeDesign) {
    const activeTab = document.querySelector('.design-tab.active');
    if (activeTab) setCustomUiVisible(activeTab.dataset.design === 'custom');
    // Initialize mode highlights for default vase mode
    highlightModeSettings('vase');
  }
}
