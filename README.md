# pixelblaze-audio

Make a [Pixelblaze](https://electromage.com/pixelblaze) react to music **without a
microphone**. The browser captures system/tab audio, runs an FFT, and streams the
frequency bands to the Pixelblaze over its WebSocket API. The Pixelblaze runs a
pattern that reads those bands.

```
  music (any app/tab) ──► browser: getDisplayMedia + Web Audio FFT
                              │  bass / mid / treble / level  (0..1)
                              ▼  ws://<pixelblaze>:81  {"setVars": {...}}
                          Pixelblaze running patterns/reactive.js
```

## Run it

1. **Load the pattern.** In the Pixelblaze web UI, create a new pattern, paste
   [`patterns/reactive.js`](patterns/reactive.js), save, and **make it the active
   pattern** (`setVars` only reaches the running pattern).
2. **Serve the app over http** (so `ws://` isn't blocked as mixed content):
   ```
   python3 -m http.server      # from this folder
   # → http://localhost:8000/index.html
   ```
3. **Connect.** Enter the Pixelblaze IP, hit **Connect** (green dot = open).
4. **Start audio.** Hit **Start audio**, then in the browser picker choose a
   **tab or screen with "Share audio" checked** (Chrome). Play music there.

The strip now reacts — bass at one end, treble at the other. Tune **gain**,
**smoothing**, and **send rate** live.

## The variable contract

The app streams four `0..1` values; the pattern exports them:

| var | range | meaning |
|-----|-------|---------|
| `bass`   | 20–250 Hz   | low end |
| `mid`    | 250 Hz–2 kHz | mids |
| `treble` | 2–8 kHz     | highs |
| `level`  | 20 Hz–16 kHz | overall loudness |

Write your own patterns against the same four vars; the app doesn't care what
they drive.

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
```
