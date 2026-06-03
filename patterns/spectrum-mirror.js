// spectrum-mirror.js — symmetrically mirrored N-band spectrum analyzer, driven
// by the streamed `bands` array. Same data + smoothing as spectrum.js; the only
// difference is the LAYOUT: the strip is folded around its center so bands
// radiate OUTWARD from the middle.
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
// Layout: position is folded around the center, so band 0 (bass) sits in the
// MIDDLE and band N-1 (treble) reaches both ENDS. Bass pulses bloom outward on
// every kick — the classic mirrored-VU "heartbeat" look. Fast attack, slow
// decay (~150 ms) per band = a VU feel.
//
// warmCenter toggles the hue ramp without changing the layout:
//   true  → warm core, cool edges (bass = red center … treble = blue ends)
//   false → cool core, warm edges (bass = blue center … treble = red ends)
// Flip it live from the Pixelblaze UI (Vars) or here, no re-layout needed.

var NBANDS = 16                    // must equal the app's band count
export var bands = array(NBANDS)   // streamed in by the app via setVars
var warmCenter = 1                 // 1 = red middle, 0 = blue middle

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
  var m = abs(f - 0.5) * 2                                // 0 at center → 1 at both ends
  var b = floor(m * NBANDS)                               // which band region (folded)
  if (b >= NBANDS) b = NBANDS - 1
  var amp = env[b]
  var t = b / (NBANDS - 1)                                // 0 (center/bass) … 1 (ends/treble)
  var h = warmCenter ? t * 0.66 : 0.66 - t * 0.66        // warm or cool core
  hsv(h, 1, clamp(amp * amp, 0, 1))                       // square = punchier dynamics
}
