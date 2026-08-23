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

Visual walkthrough: **[`quickstart.html`](quickstart.html)** (open it from the app's
*quick start* link, or at `http://localhost:8000/quickstart.html` once the server is up).

1. **Load the pattern.** In the Pixelblaze web UI, create a new pattern, paste
   [`patterns/reactive.js`](patterns/reactive.js) (scalar bands) or
   [`patterns/spectrum.js`](patterns/spectrum.js) (the N-band array), save, and
   **make it the active pattern** (`setVars` only reaches the running pattern).
2. **Serve the app over http** (so `ws://` isn't blocked as mixed content):
   ```
   ./run.sh                    # serves this folder + opens Chrome
   ./run.sh 9000               # another port
   PORTAL=0 ./run.sh           # don't open the Pixelblaze's own web UI
   # → http://localhost:8000/index.html?auto=1
   ```
   Join the Pixelblaze's wifi network yourself first (menu bar) — a web page has
   no API for it.

   Once the page connects, `run.sh` also opens the **Pixelblaze's own web UI**
   (`http://<its-ip>/` — patterns, Mapper, settings) in a second tab. The page
   is what finds the device, so it pings `/_found?ip=…` back at the local server
   and `run.sh` picks the address out of its request log.

   Equivalent by hand: `python3 -m http.server` from this folder. `run.sh` uses
   Apple's `/usr/bin/python3` so the LAN URL works from a phone (see the Local
   Network note below).
3. **Hit ▶ Start show.** One button: connects to the Pixelblaze, selects the
   virtual audio device, and starts capturing. `run.sh` opens the page with
   `?auto=1` so it tries this by itself — Chrome may still want one click first,
   since a page can't start an AudioContext without a user gesture.

   The manual equivalents are all still there:

   - **Connect.** The page runs **find** on load, so usually the IP is already
     filled in and the dot is green by the time you look. Otherwise hit **find**,
     or type the address and hit **Connect**. `find` tries the AP-mode address
     `192.168.4.1`, the last address that worked and whatever is in the box, all
     at once — usually instant. Failing that it sweeps **this machine's own
     `/24` over `:80`** for hosts that are alive at all, then asks just those few
     which speaks `ws://…:81`. (It does *not* sweep the `/24` over `ws://`:
     Chrome throttles WebSocket handshakes, so a 254-host ws sweep reports
     everything dead — including a Pixelblaze that is sitting right there.)
     `run.sh` passes the subnet in as `?lan=`, because a page served from
     `localhost` can't otherwise tell which network it's on. The `log` link next
     to the status dot shows exactly what it tried. The last good address is
     remembered across reloads.
   - **Several Pixelblazes.** The address box takes a list —
     `192.168.0.65, 192.168.0.220` — and the same stream goes to all of them:
     one socket each, one FFT, the identical `setVars` frame written N times.
     **find all** sweeps the subnet even when a known address answers, so a
     second device isn't hidden behind the first one's cache hit, and connects
     to everything it finds (plain **find** stops at the quick answer, which is
     what you want on every launch after the first). The status line reads
     `connected · 2 devices`, or `1 of 2 connected` if one is missing — hover it
     for the per-device state. Only the addresses that actually opened get
     remembered, so a typo doesn't stick around.

     They don't have to run the same pattern: the strip can run `spectrum.js`
     while the ceiling runs `starfield.js`, both fed by this one stream. Each
     device just needs *a* reactive pattern active. Devices free-run rather than
     frame-lock — invisible for beat-driven work; if you need true cross-device
     sync, that's Electromage's **Firestorm**, not this app.
   - **Start audio.** Hit **Start audio**, then in the browser picker choose a
     **tab or screen with "Share audio" checked** (Chrome). Play music there.

   The **source** dropdown defaults to **BlackHole** whenever one is present —
   that's the path this rig is built around, so it wins over the choice saved
   from last time (other loopback devices are the fallback, then the saved one).
   Only `?src=` and a pick you make by hand in the session outrank it. Names are
   hidden until the origin has mic permission once, which is why **Start show**
   asks for it before choosing.

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
- Browser ↔ Pixelblaze must be on the **same network** — but it needn't be *yours*
  and needs no internet. In **AP mode** the Pixelblaze *is* the network (hold the
  onboard button ~3.5 s; it's then always at `192.168.4.1`), so the whole rig runs
  with no router at all — see [`docs/offline-network.md`](docs/offline-network.md).
  The Pixelblaze's USB port is **power only**, so wifi is the only control path.
- The browser has **local-network access**; a Python streamer on macOS may not
  (Local Network privacy blocks non-Apple binaries — run under Apple's
  `/usr/bin/python3` if you go that route). The browser sidesteps this entirely.
- This is for a **fixed setup** (room, installation). A mobile/standalone rig that
  can't carry a streamer wants the Pixelblaze **Sensor Expansion Board** (on-device
  mic + FFT) instead.

## Layout

```
index.html          # the streamer: audio capture + FFT + WebSocket + visualizer
quickstart.html     # visual walkthrough (steps, sliders, contract, troubleshooting)
run.sh              # serve this folder over http + open Chrome (app + device web UI)
docs/
  offline-audio-macos.md  # virtual-audio-device (BlackHole) setup for offline / desktop-app capture
  offline-network.md      # running with no router/internet: Pixelblaze AP mode (192.168.4.1)
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
