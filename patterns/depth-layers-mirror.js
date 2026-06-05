// depth-layers-mirror.js — symmetrical version of depth-layers.js. Same two-strip
// foreground/background concept and the same audio tuning, but every layout folds
// around the CENTER: bass blooms from the middle and radiates out to both ends,
// mirrored. (depth-layers.js is the linear, bass-at-one-end version.)
//
// Wiring (this install): expander out0 = 300 px (dense), out1 = 150 px (sparse),
// same physical length. One continuous index space: 0..299 = out0, 300..449 =
// out1. Edit N0 if yours differs. Single active pattern, so setVars lands here
// (see ../index.html).
//
// Foreground (dense): N-band spectrum mirrored around center + icy treble sparkles.
// Background (sparse): slow wash whose flow + bloom are symmetric around center.

var N0 = 300                       // out0 (dense) pixel count; out1 = pixelCount - N0
var NBANDS = 16                    // must equal the app's band count
// Spectrum tunables — exported so the streamer app's slider panel (and the
// Pixelblaze Vars UI) can adjust them live. Defaults below apply until overridden.
export var sparkleRate = 0.25      // sparkle density on treble HITS; lower = calmer (0 = off)
export var midShrink = 1.1         // S-curve exponent: 1 = even; higher = shorter green
                                   // middle, fatter blue (center) & red (end) zones
export var hueEnd = 0.01           // warm-end hue: 0 = red, ~0.08 = orange
export var warmBias = 1.24         // <1 = redder (warm colors take more of the spectrum)
export var hfTilt = 1.8            // treble (strip-end) brightness lift; 0 = flat
export var gamma = 1.6            // brightness contrast; higher = darker darks (2 = square)
export var ledGamma = 2.2         // LED gamma correction so the strip's contrast matches the
                                  // (monitor-gamma'd) preview. 1 = off; raise if the strip looks washed
export var black = 0.06           // black point: values below this are crushed to truly off, so
                                  // faint lows don't glow (esp. the blue center) on the LEDs
export var idleBright = 0.6       // idle/no-sound aurora brightness (before LED gamma/black point)
export var attack = 0.1           // 0 = follows bass LEVEL; 1 = only the kick/onset — subtracts a
                                  // slow per-band baseline (weighted to the low end) so a steady
                                  // bassline stops keeping the center lit
export var bands = array(NBANDS)
export var bass = 0
export var mid = 0
export var treble = 0
export var level = 0
export var beat = 0                 // kick-onset pulse from the app (1 on a hit, decays)

var env = array(NBANDS)
var base = array(NBANDS)            // slow per-band baseline (sustained level)
var vis = array(NBANDS)             // env with the baseline subtracted → onset/attack
var eBass = 0, eMid = 0, eTreble = 0, eLevel = 0, eBeat = 0
var tSlow = 0                      // slow treble baseline, for transient detection
var bgPhase = 0                    // slow drift for the background wash
var idle = 0                       // 0 = music playing … 1 = idle ambient
var idlePhase = 0                  // drift for the idle aurora
// pixelCount is the device's TOTAL pixel count and is known at init, so size the
// buffer from it directly. (Pixelblaze arrays are fixed-size — you can't grow one
// at runtime, which is why we allocate here, not in beforeRender.) The dense strip
// only uses indices 0..N0-1, but allocating the full length keeps indexing trivial.
var spark = array(pixelCount)      // per-pixel sparkle, dense strip only

function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

// symmetric S-curve on 0..1: lingers near 0 and 1, steep through the middle, so
// the spectral extremes (blue/red) get more length and the green middle shrinks.
function scurve(x, k) {
  return x < 0.5 ? 0.5 * pow(2 * x, k) : 1 - 0.5 * pow(2 * (1 - x), k)
}

export function beforeRender(delta) {
  for (var i = 0; i < NBANDS; i++) {
    env[i] = envelope(bands[i], env[i], delta, 150)
    base[i] = base[i] + (env[i] - base[i]) * min(1, delta / 400)   // slow baseline (~400 ms)
    var lowW = 1 - i / (NBANDS - 1)                                // attack weighted to the low end
    vis[i] = clamp(env[i] - attack * lowW * base[i], 0, 1)         // subtract sustained level
  }
  eBass   = envelope(bass,   eBass,   delta, 150)
  eMid    = envelope(mid,    eMid,    delta, 250)
  eTreble = envelope(treble, eTreble, delta, 80)    // snappy for cymbals
  eLevel  = envelope(level,  eLevel,  delta, 350)   // slow, dreamy background
  eBeat   = envelope(beat,   eBeat,   delta, 140)   // smooth the kick pulse a touch
  // background drifts slowly, faster when the track is loud — never fully static.
  bgPhase = bgPhase + delta / 1000 * (0.05 + eLevel * 0.4)

  // idle ambient: fade a gentle glow IN slowly after silence (~4.5 s; a brief dark
  // moment is fine) and OUT fast (~0.3 s) when music returns. Activity = loudest band.
  var act = max(eLevel, max(eBass, eTreble))
  var idleTarget = act < 0.03 ? 1 : 0
  var idleTc = idleTarget > idle ? 4500 : 300
  idle = idle + (idleTarget - idle) * min(1, delta / idleTc)
  idlePhase = idlePhase + delta / 1000 * 0.08        // very slow constant drift

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
  // ah/asat/av = the audio-driven color; fm = position FOLDED around the center
  // (0 at the middle → 1 at both ends), which is what makes this the mirror.
  // fw = folded position warped so the center is narrow and the ends are wide.
  var f, fm, fw, ah, asat, av
  if (index < N0) {
    // FOREGROUND (dense): spectrum mirrored around center + icy treble sparkles.
    f = N0 > 1 ? index / (N0 - 1) : 0
    fm = abs(f - 0.5) * 2
    fw = scurve(fm, midShrink)
    // interpolate between adjacent bands for a smooth gradient (no hard blocks).
    var bf = fw * (NBANDS - 1)
    var b0 = floor(bf); var frac = bf - b0
    var b1 = b0 + 1; if (b1 > NBANDS - 1) b1 = NBANDS - 1
    var lin = vis[b0] * (1 - frac) + vis[b1] * frac
    // blend the center toward the kick (beat) pulse — reliable onset, center-weighted.
    var kickW = attack * (1 - fw)
    lin = lin * (1 - kickW) + eBeat * eBeat * kickW
    // high-frequency tilt: lift the dim treble bands (now at the strip ends).
    var g = lin * (1 + fw * hfTilt)
    var amp = clamp(pow(g, gamma), 0, 1)
    var s = spark[index]
    if (s > 0.01) { ah = 0.6; asat = 1 - s * 0.75; av = max(amp, s * 0.85) }  // icy accent, never pure white
    else          { ah = 0.66 - pow(fw, warmBias) * (0.66 - hueEnd); asat = 1; av = amp }  // blue center → red ends, warm-biased
  } else {
    // BACKGROUND (sparse): slow flowing field, symmetric around center.
    var n1 = pixelCount - N0
    f = n1 > 1 ? (index - N0) / (n1 - 1) : 0
    fm = abs(f - 0.5) * 2
    fw = scurve(fm, midShrink)
    var w = wave(fw * 1.5 - bgPhase)                  // waves travel out from center
    var bamp = eLevel * 0.4 + eMid * 0.25 + eBass * eBass * 0.5
    av = clamp(bamp * (0.35 + 0.65 * w), 0, 1)
    // tight blue → violet, narrow so the wash stays one color family.
    ah = 0.64 + eBass * 0.1 + fw * 0.03 + wave(bgPhase * 0.3) * 0.03
    asat = 0.9
  }

  // idle aurora: soft breathing glow, also symmetric (driven by warped position).
  if (idle > 0.01) {
    var iw = (wave(fw * 0.7 - idlePhase) + wave(fw * 0.4 + idlePhase * 0.6)) * 0.5
    var iv = idle * (0.06 + idleBright * iw)
    if (iv > av) {
      av = iv
      ah = 0.6 + 0.12 * wave(idlePhase * 0.5 + fw * 0.2)
      asat = 0.85
    }
  }

  av = clamp((av - black) / (1 - black), 0, 1)   // black point: crush faint lows to off
  hsv(ah, asat, pow(av, ledGamma))               // LED gamma correction (see ledGamma above)
}
