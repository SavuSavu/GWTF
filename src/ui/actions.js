// src/ui/actions.js
import { fmt } from '../utils/math.js';
import { resizeThree } from '../preview/threePreview.js';

export function downloadGcode() {
  const text = document.getElementById('gcode-editor').value;
  if (!text) {
    alert('No G-code to download. Click Generate first.');
    return;
  }
  const nameInput = document.getElementById('download-filename');
  const baseName = (nameInput?.value || '').trim() || 'vase_wavy';
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = baseName + '.gcode';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function saveDownloadFilename(name) {
  localStorage.setItem('gwtf.downloadFilename', name);
}

export function restoreDownloadFilename() {
  const saved = localStorage.getItem('gwtf.downloadFilename');
  if (saved) {
    const el = document.getElementById('download-filename');
    if (el) el.value = saved;
  }
}

export function copyGcode() {
  const text = document.getElementById('gcode-editor').value;
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const dot = document.getElementById('status-dot');
    const statusMsg = document.getElementById('status-msg');
    if (dot) dot.className = 'status-indicator ready';
    if (statusMsg) statusMsg.textContent = 'Copied to clipboard!';
    setTimeout(() => {
      if (statusMsg) statusMsg.textContent = 'Ready';
    }, 2000);
  });
}

export function switchTab(tabEl) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  tabEl.classList.add('active');
  document.getElementById(tabEl.dataset.panel).classList.add('active');

  // Resize Three.js viewport when switching back to preview
  if (tabEl.dataset.panel === 'panel-preview') {
    setTimeout(resizeThree, 50);
  }
}

export function toggleSection(id) {
  document.getElementById(id).classList.toggle('collapsed');
}
