// vu-bar.js — a loudness VU bar, driven by streamed `level`.
//
// No mic: a browser/streamer (see ../index.html) analyzes music and pushes these
// four exported vars over the Pixelblaze WebSocket API (`setVars`) at ~40 Hz.
// They arrive 0..1. This pattern must be the ACTIVE one for setVars to land.
//
// Layout: the bar fills the strip from index 0 with overall loudness. The lit
// portion is colored by position — green low, yellow mid, red at the top — and a
// peak-hold pixel hangs at the loudest recent level, then slowly drips back down.
// Only `level` drives this one.

export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

// smoothed bar height (instant rise, ~120 ms fall) so a stuttering stream
// doesn't strobe the top of the bar.
var eLevel = 0
// peak-hold: snaps up to the bar height, then decays slowly (~1.2 s to floor).
var peak = 0

function envelope(target, current, delta) {
  return target > current ? target : current + (target - current) * min(1, delta / 120)
}

export function beforeRender(delta) {
  eLevel = envelope(level, eLevel, delta)
  // peak rides above the bar, then sinks at a fixed rate.
  peak = eLevel > peak ? eLevel : max(eLevel, peak - delta / 1200)
}

export function render(index) {
  var f = pixelCount > 1 ? index / (pixelCount - 1) : 0   // 0..1 along the strip
  // VU color ramp: green (0.33) at the bottom → red (0.0) at the top.
  var h = 0.33 * (1 - f)
  // peak-hold pixel: a thin bright marker at the current peak height.
  var peakLo = peak - 1 / max(1, pixelCount)
  if (f <= peak && f > peakLo) {
    hsv(0.33 * (1 - peak), 0.4, 1)   // near-white tip for the peak marker
  } else if (f < eLevel) {
    hsv(h, 1, 1)                     // lit portion of the bar
  } else {
    hsv(0, 0, 0)                     // unlit
  }
}
