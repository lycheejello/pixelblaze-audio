// check-mirror.mjs - run the app's bike-pulse mirror headless and assert it
// still behaves like the device pattern it mirrors.
//
//   node tools/check-mirror.mjs
//
// Why this exists: the `bike-pulse` preview in index.html mirrors a pattern that
// lives in ANOTHER repo (bike-canopy-patterns, patterns/1_pulse/pulse.js, branch
// main). Nothing enforces that the two stay in step, and every way the mirror can
// drift is silent: it still renders, just not what the bike does. This is the
// same idea as that repo's own tools/check-patterns.mjs, pointed the other way.
//
// It pulls the mirror straight out of index.html rather than duplicating it, so
// the thing under test is the thing that ships. If the extraction stops matching,
// that is a failure worth seeing, not something to paper over.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'index.html'), 'utf8');

// pull the mirror IIFE out by brace matching
const key = "'bike-pulse': (() => {";
const at = src.indexOf(key);
if (at < 0) throw new Error("could not find the 'bike-pulse' mirror in index.html");
let depth = 0, close = src.indexOf('{', at + key.length - 1);
for (let k = close; k < src.length; k++) {
  if (src[k] === '{') depth++;
  else if (src[k] === '}') { depth--; if (depth === 0) { close = k; break; } }
}
const body = src.slice(at + "'bike-pulse': ".length, close + 1) + ')()';

// the globals the mirror closes over, matching index.html's own definitions
const bands = { bass: 0, mid: 0, treble: 0, level: 0 };
let beatPulse = 0;
const BIKE = { build: 300, seatFrac: 0.10, spineFrac: 0.23, canopyFrac: 0.65,
               travelMs: 280, bandWidth: 0.35, bloomMs: 420 };
const envF = (t, c, dt, fall) => t > c ? t : c + (t - c) * Math.min(1, dt / fall);
const wave = u => (Math.sin(u * 2 * Math.PI) + 1) / 2;
const clampv = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const pat = eval(body);

let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};
const frame = (dt = 16) => pat.before(dt);
const V = (zone, zpos) => pat.pixel(zone, zpos)[2];

// 1. zone maths, against the build table in bike-canopy-patterns' README.
//    294 is the mixed-pitch bike: a 144 px dense seat strip plus 150 sparse,
//    where the pattern sizes the seat by COUNT and gives the spine 10 extra px.
for (const [n, want] of Object.entries({ 150: [15, 35, 100], 294: [144, 49, 101], 300: [30, 70, 200] })) {
  BIKE.build = +n;
  const c = pat.counts();
  const got = [c.seat, c.spine, c.canopy];
  check(got.join() === want.join(), `build ${n}: seat/spine/canopy`,
        `${got.join('/')}${got.join() === want.join() ? '' : ` (expected ${want.join('/')})`}`);
}
BIKE.build = 300;

// 2. no stream: the vars FREEZE rather than dropping to zero, so the device
//    watches for them not CHANGING. It must notice, and its idle animation must
//    then drive the rig, or a dead stream looks like a working show.
for (let t = 0; t < 2800 / 16; t++) frame();
check(pat.idle() === 1, 'stall detected after 2.8 s of a frozen stream');

const heights = new Set();
let bloomFrames = 0, seatPeak = 0;
for (let t = 0; t < 6000 / 16; t++) {
  frame();
  for (let s = 0; s <= 20; s++) if (V(1, s / 20) > 0.5) heights.add(s);
  if (V(2, 0.5) > 0.5) bloomFrames++;
  seatPeak = Math.max(seatPeak, V(0, 0));
}
check(heights.size > 5, 'idle drive: the band climbs the spine', `${heights.size} distinct heights`);
check(bloomFrames > 0, 'idle drive: the canopy blooms', `${bloomFrames} frames lit`);
check(seatPeak > 0.15, 'idle drive: the seat swells', seatPeak.toFixed(2));

// 3. live stream: one launch per beat, fired on the RISING EDGE. `beat` is a
//    decaying pulse, so magnitude alone cannot tell a new hit from one still
//    fading, and `level` must keep the stall detector satisfied meanwhile.
let fires = 0, prevLow = 1;
for (let t = 0; t < 3000 / 16; t++) {
  bands.level = 0.4 + 0.1 * Math.sin(t / 9);
  beatPulse = Math.max(0, 1 - (t % 40) / 12);
  frame();
  const low = V(1, 0.02);
  if (low > 0.9 && prevLow <= 0.9) fires++;
  prevLow = low;
}
check(fires >= 3 && fires <= 6, 'streamed: one pulse per beat', `${fires} in 3 s`);
check(pat.idle() === 0, 'streamed: a live stream is not read as stalled');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
