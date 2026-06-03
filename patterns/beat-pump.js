// beat-pump.js — whole-strip beat pump, driven by `bass` (+ `treble` for hue).
//
// No mic: a browser/streamer (see ../index.html) analyzes music and pushes these
// four exported vars over the Pixelblaze WebSocket API (`setVars`) at ~40 Hz.
// They arrive 0..1. This pattern must be the ACTIVE one for setVars to land.
//
// The whole strip slams to full brightness on every bass hit, then decays — a
// punchy kick-drum pump. The hue drifts with `treble` (bright, busy highs push
// the color toward red), so the strip changes character with the music. Fleshes
// out the "beat pump" sketch in reactive.js's comments with proper envelopes.

export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

// bass: instant attack so kicks land hard, slow-ish fall (~180 ms) for the pump.
var eBass = 0
// treble: gentler envelope (~300 ms) so the hue drifts instead of flickering.
var eTreble = 0

function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  eBass   = envelope(bass,   eBass,   delta, 180)
  eTreble = envelope(treble, eTreble, delta, 300)
}

export function render(index) {
  // hue: blue/cyan when highs are quiet → red as treble energy rises.
  var h = 0.6 - eTreble * 0.6
  // square-law brightness for punch; small floor so the strip never goes black.
  var v = clamp(eBass * eBass, 0.02, 1)
  hsv(h, 1, v)
}
