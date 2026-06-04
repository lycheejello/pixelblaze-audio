// chunky-vu-spectrum.js — TWO-STRIP pattern (Output Expander). Pairs a fine,
// detailed readout with a bold, blocky one, matching each to its strip's
// resolution: the dense strip shows a fine N-band spectrum; the sparse strip
// shows a fat loudness VU bar with peak-hold. The sparse strip's big pixels make
// the bar read as chunky, deliberate blocks rather than low-res mush.
//
// Wiring (this install): expander out0 = 300 px (dense spectrum), out1 = 150 px
// (chunky VU). One continuous index space: 0..299 = out0, 300..449 = out1. Edit
// N0 if yours differs. Must be the active pattern for setVars to land (see
// ../index.html).

var N0 = 300                       // out0 (dense) pixel count; out1 = pixelCount - N0
var NBANDS = 16                    // must equal the app's band count
export var bands = array(NBANDS)
export var level = 0

var env = array(NBANDS)
var eLevel = 0, peak = 0
function envelope(target, current, delta, fall) {
  return target > current ? target : current + (target - current) * min(1, delta / fall)
}

export function beforeRender(delta) {
  for (var i = 0; i < NBANDS; i++) env[i] = envelope(bands[i], env[i], delta, 150)
  eLevel = envelope(level, eLevel, delta, 120)
  peak = eLevel > peak ? eLevel : max(eLevel, peak - delta / 1200)   // slow peak drip
}

export function render(index) {
  if (index < N0) {
    // DENSE: fine N-band spectrum.
    var f = N0 > 1 ? index / (N0 - 1) : 0
    var b = floor(f * NBANDS); if (b >= NBANDS) b = NBANDS - 1
    var h = 0.66 - (b / (NBANDS - 1)) * 0.66
    hsv(h, 1, clamp(env[b] * env[b], 0, 1))
  } else {
    // SPARSE: fat VU bar, green→red, with a near-white peak-hold marker.
    var n1 = pixelCount - N0
    var f = n1 > 1 ? (index - N0) / (n1 - 1) : 0
    var peakLo = peak - 1 / max(1, n1)
    if (f <= peak && f > peakLo) hsv(0.33 * (1 - peak), 0.4, 1)      // peak marker
    else if (f < eLevel)         hsv(0.33 * (1 - f), 1, 1)           // lit bar
    else                         hsv(0, 0, 0)                        // unlit
  }
}
