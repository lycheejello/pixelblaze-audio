// sparkle.js — treble twinkle over a bass-tinted base, driven by all four vars.
//
// No mic: a browser/streamer (see ../index.html) analyzes music and pushes these
// four exported vars over the Pixelblaze WebSocket API (`setVars`) at ~40 Hz.
// They arrive 0..1. This pattern must be the ACTIVE one for setVars to land.
//
// A dim base glow tinted and brightened by `bass` sits under sharp white
// sparkles that ignite on `treble` energy. Each pixel keeps its own brightness
// that decays every frame; when treble is loud, random pixels get re-lit, so
// hi-hats and cymbals scatter twinkles across the strip. More treble → more
// sparkles, faster. `level` gives the base a gentle overall lift.

export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

var eBass = 0, eTreble = 0, eLevel = 0

function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

// per-pixel sparkle brightness (0..1), (re)sized once pixelCount is known.
var spark = array(0)
var lastCount = 0

export function beforeRender(delta) {
  eBass   = envelope(bass,   eBass,   delta, 150)
  eTreble = envelope(treble, eTreble, delta, 80)   // snappy: cymbals are transient
  eLevel  = envelope(level,  eLevel,  delta, 200)

  // (re)size the spark buffer if the strip length is now known/changed.
  if (pixelCount != lastCount) {
    spark = array(pixelCount)
    lastCount = pixelCount
  }

  // decay every pixel's sparkle (~150 ms to fade out).
  var decay = 1 - min(1, delta / 150)
  // ignite probability scales with treble energy; gate out quiet passages.
  var ignite = eTreble > 0.08 ? eTreble * eTreble * 0.6 : 0
  for (var i = 0; i < pixelCount; i++) {
    spark[i] = spark[i] * decay
    if (random(1) < ignite) spark[i] = 1   // fresh white twinkle
  }
}

export function render(index) {
  // base: a dim warm-to-magenta glow that swells with bass, lifted a touch by level.
  var baseV = clamp(eBass * eBass * 0.5 + eLevel * 0.08, 0, 0.6)
  var baseH = 0.95 - eBass * 0.12          // deep red/magenta, shifting with bass
  var s = spark[index]
  if (s > 0.01) {
    // sparkle on top: low saturation → bright white-blue flash, fading to base hue.
    hsv(0.6, 1 - s, max(baseV, s))
  } else {
    hsv(baseH, 1, baseV)
  }
}
