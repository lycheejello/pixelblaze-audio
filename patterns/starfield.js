// starfield.js — a chill, culty star-lounge ceiling that the drone breathes.
//
// Built for the "Shrine" (a hub-tent star ceiling): ~150-300 addressable RGBW
// pixels scattered behind a diffusing scrim. This is NOT a VU meter and NOT a
// stark ritual field either — the register is chill/lounge/upbeat but still culty:
// stars twinkle on their own over a cozy violet floor, with a little loungey color
// (violet → magenta → faint gold), the drone/chant gently *breathes* the whole
// field, a beat can launch a shooting star, and treble sharpens the twinkle.
//
// No mic: a browser/streamer (see ../index.html) analyzes the audio and pushes
// the exported vars over the Pixelblaze WebSocket API (`setVars`) at ~40 Hz. They
// arrive 0..1. This pattern must be the ACTIVE one for setVars to land.
//
// 2D — NEEDS A PIXEL MAP. This uses render2D(index, x, y): set a 2D map in the
// Pixelblaze Mapper tab (the app's "copy map" button gives you one that matches
// the preview). x,y arrive normalized ~0..1, center ~(0.5, 0.5). Without a map
// the fallback render() below still twinkles, just with no spatial effects
// (shooting star, drift).
//
// RGBW: set the LED type to "SK6812 RGBW" on the Pixelblaze so a saturation~0
// (white) star routes to the cool-white channel = clean cold-white, not dirty
// blue-pink. On plain RGB pixels the stars still read white, just less pure.

// ── streamed audio contract (0..1) ──────────────────────────────────────────
export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0
export var beat = 0            // decaying pulse, snaps to 1 on a detected beat

// ── tunable knobs (the app's starfield panel streams these live) ─────────────
// defaults lean chill-lounge (alive, a little colorful), not stark ritual.
export var twinkle = 0.7      // depth of autonomous twinkle (0 = steady, 1 = full blink)
export var twSpeed = 0.7      // twinkle speed scale
export var breathe = 0.5      // how much the drone (level) breathes the whole field
export var drift   = 0.5      // speed of the faint nebula shimmer drifting across
export var shoot   = 0.5      // chance a beat launches a shooting star (0 = never)
export var violet  = 0.2      // cozy violet resting glow under the stars (0 = stark black)
export var tint    = 0.5      // star color: 0 = clinical cold white, up = loungey color
export var bright  = 0.7      // master brightness (turn down for the real dark tent)

// ── audio envelopes (fast attack, slow fall) so a stuttering stream is smooth ─
var eLevel = 0, eTreble = 0, eMid = 0, eBeat = 0
function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}
// frac() is a Pixelblaze built-in (fractional part, x - floor(x)) — no local def.

// ── shooting star (a bright point crossing the dome, spawned on a beat) ──────
var cx = 0, cy = 0, cvx = 0, cvy = 0, clife = 0, prevBeat = 0
var clock = 0

export function beforeRender(delta) {
  var dt = delta / 1000
  clock = clock + dt
  eLevel  = envelope(level,  eLevel,  delta, 350)
  eMid    = envelope(mid,    eMid,    delta, 300)
  eTreble = envelope(treble, eTreble, delta, 80)    // snappy: chant sibilance / bells
  eBeat   = envelope(beat,   eBeat,   delta, 140)

  // spawn a shooting star on a beat's rising edge (with cooldown + probability).
  if (beat > 0.6 && prevBeat <= 0.6 && clife <= 0 && random(1) < shoot) {
    // launch from a random point on the rim, aimed roughly across the field.
    var a = random(6.283)                 // entry angle around the rim
    cx = 0.5 + cos(a) * 0.6
    cy = 0.5 + sin(a) * 0.6
    var speed = 1.6 + random(1.2)         // crosses in <1s
    cvx = -cos(a) * speed + (random(1) - 0.5) * 0.6
    cvy = -sin(a) * speed + (random(1) - 0.5) * 0.6
    clife = 1
  }
  prevBeat = beat
  if (clife > 0) {
    cx = cx + cvx * dt
    cy = cy + cvy * dt
    clife = clife - dt * 1.4              // fades over ~0.7s
    // die when it leaves the field
    if (cx < -0.2 || cx > 1.2 || cy < -0.2 || cy > 1.2) clife = 0
  }
}

// core star brightness for a pixel at (x,y) with per-star pseudo-random phase.
function starV(index, x, y) {
  // per-star, deterministic from index (no arrays): decorrelated irrationals.
  var ph  = frac(index * 0.6180339887)                 // twinkle phase
  var spd = 0.3 + frac(index * 0.7548776662) * 1.1     // each star's own rate
  var h3  = frac(index * 0.9098300562)
  var base = 0.1 + h3 * h3 * h3 * 0.5                  // skewed: most stars dim, a few bright (like a real sky)

  // autonomous twinkle (square the wave = sharper, star-like blink).
  var tw = wave(clock * twSpeed * spd + ph)
  tw = tw * tw
  var v = base * (1 - twinkle) + base * twinkle * tw

  // treble sharpens the twinkles (hi-hats / bells / sibilant chant).
  v = v + eTreble * 0.35 * tw

  // faint large-scale nebula shimmer drifting across the field (spatial life).
  v = v + 0.06 * wave(x * 0.6 + y * 0.4 - clock * drift * 0.05)

  // constellations pulse gently with the drone's mids (grouped by index).
  v = v + eMid * 0.12 * wave(clock * 0.08 + frac(floor(index / 8) * 0.4))

  // audio LIFTS the field — idle stays fully visible; loudness + beats brighten it.
  v = v * (1 + breathe * (1.4 * eLevel + 0.5 * eBeat))

  // shooting star: bright point with a tight radial falloff.
  if (clife > 0) {
    var d = hypot(x - cx, y - cy)
    var comet = clife * clamp(1 - d / 0.09, 0, 1)
    comet = comet * comet
    if (comet > v) v = comet
  }
  return v * bright
}

// paint one pixel: a cozy violet floor under loungey, slightly-colored stars.
function paintStar(index, v) {
  var floorV = violet * 0.12
  if (v < floorV) {
    hsv(0.72, 0.65, floorV)                 // cozy violet resting glow (culty warmth)
    return
  }
  // per-star hue sweeps violet → magenta → faint gold (a lounge palette, not clinical).
  var hue = 0.72 + frac(index * 0.5453) * 0.36
  // `tint` sets how colored vs white; brighter twinkles flare toward white.
  var sat = tint * (0.4 + 0.5 * frac(index * 0.311)) * clamp(1.2 - v, 0, 1)
  hsv(hue, sat, clamp(v, 0, 1))             // tint=0 & RGBW → clean cold-white stars
}

export function render2D(index, x, y) {
  paintStar(index, starV(index, x, y))
}

// fallback with no map: twinkle still works, spatial effects fold out to center.
export function render(index) {
  paintStar(index, starV(index, 0.5, 0.5))
}
