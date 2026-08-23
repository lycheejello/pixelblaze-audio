# No network at all — Pixelblaze AP mode

The app and the Pixelblaze have to be on the same network, but that network
doesn't have to be *yours*, and it doesn't need internet. The Pixelblaze can
**be** the network.

Pair this with [`offline-audio-macos.md`](offline-audio-macos.md) (BlackHole +
offline music) and the whole rig is self-contained — no router, no WAN, no
internet, nothing to go down mid-show:

```
Spotify desktop app (offline downloads)
        │  system output →
        ▼
   Multi-Output Device ──► your speakers
        │
        ▼
   BlackHole ──► Chrome (FFT → bands)
                      │  ws://192.168.4.1:81
                      ▼
              Pixelblaze  ◄── and it IS the wifi network
```

---

## 1. Put the Pixelblaze in AP mode

**AP (access point) mode** = the Pixelblaze creates its own wifi network instead
of joining one.

On a Pixelblaze **V3** that's already configured for your wifi: supply power,
then **press and hold the onboard button for ~3.5 seconds**. It drops back into
setup mode and starts broadcasting a network called `Pixelblaze_XXXXXX`.

(On pre-V3 boards there's no onboard button — briefly connect the 6th pin,
**GP0**, to **GND** for ~5 seconds instead.)

Join that network, and the config page should pop up on its own. If it doesn't,
go to **<http://192.168.4.1>**. There, set it to stay in **AP mode**
permanently and give it a password.

> **The password must be at least 8 characters.** Shorter ones are silently
> rejected — the setting looks like it saved and the network never comes back
> protected. This is the single most common way to lock yourself out.

## 2. The address is fixed

In AP mode the Pixelblaze is **always** at `192.168.4.1`. That's a hardcoded
SoftAP address, not DHCP — so unlike client mode there's nothing to discover:

| | client mode | AP mode |
|---|---|---|
| address | whatever DHCP handed out | always `192.168.4.1` |
| finding it | Pixelblaze UI, `nmap`, or discover.electromage.com | it's just `192.168.4.1` |
| needs a router | yes | **no** |
| Mac has internet | yes | **no** |

In the app: IP field → `192.168.4.1`. The socket is `ws://192.168.4.1:81` as
always.

## 3. Everything else already works offline

Nothing else in the stack needs a network:

- **`./run.sh`** serves on **loopback** — `http://localhost:8000` doesn't touch
  any interface that could be down.
- **BlackHole** is a local virtual audio device; the routing is entirely
  in-kernel.
- **Music** comes from Spotify's offline downloads or local files.

So: join the Pixelblaze's network, run the app, pick BlackHole as the source,
connect to `192.168.4.1`. Done.

---

## Gotchas

| symptom | cause / fix |
|---|---|
| Mac keeps leaving the Pixelblaze network | macOS prefers a known network that has internet. Join it manually and ignore the "no internet connection" warning — that warning is expected and correct. |
| Can't reach `192.168.4.1` | A **Tailscale exit node** tunnels all traffic and kills the local route. Set **Exit Node → None** (disconnecting Tailscale entirely is *not* the fix). With no WAN at all this failure is guaranteed, not intermittent. |
| Locked out after setting AP mode | The password was under 8 characters. Hold the button 3.5 s to force setup mode and start over. |
| Spotify won't play offline | Spotify re-verifies your account online periodically (~every 30 days) or offline playback stops. **Dry-run this days before the install goes live**, not on site. |
| Want a phone on it too | ESP32 SoftAP only handles a handful of clients. Works, but see the router option below if you need several. |

## Running unattended (lid closed, never sleeps)

Two separate problems, and only one of them is a power setting.

### 1. Stop the Mac sleeping

```
sudo pmset -a disablesleep 1                       # overrides lid close — the key one
sudo pmset -c sleep 0 displaysleep 0 disksleep 0   # no idle sleep on AC
```

`disablesleep` is the only setting that survives a **lid close**, and nothing in
System Preferences exposes it. Undo with `sudo pmset -a disablesleep 0`.

### 2. Stop the browser stalling the stream

A sleeping Mac is the obvious failure. The non-obvious one: **`requestAnimationFrame`
only fires while the browser is painting.** Lid closed with no external display
means no painting, so an rAF-driven loop stops dead — while the machine is awake,
the audio is still flowing, and the WebSocket is still open. The lights freeze on
the last frame sent and *nothing reports an error*.

The app avoids this by construction. The two loops in `index.html` have different
triggers on purpose:

| loop | trigger | if it stalls |
|---|---|---|
| `analyzeTick()` — FFT, bands, beat, `setVars` | AudioWorklet on the **audio thread** (falls back to `setInterval`) | the lights freeze — must never stall |
| `loop()` — visualizer, meters, pattern preview | `requestAnimationFrame` | nothing, nobody's watching |

The audio thread keeps running regardless of painting, display sleep, tab
visibility, or background-timer throttling. So a lid-closed install needs no
external monitor and **no HDMI dummy plug** — just a Mac that doesn't sleep.

**Check which ticker you got:** the audio status reads `capturing (audio thread)`
when the worklet is live, or `capturing (timer)` on the fallback. The timer
version still works but is only reliable while the tab is visible — if you see
it, keep the window unminimised and the app tab frontmost.

> If you ever move the analysis back onto rAF, all of the above breaks silently.
> Keep drawing and streaming on separate triggers.

## The other option: a router with no WAN

Plug in any wifi router and leave its **WAN port empty**. You get a normal LAN —
several devices, phone control, stable DHCP — with no internet and nothing
upstream to fail. Costs one more box; buys headroom over AP mode's client limit.

Use AP mode when it's one machine and one Pixelblaze. Use the dead router when
it's an install with a phone, a spare laptop, or more than one controller.

## Not an option: USB

Worth stating because it's the obvious guess — the Pixelblaze's USB connector is
**power only**; the data lines aren't connected to anything. There is no serial
control path. WiFi is the only way in, which is exactly why AP mode matters.
