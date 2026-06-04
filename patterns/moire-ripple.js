// moire-ripple.js — TWO-STRIP pattern (Output Expander). Fires the SAME
// outward-traveling wave on both strips. Because the strips share a physical
// length but differ in pixel pitch (300 vs 150 px), each samples the wave at a
// different rate, so the two wavefronts visibly drift in and out of phase — a
// shimmering moiré/interference between the strips, strongest on the drop.
//
// Wiring (this install): expander out0 = 300 px, out1 = 150 px, same physical
// length. One continuous index space: 0..299 = out0, 300..449 = out1. Edit N0
// if yours differs. Must be the active pattern for setVars to land (see
// ../index.html).
//
// The wave is driven by physical position (0..1), identical on both strips — the
// density mismatch alone produces the interference. Beats speed up and brighten
// the ripples; level keeps a gentle baseline motion. Crank CYCLES for more moiré.

var N0 = 300                       // out0 pixel count; out1 = pixelCount - N0
var CYCLES = 10                    // spatial wave cycles across the strip; ↑ = more moiré
export var beat = 0
export var bass = 0
export var treble = 0
export var level = 0

var eBeat = 0, eLevel = 0, eTreble = 0
var phase = 0
function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  eBeat   = envelope(beat,   eBeat,   delta, 140)
  eLevel  = envelope(level,  eLevel,  delta, 300)
  eTreble = envelope(treble, eTreble, delta, 250)
  // ripples fly outward faster on beats; idle drift from overall level.
  var speed = 1.5 + eLevel * 4 + eBeat * 6
  phase = phase + delta / 1000 * speed
}

// shared wave: f is physical position 0..1 (same on both strips).
function ripple(f) {
  var dc = abs(f - 0.5) * 2                          // 0 center → 1 ends
  var w = wave(dc * CYCLES - phase)                  // travels outward from center
  var v = clamp(w * w * (0.2 + eBeat * 0.9 + eLevel * 0.4), 0, 1)
  var h = 0.55 + dc * 0.25 - eBeat * 0.15 + eTreble * 0.1
  hsv(h, 1, v)
}

export function render(index) {
  if (index < N0) {
    ripple(N0 > 1 ? index / (N0 - 1) : 0)
  } else {
    var n1 = pixelCount - N0
    ripple(n1 > 1 ? (index - N0) / (n1 - 1) : 0)
  }
}
