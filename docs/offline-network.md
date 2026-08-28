# No network at all

The app and the Pixelblaze have to be on the same network, but that network
doesn't have to be *yours*, and it doesn't need internet. Either the Pixelblaze
or your Mac can **be** the network.

## Pick the network first

| what you're running | use | addresses |
|---|---|---|
| one Pixelblaze, one Mac | **AP mode** — the Pixelblaze is the network (§1–3) | always `192.168.4.1` |
| **two or more Pixelblazes** | **the Mac is the network** — macOS Internet Sharing, no extra hardware | `192.168.2.x`, DHCP |
| …plus a phone, a spare laptop, or you already carry a travel router | **a router with no WAN** | whatever it hands out |

**Two Pixelblazes both in AP mode does not work**, and not for a reason anyone
can code around:

- each one in AP mode broadcasts its *own* wifi network, and a laptop has one
  radio — while you are joined to PB-A, PB-B does not exist;
- both are hardcoded to `192.168.4.1`, so even if you could see both at once
  there would be no way to address them separately.

So past one device, something else has to be the network.

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

## Two or more Pixelblazes: the Mac is the network

The cheapest "something else" is the Mac already running the show. **Internet
Sharing** turns its wifi radio into a real access point with DHCP — no router to
carry, no extra battery.

### Set it up at home, not on site

1. **On the Mac** — System Settings → General → **Sharing** → **Internet Sharing**:
   - *Share your connection from*: anything (see the caveat below)
   - *To computers using*: **Wi-Fi**
   - **Wi-Fi Options…** → set a network name and a **WPA2 password of at least
     8 characters** (same trap as AP mode), then switch Internet Sharing on.
2. **Confirm the Mac came up as the router.** `ipconfig getifaddr bridge100`
   should print `192.168.2.1`. That address is on **`bridge100`**, not `en0` —
   `en0` is busy being the radio and usually has no IPv4 of its own. Worth
   knowing, because it is what trips up anything that only looks at `en0`.
3. **Point each Pixelblaze at that network.** One at a time: hold the button
   ~3.5 s to force setup mode, join its `Pixelblaze_XXXXXX`, open
   <http://192.168.4.1>, and set it to **client mode** with the SSID and password
   from step 1. It reboots and joins the Mac.
4. **Rejoin the Mac's own network, run the app, hit `find all`.** Both devices
   show up, the address box fills in with `192.168.2.x, 192.168.2.y`, and the
   status line reads `connected · 2 devices`. The same audio stream drives both;
   they can be running different patterns.

> **Test the "share from" source before you leave.** Internet Sharing insists on
> a source interface even when there is nothing upstream — pick **Thunderbolt
> Bridge**, or a USB-C ethernet adapter with nothing plugged into it. It normally
> starts fine with a dead source, but if your macOS version refuses you need the
> router option below, and that is a thing to discover at home rather than in a
> dust storm.

### While the show runs

- **The Mac is the network.** If it sleeps, both devices drop — see
  *Running unattended* below, and do that part properly.
- **The radio is taken.** While sharing, the Mac cannot also be joined to some
  other wifi network.
- **Addresses can move.** Internet Sharing has no DHCP reservations, so a power
  cycle can renumber the devices. That is what **find all** is for; the app also
  remembers the set that last connected and re-dials it on the next launch.

### One thing to know if you don't use run.sh

`./run.sh` handles the bridge: it enumerates every interface (not just `en0`),
hands all of this machine's addresses to the page as `?lan=`, and `192.168.2.` is
in the page's fallback sweep list either way.

**Serving by hand skips that.** `python3 -m http.server` plus a bare
`http://localhost:8000` leaves the page unable to tell which network it is on —
it sweeps the wrong `/24` and reports nothing while both Pixelblazes sit there
answering. Pass it yourself:

```
http://localhost:8000/index.html?lan=192.168.2.1
```

---

## Setting this up on a different Mac

Everything above is per-machine. Fresh laptop, before the show:

| step | what / check |
|---|---|
| the app | `git clone` this repo, `cd` in, `./run.sh`. No build step, no dependencies. |
| python | none to install — `run.sh` uses Apple's `/usr/bin/python3` **on purpose**. A homebrew python cannot reach the LAN at all under macOS Local Network privacy. |
| Chrome | the tested browser: `getDisplayMedia` and device labels are reliable there. |
| BlackHole | install it and build the Multi-Output Device — [`offline-audio-macos.md`](offline-audio-macos.md). Without it the app captures silence. |
| mic permission | click **list inputs** once and allow. Device *names* stay hidden until an origin has been granted mic access, and the app selects BlackHole **by name**. |
| local network permission | Chrome asks on the first sweep. If it is denied, every probe fails in under 60 ms and the app's **log** link says so explicitly. |
| Tailscale | **Exit Node → None.** An exit node tunnels the local route; with no WAN this fails every single time, not intermittently. |
| never sleeps | `sudo pmset -a disablesleep 1` — see *Running unattended*. |
| dry run | rehearse the whole thing days ahead. Spotify's offline expiry is the one that bites on site. |

---

## Gotchas

| symptom | cause / fix |
|---|---|
| Mac keeps leaving the Pixelblaze network | macOS prefers a known network that has internet. Join it manually and ignore the "no internet connection" warning — that warning is expected and correct. |
| Can't reach `192.168.4.1` | A **Tailscale exit node** tunnels all traffic and kills the local route. Set **Exit Node → None** (disconnecting Tailscale entirely is *not* the fix). With no WAN at all this failure is guaranteed, not intermittent. |
| Locked out after setting AP mode | The password was under 8 characters. Hold the button 3.5 s to force setup mode and start over. |
| Spotify won't play offline | Spotify re-verifies your account online periodically (~every 30 days) or offline playback stops. **Dry-run this days before the install goes live**, not on site. |
| Want a phone on it too | ESP32 SoftAP only handles a handful of clients. Works, but see the router option below if you need several. |
| Internet Sharing won't switch on | It wants a *share from* interface even with nothing upstream. Pick Thunderbolt Bridge or an unplugged USB-C ethernet adapter. |
| `find` reports nothing on `192.168.2.x` | The page was served by hand without `?lan=`, so it is guessing subnets. Use `./run.sh`, or open `…/index.html?lan=192.168.2.1`. |
| Only one of two Pixelblazes connects | Plain **find** stops at the first known address that answers. Hit **find all**, which sweeps regardless and connects to everything it finds. |

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

Where it wins over sharing from the Mac: the laptop keeps its wifi radio free,
the network survives the laptop being closed or carried away, and a real router
handles more clients than an ESP32 SoftAP or a Mac bridge comfortably will.

The whole choice in one line: **AP mode** for one Pixelblaze and one Mac,
**Internet Sharing** for several Pixelblazes and nothing extra to carry, a
**dead router** when the network has to outlive the laptop.

## Not an option: USB

Worth stating because it's the obvious guess — the Pixelblaze's USB connector is
**power only**; the data lines aren't connected to anything. There is no serial
control path. WiFi is the only way in, which is exactly why AP mode matters.
