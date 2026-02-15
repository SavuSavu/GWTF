// src/ui/stats.js
import { readParams } from './params.js';

export function updateStatistics(builder, settings) {
  const params = settings || readParams();

  // Distance estimate (extrusion only)
  let totalDistance = 0;
  const points = builder.extrudePoints || [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dz = points[i].z - points[i - 1].z;
    totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Time estimate (rough)
  const avgSpeed = params.printSpeed || 25;
  const printTimeMinutes = totalDistance / avgSpeed / 60;
  const hours = Math.floor(printTimeMinutes / 60);
  const minutes = Math.round(printTimeMinutes % 60);
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  document.getElementById('stat-print-time').textContent = timeStr;

  // Filament usage
  const filamentMm = builder.e || 0;
  const filamentM = (filamentMm / 1000).toFixed(2);
  document.getElementById('stat-filament').textContent = `${filamentM} m`;

  // Weight (assuming PLA density ~1.24 g/cm³)
  const filamentDiameter = params.filamentD || 1.75;
  const filamentRadius = filamentDiameter / 2;
  const volumeCm3 = (Math.PI * filamentRadius * filamentRadius * filamentMm) / 1000;
  const weightG = (volumeCm3 * 1.24).toFixed(1);
  document.getElementById('stat-weight').textContent = `${weightG} g`;

  // Update compact summary
  const compactTime = document.getElementById('stat-print-time-compact');
  const compactWeight = document.getElementById('stat-weight-compact');
  if (compactTime) compactTime.textContent = timeStr;
  if (compactWeight) compactWeight.textContent = `${weightG}g`;

  // Temperatures
  document.getElementById('stat-nozzle-base').textContent =
    `${params.baseNozzleTemp || '—'}°C`;
  document.getElementById('stat-nozzle-wall').textContent =
    `${params.nozzleTemp || '—'}°C`;
  document.getElementById('stat-bed-temp').textContent =
    `${params.bedTemp || params.baseBedTemp || '—'}°C`;

  // Flow
  document.getElementById('stat-flow-base').textContent =
    `${(params.baseFlow || 1.0).toFixed(2)}×`;
  document.getElementById('stat-flow-wall').textContent =
    `${(params.flow || 1.0).toFixed(2)}×`;

  // Info
  document.getElementById('stat-date').textContent = new Date().toLocaleDateString();
  document.getElementById('stat-lines').textContent = builder.lines.length.toLocaleString();
}

export function toggleStatsPanel() {
  const panel = document.getElementById('stats-panel');
  if (!panel) return;
  panel.classList.toggle('collapsed');
}
