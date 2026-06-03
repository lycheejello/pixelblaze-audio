// beat.js — whole-strip beat flash, driven by the streamed `beat` pulse.
//
// No mic: the browser/streamer (see ../index.html) runs bass-flux onset
// detection and pushes `beat` over the Pixelblaze WebSocket API (`setVars`) at
// ~40 Hz. `beat` arrives as a pulse: ~1 on a detected beat, decaying toward 0.
// The other four bands are streamed too and exported here so you can mix them
// in. The pattern must be the ACTIVE one for setVars to land on it.
//
// On each beat the whole strip slams bright, then falls away — a strobe-free
// flash synced to the kick. Hue drifts with `treble` so the color tracks the
// music's brightness. Tune feel from the app's "beat sens" slider.

export var beat = 0
export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

// the incoming pulse already decays, but smooth the fall a touch more (instant
// rise, ~140 ms fall) so frame-to-frame jitter in the stream doesn't flicker.
var eBeat = 0
var eTreble = 0
function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  eBeat   = envelope(beat,   eBeat,   delta, 140)
  eTreble = envelope(treble, eTreble, delta, 300)
}

export function render(index) {
  // hue: cyan/blue when highs are quiet → red as treble rises.
  var h = 0.55 - eTreble * 0.55
  // square-law brightness for a punchy flash; small floor so it never goes black.
  var v = clamp(eBeat * eBeat, 0.02, 1)
  hsv(h, 1, v)
}
