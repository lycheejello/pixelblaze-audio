// plasma.js — flowing plasma field, driven by `level`, `mid`, and `treble`.
//
// No mic: a browser/streamer (see ../index.html) analyzes music and pushes these
// four exported vars over the Pixelblaze WebSocket API (`setVars`) at ~40 Hz.
// They arrive 0..1. This pattern must be the ACTIVE one for setVars to land.
//
// A classic interfering-wave plasma. Overall `level` modulates how fast the
// field churns and how bright it gets, so the whole thing breathes with the
// music. The palette shifts with the spectrum: `mid` sets the base hue and
// `treble` widens the color spread across the strip, so busy highs paint a
// rainbow while a bass-heavy mix stays in one color family.

export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

// smoothed level (instant rise, ~200 ms fall) so speed/brightness ease rather
// than jerk between frames.
var eLevel = 0
var eMid = 0, eTreble = 0
// running phase so flow speed can vary without time() discontinuities.
var phase = 0

function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  eLevel  = envelope(level,  eLevel,  delta, 200)
  eMid    = envelope(mid,    eMid,    delta, 250)
  eTreble = envelope(treble, eTreble, delta, 250)
  // advance the field; idle drift plus a level-driven boost (delta is in ms).
  phase = phase + delta / 1000 * (0.15 + eLevel * 0.9)
}

export function render(index) {
  var f = pixelCount > 1 ? index / (pixelCount - 1) : 0   // 0..1 along the strip
  // two waves at different spatial/temporal frequencies, summed → plasma.
  var w1 = wave(f * 2 + phase)
  var w2 = wave(f * 3.7 - phase * 0.6 + wave(phase * 0.3))
  var field = (w1 + w2) / 2                                // 0..1
  // hue: base from mids, spread across the strip scaled by treble.
  var h = eMid * 0.5 + field * (0.15 + eTreble * 0.85)
  // brightness from the field, square-law for contrast, lifted by level.
  var v = clamp(field * field * (0.3 + eLevel * 0.7), 0, 1)
  hsv(h, 1, v)
}
