// src/utils/math.js
// Tiny helpers shared across the app.

export function fmt(x) {
  // Up to 5 decimals, strip trailing zeros (matches original behavior)
  let s = Number(x).toFixed(5);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
