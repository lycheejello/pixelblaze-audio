// depth-layers.js — TWO-STRIP pattern (Output Expander). Treats the two strips
// as physically-aligned LAYERS at different resolutions: the dense strip is the
// crisp FOREGROUND, the sparse strip is a soft, blurry BACKGROUND wash.
//
// Wiring (this install): expander out0 = 300 px (dense), out1 = 150 px (sparse),
// same physical length → out1 has half the pixel pitch. The expander presents
// one continuous index space: 0..299 = out0, 300..449 = out1. Edit N0 if yours
// differs. Single active pattern, so setVars lands here (see ../index.html).
//
// Foreground (dense): N-band spectrum with white treble sparkles on top.
// Background (sparse): slow color wash that blooms with bass and drifts with
// level — low resolution makes it read as an out-of-focus glow behind the detail.

var N0 = 300                       // out0 (dense) pixel count; out1 = pixelCount - N0
var NBANDS = 16                    // must equal the app's band count
var sparkleRate = 0.3              // sparkle density on treble HITS; lower = calmer (0 = off)
export var bands = array(NBANDS)
export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0

var env = array(NBANDS)
var eBass = 0, eMid = 0, eTreble = 0, eLevel = 0
var tSlow = 0                      // slow treble baseline, for transient detection
var bgPhase = 0                    // slow drift for the background wash
// pixelCount is the device's TOTAL pixel count and is known at init, so size the
// buffer from it directly. (Pixelblaze arrays are fixed-size — you can't grow one
// at runtime, which is why we allocate here, not in beforeRender.) The dense strip
// only uses indices 0..N0-1, but allocating the full length keeps indexing trivial.
var spark = array(pixelCount)      // per-pixel sparkle, dense strip only

function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  for (var i = 0; i < NBANDS; i++) env[i] = envelope(bands[i], env[i], delta, 150)
  eBass   = envelope(bass,   eBass,   delta, 150)
  eMid    = envelope(mid,    eMid,    delta, 250)
  eTreble = envelope(treble, eTreble, delta, 80)    // snappy for cymbals
  eLevel  = envelope(level,  eLevel,  delta, 350)   // slow, dreamy background
  // background drifts slowly, faster when the track is loud — never fully static.
  bgPhase = bgPhase + delta / 1000 * (0.05 + eLevel * 0.4)

  // Sparkle on treble TRANSIENTS (hits), not sustained busy highs: track a slow
  // treble baseline and ignite only on the excess above it. A wall of hi-hats
  // lifts the baseline and self-limits, so dense mixes keep their color instead
  // of washing out to white.
  tSlow = tSlow + (eTreble - tSlow) * min(1, delta / 500)
  var transient = max(0, eTreble - tSlow)
  var decay  = 1 - min(1, delta / 120)               // shorter life = less pileup
  var ignite = transient > 0.04 ? transient * sparkleRate : 0
  for (var i = 0; i < N0; i++) {                     // sparkle only on the foreground
    spark[i] = spark[i] * decay
    if (random(1) < ignite) spark[i] = 1
  }
}

export function render(index) {
  if (index < N0) {
    // FOREGROUND (dense): spectrum bars + white treble sparkles.
    var f = N0 > 1 ? index / (N0 - 1) : 0
    var b = floor(f * NBANDS); if (b >= NBANDS) b = NBANDS - 1
    // high-frequency tilt: treble bands carry little energy, so lift them (up to
    // ~2.8× at the top) — otherwise the red end of the spectrum stays dim/tiny.
    var g = env[b] * (1 + (b / (NBANDS - 1)) * 1.8)
    var amp = clamp(g * g, 0, 1)
    var h = 0.66 - (b / (NBANDS - 1)) * 0.66
    var s = spark[index]
    if (s > 0.01) hsv(0.6, 1 - s * 0.75, max(amp, s * 0.85))  // icy-blue accent, keeps a tint (never pure white)
    else          hsv(h, 1, amp)
  } else {
    // BACKGROUND (sparse): a slow flowing field — a traveling brightness wave so
    // it's alive even at steady level, blooming on bass, lifted by mids.
    var n1 = pixelCount - N0
    var f = n1 > 1 ? (index - N0) / (n1 - 1) : 0
    var w = wave(f * 1.5 - bgPhase)                  // 1.5 slow waves drifting along
    var amp = eLevel * 0.4 + eMid * 0.25 + eBass * eBass * 0.5
    var v = clamp(amp * (0.35 + 0.65 * w), 0, 1)     // wave carves moving bright/dark
    var h = 0.66 - eBass * 0.18 + f * 0.06 + wave(bgPhase * 0.3) * 0.08
    hsv(h, 0.9, v)
  }
}
