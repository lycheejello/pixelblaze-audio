# pixelblaze-audio

Make a [Pixelblaze](https://electromage.com/pixelblaze) react to music **without a
microphone**. The browser captures system/tab audio, runs an FFT, and streams the
frequency bands to the Pixelblaze over its WebSocket API. The Pixelblaze runs a
pattern that reads those bands.

```
  music (any app/tab) ──► browser: getDisplayMedia + Web Audio FFT
                              │  bass / mid / treble / level  (0..1)
                              │  bands[N]  log-spaced spectrum  (0..1)
                              ▼  ws://<pixelblaze>:81  {"setVars": {...}}
                          Pixelblaze running patterns/reactive.js
                              or patterns/spectrum.js
```

## Run it

1. **Load the pattern.** In the Pixelblaze web UI, create a new pattern, paste
   [`patterns/reactive.js`](patterns/reactive.js) (scalar bands) or
   [`patterns/spectrum.js`](patterns/spectrum.js) (the N-band array), save, and
   **make it the active pattern** (`setVars` only reaches the running pattern).
2. **Serve the app over http** (so `ws://` isn't blocked as mixed content):
   ```
   python3 -m http.server      # from this folder
   # → http://localhost:8000/index.html
   ```
3. **Connect.** Enter the Pixelblaze IP, hit **Connect** (green dot = open).
4. **Start audio.** Hit **Start audio**, then in the browser picker choose a
   **tab or screen with "Share audio" checked** (Chrome). Play music there.

   *Working offline, or using the Spotify **desktop** app?* Switch the **source**
   dropdown from *tab / screen* to a **virtual audio device** (BlackHole/Loopback)
   and capture that instead — the whole loop then runs with no internet. See
   [`docs/offline-audio-macos.md`](docs/offline-audio-macos.md).

The strip now reacts — bass at one end, treble at the other. Tune **gain**,
**smoothing**, **send rate**, and the spectrum **bands** count live. The app also
shows a **strip preview** (a JS mirror of the selected pattern) so you can audition
patterns locally without watching the hardware — pick one from the dropdown.

## The variable contract

The app streams these `0..1` values; the pattern exports them. Changing the set
means editing **both** sides.

| var | range | meaning |
|-----|-------|---------|
| `bass`   | 20–250 Hz   | low end |
| `mid`    | 250 Hz–2 kHz | mids |
| `treble` | 2–8 kHz     | highs |
| `level`  | 20 Hz–16 kHz | overall loudness |
| `bands`  | array of N, 20 Hz–16 kHz log-spaced | per-band spectrum (N set by the **bands** slider, default 16) |
| `beat`   | 0..1 pulse | snaps to 1 on a detected beat (bass onset), decays to 0 |

The four scalars (`bass`/`mid`/`treble`/`level`) are unchanged and back-compatible —
`reactive.js` still works as-is. The new `bands` array is sent **in addition** to
them, in the same `setVars` frame:

```json
{"setVars": {"bass": 0.2, "mid": 0.4, "treble": 0.1, "level": 0.3,
             "bands": [0.1, 0.2, 0.5, ...], "beat": 0.0}}
```

Beat detection is a bass-flux onset detector; tune it live with the **beat sens**
slider (higher = stricter). The **beat** dot by the audio button flashes on each hit.

**N must match.** `bands.length` from the app (the **bands** slider, default 16)
must equal the array length declared in [`patterns/spectrum.js`](patterns/spectrum.js)
(`NBANDS`, default 16). If they differ, only the overlapping elements update and the
rest stay 0. Keep the two in sync.

Write your own patterns against any of these vars; the app doesn't care what they
drive.

## Patterns — what to play

Each pattern leans on different bands, so some music suits it better. Use the app's
**strip preview** dropdown to audition them against whatever's playing.

| pattern | what it does | plays best with |
|---------|--------------|-----------------|
| `reactive.js`  | bass / mid / treble split into thirds of the strip | all-rounder — pop, rock, most electronic |
| `spectrum.js`  | full N-band analyzer across the strip | detailed mixes — orchestral, jazz, IDM, complex electronic |
| `spectrum-mirror.js` | same analyzer folded around the center — bass blooms outward from the middle | symmetric installs, center-mounted strips, anything you want to "breathe" |
| `beat.js`      | whole strip flashes on each detected beat | a steady, clear kick — house, techno, hip-hop, drum & bass |
| `beat-pump.js` | whole strip pumps on bass, hue drifts with treble | bass-forward — dubstep, trap, drum & bass, hip-hop |
| `vu-bar.js`    | loudness VU bar with a peak-hold marker | dynamic material — rock, live sets, big builds/drops, even speech |
| `plasma.js`    | flowing ambient field, speed/brightness from loudness | beatless & smooth — ambient, downtempo, lo-fi, classical |
| `sparkle.js`   | white twinkles on treble over a bass-tinted glow | bright highs — acoustic, jazz, glitch, hi-hat-heavy EDM, holiday |

### Two-strip patterns (Output Expander)

For a setup with **two strips of the same physical length but different pixel
density** wired to the expander (this install: out0 = 300 px dense, out1 = 150 px
sparse → one continuous index space, `0..299` then `300..449`). Each treats the
strips as physically-aligned layers and exploits the density mismatch. The split
point is `var N0` at the top of each file — edit it for other counts. Audition
them in the **strip preview** (they render as two stacked rows at the real counts).

| pattern | what it does | plays best with |
|---------|--------------|-----------------|
| `depth-layers.js` | dense = crisp spectrum + treble sparkle; sparse = soft, blurry bass/level color wash behind | layered, atmospheric mixes — house, melodic techno, synthwave |
| `depth-layers-mirror.js` | same as depth-layers, folded around center — bass blooms from the middle out to both ends | center-mounted / symmetric installs wanting depth-layers' look |
| `crossed-spectrum.js` | dense = linear spectrum (bass→treble); sparse = mirrored (bass center) — a kick spreads across both | beat-forward music where you want the low end to "open out" |
| `moire-ripple.js` | same outward ripple on both; differing pitch makes the wavefronts shimmer in/out of phase, hardest on drops | big builds & drops — dubstep, DnB, festival EDM |
| `chunky-vu-spectrum.js` | dense = fine N-band spectrum; sparse = fat VU bar with peak-hold | dynamic material — rock, live sets, loud-quiet-loud |

### 2D pattern (pixel map)

For pixels scattered in a plane, not a line — e.g. a **star ceiling**. Needs a 2D
**pixel map** in the Pixelblaze **Mapper** tab; the pattern then uses
`render2D(index, x, y)`. Audition it in the **field preview** (a top-down dome
view, not a strip).

| pattern | what it does | plays best with |
|---------|--------------|-----------------|
| `starfield.js` | a scattered star ceiling: stars twinkle on their own over a cozy violet floor, the drone *breathes* the whole field, a beat can launch a shooting star, treble sharpens the twinkle. Chill/lounge but culty — not a VU meter. | ambient, drone, downtempo, a chant/drone loop |

Select `starfield.js` in the preview to get a **field view** + a tuning panel.
Set the **stars** slider to your pixel count, tune the look live, then **copy map**
→ paste into the Pixelblaze Mapper (2D) so the hardware layout matches the preview,
and **copy settings** → paste the `export var` defaults into `patterns/starfield.js`.
Exact star positions needn't match the physically-hung pixels — a random scatter
still reads as a believable sky. On **RGBW** pixels (SK6812) set the LED type to
RGBW so `tint`≈0 stars route to the cool-white channel = clean cold-white.

## Notes / gotchas

- **Chrome** is the reliable browser for `getDisplayMedia({audio:true})`. Tab audio
  is the easiest source; whole-screen system audio works on some platforms.
- **Two capture paths**, both mic-free. The **source** dropdown selects either a
  *tab / screen* (the Share-audio picker) or an **audio input device**. Route
  audio through a **virtual device** (BlackHole/Loopback) and pick it as the input
  to run **fully offline** or capture the **Spotify desktop app** — setup in
  [`docs/offline-audio-macos.md`](docs/offline-audio-macos.md). On macOS, tab-share
  only captures *Chrome tab* audio, so the virtual-device path is the way to feed
  in desktop apps.
- The page must be **http** (or `file://`-adjacent), not **https** — Pixelblaze
  speaks plain `ws://`, and an https page blocks that as mixed content.
- Browser ↔ Pixelblaze must be on the **same network**.
- The browser has **local-network access**; a Python streamer on macOS may not
  (Local Network privacy blocks non-Apple binaries — run under Apple's
  `/usr/bin/python3` if you go that route). The browser sidesteps this entirely.
- This is for a **fixed setup** (room, installation). A mobile/standalone rig that
  can't carry a streamer wants the Pixelblaze **Sensor Expansion Board** (on-device
  mic + FFT) instead.

## Layout

```
index.html          # the streamer: audio capture + FFT + WebSocket + visualizer
docs/
  offline-audio-macos.md  # virtual-audio-device (BlackHole) setup for offline / desktop-app capture
patterns/
  reactive.js       # spectrum pattern reading bass/mid/treble/level (+ alternates)
  spectrum.js       # N-band analyzer reading the bands[] array (N must match the app)
  spectrum-mirror.js # spectrum.js folded around the center (bass-in-middle, radiates out)
  beat.js           # whole-strip flash synced to the `beat` pulse
  vu-bar.js         # loudness VU bar with peak-hold, driven by `level`
  beat-pump.js      # whole-strip pump on `bass`, hue drifts with `treble`
  plasma.js         # flowing plasma field modulated by level/mid/treble
  sparkle.js        # treble twinkle over a bass-tinted base
  starfield.js      # 2D star ceiling (render2D + pixel map): drone-breathing twinkle, shooting stars
  # two-strip (Output Expander, out0=300px dense + out1=150px sparse):
  depth-layers.js       # crisp spectrum/sparkle front + blurry bass wash behind
  depth-layers-mirror.js # depth-layers folded around center (bass-in-middle)
  crossed-spectrum.js   # linear spectrum (dense) crossed with mirrored (sparse)
  moire-ripple.js       # one ripple, two pitches → interference shimmer
  chunky-vu-spectrum.js # fine spectrum (dense) + fat VU bar (sparse)
```
