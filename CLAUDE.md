# pixelblaze-audio — Claude Context

Browser-based, mic-free music reactivity for a [Pixelblaze](https://electromage.com/pixelblaze):
capture system/tab audio → FFT in the browser → stream frequency bands to the
Pixelblaze over its WebSocket API → a pattern on the device reacts.

Independent project (not the Burning Man / grub-bike work, though it grew out of it).

## Layout
- `index.html` — the streamer app. Vanilla HTML/JS, **no build step**. `getDisplayMedia`
  for audio capture, Web Audio `AnalyserNode` for the FFT, `WebSocket` to the device.
- `patterns/reactive.js` — Pixelblaze pattern (PBscript) reading the streamed vars.
- `patterns/starfield.js` — 2D star-ceiling pattern (`render2D`, needs a pixel map);
  built for the "Shrine" star tent. Chill/lounge-but-culty, not a VU meter.
- `README.md` — run instructions + the variable contract.

## Previews (keep mirrors in sync with patterns/)
The app renders JS **mirrors** of each device pattern so you can audition without
hardware. Three render paths in `index.html`:
- **strip** (`drawStrip`) — single-strip patterns (`pixel(f,i,n)`).
- **two-strip rows** — `rows()` returns `[{n,pixel},…]`, drawn stacked.
- **field** (`drawField`) — for `field:true` patterns (starfield): draws `MAP2D`
  positions as soft additive glows = a top-down dome view. The starfield panel has
  a **stars** count (regenerates `MAP2D`), **copy map** (→ Pixelblaze Mapper, 2D),
  and **copy settings** (→ the pattern's `export var` defaults), plus live knobs
  that stream to the device (same live-tuning pattern as the depth-layers-mirror panel).
If you edit a pattern, update its mirror here too (and vice versa).

## Conventions
- **Vanilla, no toolchain.** Single-file HTML, served with `python3 -m http.server`.
  Match the existing dark/monospace UI style. Don't add a framework or bundler.
- **Serve over http, not https** — Pixelblaze speaks plain `ws://`, which an https
  page blocks as mixed content.

## The contract (keep app and pattern in sync)
The app streams these values ~40×/sec via `{"setVars": {...}}`; the pattern
`export`s them. Changing the set means editing **both** sides.

| var | band / kind |
|-----|------|
| `bass`   | 20–250 Hz |
| `mid`    | 250 Hz–2 kHz |
| `treble` | 2–8 kHz |
| `level`  | 20 Hz–16 kHz |
| `bands`  | array of N log-spaced bands, 20 Hz–16 kHz (N = app **bands** slider, default 16) |
| `beat`   | 0..1 pulse, snaps to 1 on a detected bass onset and decays |

The four scalars are the original contract; `bands` (array) and `beat` (pulse) are
sent in the **same** `setVars` frame and are back-compatible — patterns that only
read the scalars still work. For `bands`, the array length declared on the device
(`spectrum.js` `NBANDS`) must equal the app's band count or only the overlap updates.

`setVars` only reaches the **active** pattern, so the reactive pattern must be running.

## Pixelblaze / protocol facts
- WebSocket is `ws://<ip>:81`. Set variables with a JSON text frame `{"setVars": {name: value}}`.
- **AP mode**: hold the onboard button ~3.5 s (pre-V3: GP0→GND ~5 s) and the Pixelblaze
  broadcasts its own `Pixelblaze_XXXXXX` network, fixed at **`192.168.4.1`** — no router,
  no internet, no DHCP discovery. AP password must be **≥8 chars** or it's silently rejected.
  This is the no-network install path (`docs/offline-network.md`).
- The Pixelblaze's **USB port is power only** — the data lines aren't connected. There is no
  serial control path; wifi is the only way in.
- Patterns are PBscript (a JS subset): `beforeRender(delta)` + `render(index)` / `render2D` /
  `render3D`, builtins `hsv()`, `rgb()`, `clamp()`, `time()`, `wave()`, `hypot()`, `pixelCount`, etc.
- `render2D(index, x, y)` fires when a **2D pixel map** is set (Pixelblaze Mapper tab);
  x,y arrive normalized ~0..1. Paste a `[[x,y],…]` map (the app's "copy map" gives one).

## Gotchas learned the hard way
- **macOS Local Network privacy** (Sequoia+) blocks non-Apple binaries from the LAN.
  The homebrew/venv Python gets "no route to host" to a Pixelblaze; `/usr/bin/python3`,
  `nc`, `curl`, and **browsers** are exempt. This is why the streamer is browser-based —
  it sidesteps the whole problem. If a Python streamer is ever added, run it under
  Apple's `/usr/bin/python3` (or a `--symlinks` venv built from it).
- **Discovery must be HTTP-first — never sweep a /24 over `ws://`.** Chrome throttles
  WebSocket handshakes when many are pending, so a browser sweep of 254 hosts on :81
  reports *every* host dead while the probes sit queued and their timeouts burn down.
  Measured on this project: a full ws:// sweep declared all 253 hosts dead, then the
  same Pixelblaze at `192.168.0.65` took **4704 ms** to complete a handshake `curl`
  does instantly. `fetch` is not throttled that way, so `find` sweeps :80 with
  `fetch(…, {mode:'no-cors'})` — an opaque response still proves a host is alive —
  and only the handful that answer get a patient parallel ws:// probe.
  Timing is the diagnostic: a probe refused in <60 ms was blocked before it hit the
  network (Chrome's local-network permission, Chrome 142+), one that runs its full
  timeout is a genuinely dead host. The find log in the app reports which.
- **Sweep the right /24.** A page served from `localhost` can't tell what network it's
  on, so `run.sh` passes the machine's LAN IP in as `?lan=`; the page also falls back
  to `location.hostname` and a WebRTC host candidate.
- `getDisplayMedia({audio:true})` is reliable in **Chrome**; the user must tick
  "Share audio" in the picker or no audio track arrives.

## Scope
Built for a **fixed install** (room, art piece). A mobile rig that can't carry a
streaming computer should use the Pixelblaze **Sensor Expansion Board** (on-device
mic + FFT) instead — different architecture, out of scope here.
