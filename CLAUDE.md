# pixelblaze-audio — Claude Context

Browser-based, mic-free music reactivity for a [Pixelblaze](https://electromage.com/pixelblaze):
capture system/tab audio → FFT in the browser → stream frequency bands to the
Pixelblaze over its WebSocket API → a pattern on the device reacts.

Independent project (not the Burning Man / grub-bike work, though it grew out of it).

## Layout
- `index.html` — the streamer app. Vanilla HTML/JS, **no build step**. `getDisplayMedia`
  for audio capture, Web Audio `AnalyserNode` for the FFT, `WebSocket` to the device.
- `patterns/reactive.js` — Pixelblaze pattern (PBscript) reading the streamed vars.
- `README.md` — run instructions + the variable contract.

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
- Patterns are PBscript (a JS subset): `beforeRender(delta)` + `render(index)` / `render3D`,
  builtins `hsv()`, `rgb()`, `clamp()`, `time()`, `wave()`, `pixelCount`, etc.

## Gotchas learned the hard way
- **macOS Local Network privacy** (Sequoia+) blocks non-Apple binaries from the LAN.
  The homebrew/venv Python gets "no route to host" to a Pixelblaze; `/usr/bin/python3`,
  `nc`, `curl`, and **browsers** are exempt. This is why the streamer is browser-based —
  it sidesteps the whole problem. If a Python streamer is ever added, run it under
  Apple's `/usr/bin/python3` (or a `--symlinks` venv built from it).
- `getDisplayMedia({audio:true})` is reliable in **Chrome**; the user must tick
  "Share audio" in the picker or no audio track arrives.

## Scope
Built for a **fixed install** (room, art piece). A mobile rig that can't carry a
streaming computer should use the Pixelblaze **Sensor Expansion Board** (on-device
mic + FFT) instead — different architecture, out of scope here.
