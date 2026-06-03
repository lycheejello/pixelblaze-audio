// spectrum.js — N-band spectrum analyzer Pixelblaze pattern, driven by the
// streamed `bands` array.
//
// No mic: the browser/streamer (see ../index.html) runs an FFT, splits 20 Hz..
// 16 kHz into N log-spaced bands, and pushes them as one array var over the
// Pixelblaze WebSocket API (`setVars`) at ~40 Hz. Values arrive 0..1. The
// pattern must be the ACTIVE one for setVars to land on it.
//
// IMPORTANT — N MUST MATCH: the array length declared here (NBANDS) must equal
// the app's "bands" slider value (app default = 16). If they differ, setVars
// only fills/uses the overlap and the rest stay 0 — so keep them in sync.
//
// Layout: the strip is split into N equal regions, one per band, left→right =
// low→high frequency. Each region's brightness follows its band; hue ramps
// blue (low) → red (high). Fast attack, slow decay (~150 ms) per band = a VU feel.

var NBANDS = 16                    // must equal the app's band count
export var bands = array(NBANDS)   // streamed in by the app via setVars

// per-band smoothed envelopes (instant rise, ~150 ms fall) so a stuttering
// stream doesn't strobe.
var env = array(NBANDS)
function envelope(target, current, delta) {
  return target > current ? target : current + (target - current) * min(1, delta / 150)
}

export function beforeRender(delta) {
  for (i = 0; i < NBANDS; i++) env[i] = envelope(bands[i], env[i], delta)
}

export function render(index) {
  var f = pixelCount > 1 ? index / (pixelCount - 1) : 0   // 0..1 along the strip
  var b = floor(f * NBANDS)                               // which band region
  if (b >= NBANDS) b = NBANDS - 1
  var amp = env[b]
  var h = 0.66 - (b / (NBANDS - 1)) * 0.66                // low = blue … high = red
  hsv(h, 1, clamp(amp * amp, 0, 1))                       // square = punchier dynamics
}
