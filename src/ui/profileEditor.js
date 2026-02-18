// src/ui/profileEditor.js
// Interactive 2D side-view profile editor for Z-wave contour.
// Users can draw control points on a cylinder side-view to define
// the radial profile, similar to OrcaSlicer's adaptive layer height editor.

import { clamp, lerp } from '../utils/math.js';

// ============================================================
// PROFILE EDITOR CLASS
// ============================================================

export class ProfileEditor {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts
   * @param {function} opts.onChange  – called with (points) whenever the profile changes
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = opts.onChange || (() => {});

    // Normalized control points: [{t: 0..1, r: -1..1}]
    // t = height fraction (0=bottom, 1=top), r = radial offset fraction
    this.points = [
      { t: 0, r: 0 },
      { t: 1, r: 0 },
    ];

    // Interaction state
    this.dragging = null;
    this.hovering = null;
    this.hoverCurveT = null;  // t value where cursor is near the profile curve
    this.pointRadius = 8;
    this._pointerDownPos = null;
    this._pointerMoved = false;

    // Layout margins (pixels)
    this.margin = { top: 24, right: 34, bottom: 34, left: 44 };

    // Display parameters
    this.displayHeight = 150;
    this.displayBottomR = 50;
    this.displayTopR = 50;
    this.maxAmp = 10;

    // Fullscreen overlay state
    this._isFullscreen = false;
    this._inlineParent = null;
    this._overlay = null;

    this._setupEvents();
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas.parentElement || canvas);
    this._handleResize();
  }

  // ── Public API ──

  setGeometry(bottomR, topR, height, maxAmp) {
    this.displayBottomR = bottomR;
    this.displayTopR = topR;
    this.displayHeight = height;
    this.maxAmp = Math.max(1, maxAmp);
    this.draw();
  }

  getPoints() {
    return this.points.map(p => ({ ...p }));
  }

  setPoints(pts) {
    if (!Array.isArray(pts) || pts.length < 2) {
      this.points = [{ t: 0, r: 0 }, { t: 1, r: 0 }];
    } else {
      this.points = pts.map(p => ({
        t: clamp(p.t, 0, 1),
        r: clamp(p.r, -1, 1),
      }));
      this.points.sort((a, b) => a.t - b.t);
      if (this.points[0].t > 0) this.points.unshift({ t: 0, r: 0 });
      if (this.points[this.points.length - 1].t < 1) this.points.push({ t: 1, r: 0 });
    }
    this.draw();
  }

  reset() {
    this.points = [{ t: 0, r: 0 }, { t: 1, r: 0 }];
    this.onChange(this.getPoints());
    this.draw();
  }

  generateSine(cycles, ampFraction) {
    const n = Math.max(4, Math.round(cycles * 8));
    this.points = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = clamp(ampFraction * Math.sin(cycles * 2 * Math.PI * t), -1, 1);
      this.points.push({ t, r });
    }
    this.onChange(this.getPoints());
    this.draw();
  }

  evaluate(t) {
    return evaluateProfile(this.points, t) * this.maxAmp;
  }

  // ── Fullscreen overlay ──

  toggleFullscreen() {
    if (this._isFullscreen) {
      this._exitFullscreen();
    } else {
      this._enterFullscreen();
    }
  }

  _enterFullscreen() {
    if (this._isFullscreen) return;
    this._isFullscreen = true;
    this._inlineParent = this.canvas.parentElement;

    // Create overlay backdrop
    const overlay = document.createElement('div');
    overlay.className = 'profile-editor-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._exitFullscreen();
    });

    // Container for the expanded editor
    const container = document.createElement('div');
    container.className = 'profile-editor-overlay-content';

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'profile-editor-overlay-title';
    titleBar.innerHTML = `
      <span>Z-Wave Profile Editor</span>
      <button class="profile-editor-close-btn" title="Close (Esc)">&#x2715;</button>
    `;
    titleBar.querySelector('button').addEventListener('click', () => this._exitFullscreen());

    // Canvas wrapper (drives the ResizeObserver)
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'profile-editor-overlay-canvas';
    canvasWrap.appendChild(this.canvas);

    // Hint bar
    const hint = document.createElement('div');
    hint.className = 'profile-editor-overlay-hint';
    hint.textContent = 'Click on outline to add \u2022 Drag to move \u2022 Right-click or double-click to remove';

    container.appendChild(titleBar);
    container.appendChild(canvasWrap);
    container.appendChild(hint);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // Esc key handler
    this._escHandler = (e) => { if (e.key === 'Escape') this._exitFullscreen(); };
    document.addEventListener('keydown', this._escHandler);

    // Re-observe the new parent
    this._resizeObserver.disconnect();
    this._resizeObserver.observe(canvasWrap);

    // Use RAF to let layout settle before resize
    requestAnimationFrame(() => this._handleResize());
  }

  _exitFullscreen() {
    if (!this._isFullscreen) return;
    this._isFullscreen = false;

    // Move canvas back to inline parent
    if (this._inlineParent) {
      this._inlineParent.insertBefore(this.canvas, this._inlineParent.firstChild);
    }

    // Remove overlay
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }

    // Remove Esc handler
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    // Re-observe inline parent
    this._resizeObserver.disconnect();
    this._resizeObserver.observe(this._inlineParent || this.canvas);
    requestAnimationFrame(() => this._handleResize());
  }

  destroy() {
    this._exitFullscreen();
    this._resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this.canvas.removeEventListener('dblclick', this._onDblClick);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
  }

  // ── Coordinate transforms ──

  _plotArea() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    return {
      x: this.margin.left,
      y: this.margin.top,
      w: w - this.margin.left - this.margin.right,
      h: h - this.margin.top - this.margin.bottom,
    };
  }

  _toCanvas(t, r) {
    const area = this._plotArea();
    const px = area.x + (0.5 + r * 0.4) * area.w;
    const py = area.y + (1 - t) * area.h;
    return { px, py };
  }

  _fromCanvas(px, py) {
    const area = this._plotArea();
    const t = clamp(1 - (py - area.y) / area.h, 0, 1);
    const r = clamp(((px - area.x) / area.w - 0.5) / 0.4, -1, 1);
    return { t, r };
  }

  // ── Events ──

  _setupEvents() {
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
    this._onContextMenu = this._handleContextMenu.bind(this);

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointerleave', this._onPointerLeave);
    this.canvas.addEventListener('dblclick', this._onDblClick);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Map from CSS pixels to our logical coordinate space (not raw canvas pixels)
    return {
      x: ((e.clientX - rect.left) / rect.width) * (this.canvas.width / (window.devicePixelRatio || 1)),
      y: ((e.clientY - rect.top) / rect.height) * (this.canvas.height / (window.devicePixelRatio || 1)),
    };
  }

  _findPointAt(cx, cy) {
    const threshold = this.pointRadius + 5;
    for (let i = 0; i < this.points.length; i++) {
      const { px, py } = this._toCanvas(this.points[i].t, this.points[i].r);
      if (Math.hypot(cx - px, cy - py) < threshold) return i;
    }
    return -1;
  }

  /** Find the nearest t on the profile curve within a pixel threshold */
  _findCurveT(cx, cy, maxDist = 14) {
    let bestT = null;
    let bestDist = maxDist;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = evaluateProfile(this.points, t);
      const { px, py } = this._toCanvas(t, r);
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
      }
    }
    return bestT;
  }

  _handlePointerDown(e) {
    const pos = this._getCanvasPos(e);
    this._pointerDownPos = pos;
    this._pointerMoved = false;
    const idx = this._findPointAt(pos.x, pos.y);

    if (e.button === 2) return; // right-click handled in contextmenu

    if (idx >= 0) {
      this.dragging = idx;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    }
  }

  _handlePointerMove(e) {
    const pos = this._getCanvasPos(e);

    // Track if pointer has moved significantly (for distinguishing click from drag)
    if (this._pointerDownPos) {
      const dx = pos.x - this._pointerDownPos.x;
      const dy = pos.y - this._pointerDownPos.y;
      if (Math.hypot(dx, dy) > 3) this._pointerMoved = true;
    }

    if (this.dragging !== null) {
      const { t, r } = this._fromCanvas(pos.x, pos.y);
      const pt = this.points[this.dragging];

      if (this.dragging === 0 || this.dragging === this.points.length - 1) {
        pt.r = clamp(r, -1, 1);
      } else {
        const prevT = this.points[this.dragging - 1].t + 0.005;
        const nextT = this.points[this.dragging + 1].t - 0.005;
        pt.t = clamp(t, prevT, nextT);
        pt.r = clamp(r, -1, 1);
      }
      this.onChange(this.getPoints());
      this.draw();
    } else {
      const idx = this._findPointAt(pos.x, pos.y);
      const curveT = idx < 0 ? this._findCurveT(pos.x, pos.y) : null;
      const newHover = idx >= 0 ? idx : null;
      const changed = newHover !== this.hovering || curveT !== this.hoverCurveT;
      this.hovering = newHover;
      this.hoverCurveT = curveT;

      if (newHover !== null) {
        this.canvas.style.cursor = 'grab';
      } else if (curveT !== null) {
        this.canvas.style.cursor = 'copy';
      } else {
        this.canvas.style.cursor = 'default';
      }

      if (changed) this.draw();
    }
  }

  _handlePointerUp(e) {
    const pos = this._getCanvasPos(e);

    if (this.dragging !== null) {
      this.dragging = null;
      this.canvas.releasePointerCapture(e.pointerId);
      this.canvas.style.cursor = 'default';
      this.draw();
      return;
    }

    // Single click (no drag) on the curve → add a point
    if (!this._pointerMoved && e.button === 0) {
      const idx = this._findPointAt(pos.x, pos.y);
      if (idx < 0) {
        // Check if click is near the profile curve or in the plot area
        const curveT = this._findCurveT(pos.x, pos.y, 25);
        const area = this._plotArea();
        const inArea = pos.x >= area.x && pos.x <= area.x + area.w &&
                       pos.y >= area.y && pos.y <= area.y + area.h;

        if (curveT !== null && inArea) {
          // Snap to curve's t, but use the clicked r position
          const { t, r } = this._fromCanvas(pos.x, pos.y);
          const useT = clamp(curveT, 0.005, 0.995);
          let insertIdx = this.points.findIndex(p => p.t > useT);
          if (insertIdx < 0) insertIdx = this.points.length;
          this.points.splice(insertIdx, 0, { t: useT, r: clamp(r, -1, 1) });
          this.onChange(this.getPoints());
          this.draw();
        } else if (inArea) {
          // Clicked in plot area but not near curve — add at exact click position
          const { t, r } = this._fromCanvas(pos.x, pos.y);
          if (t > 0.005 && t < 0.995) {
            let insertIdx = this.points.findIndex(p => p.t > t);
            if (insertIdx < 0) insertIdx = this.points.length;
            this.points.splice(insertIdx, 0, { t, r: clamp(r, -1, 1) });
            this.onChange(this.getPoints());
            this.draw();
          }
        }
      }
    }

    this._pointerDownPos = null;
    this._pointerMoved = false;
  }

  _handlePointerLeave() {
    if (this.hovering !== null || this.hoverCurveT !== null) {
      this.hovering = null;
      this.hoverCurveT = null;
      this.canvas.style.cursor = 'default';
      this.draw();
    }
  }

  _handleDblClick(e) {
    const pos = this._getCanvasPos(e);
    const idx = this._findPointAt(pos.x, pos.y);
    if (idx > 0 && idx < this.points.length - 1) {
      this.points.splice(idx, 1);
      this.hovering = null;
      this.hoverCurveT = null;
      this.onChange(this.getPoints());
      this.draw();
    }
  }

  _handleContextMenu(e) {
    e.preventDefault();
    const pos = this._getCanvasPos(e);
    const idx = this._findPointAt(pos.x, pos.y);
    if (idx > 0 && idx < this.points.length - 1) {
      this.points.splice(idx, 1);
      this.hovering = null;
      this.hoverCurveT = null;
      this.onChange(this.getPoints());
      this.draw();
    }
  }

  _handleResize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.floor(rect.width));
    // Taller aspect ratio for a side-view of a vase
    const h = this._isFullscreen
      ? Math.max(200, Math.floor(rect.height))
      : Math.max(180, Math.floor(w * 1.1));
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale margins and point radius for fullscreen
    if (this._isFullscreen) {
      this.margin = { top: 36, right: 50, bottom: 46, left: 60 };
      this.pointRadius = 10;
    } else {
      this.margin = { top: 24, right: 34, bottom: 34, left: 44 };
      this.pointRadius = 8;
    }
    this.draw();
  }

  // ── Drawing ──

  draw() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const area = this._plotArea();
    const isFS = this._isFullscreen;

    // Theme colors
    const style = getComputedStyle(this.canvas);
    const bgColor = style.getPropertyValue('--surface2').trim() || '#242836';
    const borderColor = style.getPropertyValue('--border').trim() || '#363b4e';
    const textDim = style.getPropertyValue('--text-dim').trim() || '#8b90a5';
    const textColor = style.getPropertyValue('--text').trim() || '#e4e6f0';
    const accentColor = style.getPropertyValue('--accent').trim() || '#6c8cff';
    const greenColor = style.getPropertyValue('--green').trim() || '#4ade80';
    const orangeColor = style.getPropertyValue('--orange').trim() || '#fb923c';
    const redColor = '#f87171';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Plot area border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(area.x, area.y, area.w, area.h);

    // Grid lines
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);

    const gridSteps = isFS ? 8 : 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = area.y + (i / gridSteps) * area.h;
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
      ctx.stroke();
    }

    // Vertical center line (r=0)
    const centerX = area.x + 0.5 * area.w;
    ctx.beginPath();
    ctx.moveTo(centerX, area.y);
    ctx.lineTo(centerX, area.y + area.h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cylinder outline (neutral taper)
    ctx.strokeStyle = textDim;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    const blc = this._toCanvas(0, 0);
    const tlc = this._toCanvas(1, 0);
    ctx.beginPath();
    ctx.moveTo(blc.px, blc.py);
    ctx.lineTo(tlc.px, tlc.py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Profile curve
    const resolution = isFS ? 300 : 150;

    // Fill area between curve and center
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const r = evaluateProfile(this.points, t);
      const { px, py } = this._toCanvas(t, r);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    for (let i = resolution; i >= 0; i--) {
      const t = i / resolution;
      const { px, py } = this._toCanvas(t, 0);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Curve stroke
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = isFS ? 3 : 2.5;
    ctx.beginPath();
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const r = evaluateProfile(this.points, t);
      const { px, py } = this._toCanvas(t, r);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Hover preview: show where a new point would be added
    if (this.hoverCurveT !== null && this.hovering === null && this.dragging === null) {
      const hR = evaluateProfile(this.points, this.hoverCurveT);
      const { px, py } = this._toCanvas(this.hoverCurveT, hR);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, this.pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = greenColor;
      ctx.fill();
      // Plus sign inside
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py);
      ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4);
      ctx.stroke();
      ctx.restore();
    }

    // Connection lines between consecutive points
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this._toCanvas(this.points[i].t, this.points[i].r);
      const b = this._toCanvas(this.points[i + 1].t, this.points[i + 1].r);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Control points
    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const { px, py } = this._toCanvas(pt.t, pt.r);
      const isHover = i === this.hovering;
      const isDrag = i === this.dragging;
      const isEndpoint = i === 0 || i === this.points.length - 1;
      const rad = this.pointRadius + (isHover || isDrag ? 3 : 0);

      // Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Outer circle
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? orangeColor : isHover ? greenColor : accentColor;
      ctx.fill();
      ctx.restore();

      // Border ring
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = isEndpoint ? '#fff' : bgColor;
      ctx.fill();

      // Label on hover/drag: show mm values
      if ((isHover || isDrag) && isFS) {
        const hMM = (pt.t * this.displayHeight).toFixed(1);
        const rMM = (pt.r * this.maxAmp).toFixed(1);
        const label = `h: ${hMM}mm  r: ${rMM >= 0 ? '+' : ''}${rMM}mm`;
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = textColor;
        const tw = ctx.measureText(label).width;
        const lx = clamp(px - tw / 2, area.x, area.x + area.w - tw);
        const ly = py - rad - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(lx - 4, ly - 12, tw + 8, 16);
        ctx.fillStyle = textColor;
        ctx.fillText(label, lx, ly);
      }
    }

    // Axis labels
    ctx.fillStyle = textDim;
    const fontSize = isFS ? 12 : 10;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';

    // Top diameter label
    ctx.fillText(`\u2300 ${(this.displayTopR * 2).toFixed(0)} mm`, centerX, area.y - 8);

    // Height ticks
    ctx.textAlign = 'right';
    const tickFont = isFS ? 10 : 9;
    ctx.font = `${tickFont}px Inter, sans-serif`;
    const ticks = isFS ? 8 : 4;
    for (let i = 0; i <= ticks; i++) {
      const t = i / ticks;
      const hVal = (t * this.displayHeight).toFixed(0);
      const y = area.y + (1 - t) * area.h;
      ctx.fillText(`${hVal}`, area.x - 6, y + 3);
    }

    // "Height" Y-axis label
    ctx.save();
    ctx.translate(12, area.y + area.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.fillText('Height \u2191', 0, 0);
    ctx.restore();

    // Bottom X labels
    ctx.textAlign = 'center';
    ctx.font = `${tickFont}px Inter, sans-serif`;
    ctx.fillText(`\u2190 In (${this.maxAmp.toFixed(0)}mm)`, area.x + area.w * 0.2, area.y + area.h + (isFS ? 18 : 14));
    ctx.fillText(`Out (${this.maxAmp.toFixed(0)}mm) \u2192`, area.x + area.w * 0.8, area.y + area.h + (isFS ? 18 : 14));

    // Point count badge
    const nPts = this.points.length;
    ctx.font = `${tickFont}px Inter, sans-serif`;
    ctx.fillStyle = textDim;
    ctx.textAlign = 'right';
    ctx.fillText(`${nPts} pts`, area.x + area.w, area.y - 6);
  }
}

// ============================================================
// PROFILE EVALUATION (used by builder and editor)
// ============================================================

export function evaluateProfile(points, t) {
  if (!points || points.length === 0) return 0;
  if (points.length === 1) return points[0].r;

  t = clamp(t, 0, 1);

  let i = 0;
  for (; i < points.length - 1; i++) {
    if (t <= points[i + 1].t) break;
  }
  if (i >= points.length - 1) return points[points.length - 1].r;

  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(points.length - 1, i + 1)];
  const p3 = points[Math.min(points.length - 1, i + 2)];

  const segLen = p2.t - p1.t;
  if (segLen < 1e-9) return p1.r;

  const u = (t - p1.t) / segLen;
  const u2 = u * u;
  const u3 = u2 * u;

  const r = 0.5 * (
    (2 * p1.r) +
    (-p0.r + p2.r) * u +
    (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * u2 +
    (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * u3
  );

  return clamp(r, -1, 1);
}

export function serializeProfile(points) {
  if (!points || points.length === 0) return '';
  return points.map(p => `${p.t.toFixed(4)}:${p.r.toFixed(4)}`).join(',');
}

export function deserializeProfile(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    const points = str.split(',').map(s => {
      const [t, r] = s.split(':').map(Number);
      if (!isFinite(t) || !isFinite(r)) return null;
      return { t: clamp(t, 0, 1), r: clamp(r, -1, 1) };
    }).filter(Boolean);
    if (points.length < 2) return null;
    points.sort((a, b) => a.t - b.t);
    return points;
  } catch {
    return null;
  }
}
