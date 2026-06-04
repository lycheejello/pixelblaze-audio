// crossed-spectrum.js — TWO-STRIP pattern (Output Expander). Same spectrum data
// on both strips, but laid out so they "cross": the dense strip runs the
// spectrum LINEARLY (bass→treble, left→right) while the sparse strip runs it
// MIRRORED (bass in the center, radiating out). A kick lights the LEFT edge of
// one strip and the MIDDLE of the other at the same instant — the eye reads it
// as the sound spreading across the pair.
//
// Wiring (this install): expander out0 = 300 px (dense), out1 = 150 px (sparse),
// same physical length. One continuous index space: 0..299 = out0 (linear),
// 300..449 = out1 (mirrored). Edit N0 if yours differs. Must be the active
// pattern for setVars to land (see ../index.html).
//
// Hue also crosses: dense low end = blue (bass left), sparse center = red (bass
// center) — complementary cores so the two strips read as distinct layers.

var N0 = 300                       // out0 (dense) pixel count; out1 = pixelCount - N0
var NBANDS = 16                    // must equal the app's band count
export var bands = array(NBANDS)

var env = array(NBANDS)
function envelope(target, current, delta) {
  return target > current ? target : current + (target - current) * min(1, delta / 150)
}

export function beforeRender(delta) {
  for (var i = 0; i < NBANDS; i++) env[i] = envelope(bands[i], env[i], delta)
}

export function render(index) {
  if (index < N0) {
    // DENSE: linear spectrum, low → high, left → right. Bass end = blue.
    var f = N0 > 1 ? index / (N0 - 1) : 0
    var b = floor(f * NBANDS); if (b >= NBANDS) b = NBANDS - 1
    var h = 0.66 - (b / (NBANDS - 1)) * 0.66
    hsv(h, 1, clamp(env[b] * env[b], 0, 1))
  } else {
    // SPARSE: mirrored spectrum, bass in the center radiating out. Center = red.
    var n1 = pixelCount - N0
    var f = n1 > 1 ? (index - N0) / (n1 - 1) : 0
    var m = abs(f - 0.5) * 2                         // 0 center → 1 at both ends
    var b = floor(m * NBANDS); if (b >= NBANDS) b = NBANDS - 1
    var h = (b / (NBANDS - 1)) * 0.66                // warm center, cool ends
    hsv(h, 1, clamp(env[b] * env[b], 0, 1))
  }
}
