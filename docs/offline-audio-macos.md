# Offline / virtual-audio-device capture (macOS)

By default the app captures a Chrome **tab** with `getDisplayMedia`. That's the
easiest path, but it has two limits:

- On macOS, only **tab** audio actually carries sound (sharing a window or the
  desktop app gives a silent track).
- A streaming source in a tab (Spotify **web** player, YouTube) needs the internet.

If you want to run **fully offline** — or feed the **Spotify desktop app** (which
plays downloaded tracks with no connection) — route the audio through a **virtual
audio device** and have the app capture *that* as an input, instead of a tab.

```
Spotify desktop app (offline downloads)
        │  system / app output →
        ▼
   BlackHole (virtual audio device)  ──►  Chrome getUserMedia (source = BlackHole)
        │                                        │  FFT → bands
        └──► your speakers (via a Multi-Output    ▼  ws://<pixelblaze>:81
             Device, so you still hear it)     Pixelblaze
```

Nothing here touches the LAN link to the Pixelblaze, so with a router that has no
WAN you still get the full loop: **Mac + Pixelblaze on the same Wi-Fi/LAN, no
internet required.**

---

## 1. Install a virtual audio device

**BlackHole** (free, open-source, near-zero CPU). Homebrew:

```
brew install blackhole-2ch
```

(or grab the installer from <https://existential.audio/blackhole/>). If **BlackHole
2ch** doesn't show up in your audio devices right after install, Core Audio hasn't
loaded the new driver yet — run `sudo killall coreaudiod` (restarts the audio
daemon; sound blips silent for ~2 s) and it appears. A reboot also works.

> **If `brew install` hangs at "Fetching downloads" or fails with
> `curl: (28) … Couldn't connect to existential.audio`:** that host serves the
> `.pkg` and is intermittently down. The Homebrew cask pulls from the *same* host,
> and GitHub releases only carry source archives (no `.pkg`), so there's no faster
> mirror — just **retry in a while**; it usually recovers within hours. When the
> download succeeds it will ask for your **admin password** to install the driver.

> Prefer a GUI? **Loopback** (Rogue Amoeba, ~paid) does the same routing with a
> visual patchbay and no manual Multi-Output juggling. The app steps below are
> identical — just pick the Loopback device as the source.

## 2. Make a Multi-Output Device (so you still hear the music)

Sending audio to BlackHole alone means it goes *only* to BlackHole — you'd hear
nothing. Create a Multi-Output so it goes to **both** BlackHole and your speakers.

1. Open **Audio MIDI Setup** (`/Applications/Utilities/Audio MIDI Setup.app`,
   or Spotlight it).
2. Click **+** (bottom-left) → **Create Multi-Output Device**.
3. In the right pane, tick **both**:
   - your real output (e.g. *MacBook Pro Speakers* or your interface/headphones)
   - **BlackHole 2ch**
4. Put your **real output first** (drag it to the top) as the primary/clock
   device. Tick **Drift Correction** on BlackHole.
5. (Optional) rename it something like *Speakers + BlackHole*.

## 3. Send the music to it

Two options:

- **Whole system:** *System Settings → Sound → Output →* select the Multi-Output
  Device. Everything now also flows to BlackHole.
- **Just Spotify** (cleaner — keeps notification/UI sounds out): Spotify has no
  per-app output picker natively; use the whole-system option above, or use
  Loopback which can capture a single app.

You should still hear audio through your speakers. If you don't, re-check step 2.

## 4. Point the app at the device

1. Serve and open the app as usual (`python3 -m http.server` → `http://localhost:8000`).
2. Click **list inputs** (next to the **source** dropdown). Approve the mic
   permission prompt — that's only so Chrome will reveal device *names*; the app
   never uses your real mic.
3. In **source**, choose **BlackHole 2ch** (or your Multi-Output / Loopback device).
4. Hit **Start audio**. The visualizer and meters should move with the music.
5. **Connect** to the Pixelblaze as normal.

The app remembers nothing about the source across reloads — re-pick it after a
refresh (the dropdown keeps your choice within a session).

---

## Troubleshooting

| symptom | cause / fix |
|---|---|
| No device names, just "input 1/2" | Click **list inputs** and approve the permission prompt; names are hidden until then. |
| App visualizer is flat / dead | Wrong source picked, or the music isn't routed to BlackHole. Confirm system/app output is the Multi-Output Device and something is playing. |
| Music plays but I hear nothing | You set output to **BlackHole** alone. Use the **Multi-Output Device** (step 2) so it also hits your speakers. |
| Sound is doubled / echoey | You have both the tab-share path and the device path running, or two outputs at different latencies. Use one source; enable **Drift Correction** on BlackHole. |
| Levels too hot / clipping | The app disables browser AGC on purpose; use the **gain** slider to trim. |
| Chrome won't grant mic on `http://` | `localhost` is treated as secure and works. A bare LAN IP may not — use `http://localhost:8000`. |
| `brew install` hangs / `curl (28)` to existential.audio | Their `.pkg` host is down; retry later (see the install note above). No mirror — brew and GitHub both route back to it. |

## Other platforms

Same idea, different driver:

- **Windows:** [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) — set it as
  playback output, pick "CABLE Output" as the app source.
- **Linux:** PulseAudio/PipeWire already expose a **monitor** of each sink; pick
  the "Monitor of <your output>" device as the app source (no extra install).
