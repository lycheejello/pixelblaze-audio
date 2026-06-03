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

The strip now reacts — bass at one end, treble at the other. Tune **gain**,
**smoothing**, **send rate**, and the spectrum **bands** count live.

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

## Notes / gotchas

- **Chrome** is the reliable browser for `getDisplayMedia({audio:true})`. Tab audio
  is the easiest source; whole-screen system audio works on some platforms.
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
patterns/
  reactive.js       # spectrum pattern reading bass/mid/treble/level (+ alternates)
  spectrum.js       # N-band analyzer reading the bands[] array (N must match the app)
  beat.js           # whole-strip flash synced to the `beat` pulse
  vu-bar.js         # loudness VU bar with peak-hold, driven by `level`
  beat-pump.js      # whole-strip pump on `bass`, hue drifts with `treble`
  plasma.js         # flowing plasma field modulated by level/mid/treble
  sparkle.js        # treble twinkle over a bass-tinted base
```
