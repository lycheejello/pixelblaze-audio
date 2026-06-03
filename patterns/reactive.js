// reactive.js — audio-reactive Pixelblaze pattern, driven by streamed bands.
//
// No mic: a browser/streamer (see ../index.html) analyzes music and pushes
// these four exported vars over the Pixelblaze WebSocket API (`setVars`) at
// ~40 Hz. They arrive 0..1. The pattern must be the ACTIVE one for setVars to
// land on it.
//
// Layout: a spectrum along the strip — bass at one end, treble at the other,
// each third's brightness driven by its band. Fast attack, slow decay = a VU feel.

export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

// smoothed envelopes (instant rise, ~150 ms fall) so a stuttering stream
// doesn't strobe.
var eBass = 0, eMid = 0, eTreble = 0
function envelope(target, current, delta) {
  return target > current ? target : current + (target - current) * min(1, delta / 150)
}

export function beforeRender(delta) {
  eBass   = envelope(bass,   eBass,   delta)
  eMid    = envelope(mid,    eMid,    delta)
  eTreble = envelope(treble, eTreble, delta)
}

export function render(index) {
  var f = pixelCount > 1 ? index / (pixelCount - 1) : 0   // 0..1 along the strip
  var amp = f < 1 / 3 ? eBass : (f < 2 / 3 ? eMid : eTreble)
  var h = 0.66 - f * 0.66            // bass = blue … treble = red
  hsv(h, 1, clamp(amp * amp, 0, 1))  // square = punchier dynamics
}

// --- alternates: paste over render() to taste ---
//
// Whole-strip beat pump (color drifts with treble, brightness slams on bass):
//   export function render(index) {
//     hsv(0.6 - eTreble * 0.4, 1, clamp(eBass * eBass, 0.02, 1))
//   }
//
// Level-as-VU bar (lights up from one end with overall loudness):
//   export function render(index) {
//     var f = index / (pixelCount - 1)
//     hsv(0.33 - f * 0.33, 1, f < level ? 1 : 0)
//   }
