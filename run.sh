#!/bin/sh
# Serve the streamer over http and open it in Chrome.
#
#   ./run.sh              # serve on 8000, open the app on ?auto=1
#   ./run.sh 9000         # another port
#   PORTAL=0 ./run.sh     # don't open the Pixelblaze's own web UI
#
# Join the Pixelblaze's wifi network yourself before running this — a web page
# has no API for it, and scripting it around a device that may or may not be
# broadcasting was more trouble than picking it from the menu bar.
#
# http, not https: the page talks to the Pixelblaze over plain ws://, which an
# https page would block as mixed content.
#
# Apple's /usr/bin/python3 on purpose: macOS Local Network privacy blocks
# non-Apple binaries (homebrew python) from the LAN, so a brew-python server
# can't be reached from a phone or another machine on the network.

set -e

PORT="${1:-${PORT:-8000}}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# This machine's LAN address, handed to the page as ?lan= so its "find" sweep
# knows which /24 to scan. Without it the page has to guess (it's served from
# localhost, which says nothing about the network), and sweeping the wrong /24
# fills Chrome's socket pool with dead connections — the sweep of the real
# subnet then comes back empty even when the Pixelblaze is sitting right there.
lan_ip() {
  ipconfig getifaddr en0 2>/dev/null && return 0
  ipconfig getifaddr en1 2>/dev/null && return 0
  hostname -I 2>/dev/null | awk '{print $1}' | grep . && return 0
  return 1
}
LAN_IP="$(lan_ip || true)"

URL="http://localhost:$PORT/index.html?auto=1"
[ -n "$LAN_IP" ] && URL="$URL&lan=$LAN_IP"

PY=/usr/bin/python3
[ -x "$PY" ] || PY="$(command -v python3)"

open_url() {
  if [ "$(uname)" = "Darwin" ]; then
    open -a "Google Chrome" "$1" 2>/dev/null || open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1
  else
    echo "open this: $1"
  fi
}

open_browser() {
  # give the server a moment, then open the page
  sleep 1
  open_url "$URL"
}

# The page finds the Pixelblaze, not this script — it sweeps the LAN from the
# browser, and DHCP moves the device between reboots, so the address isn't known
# until it connects. So the page pings /_found?ip=… on this very server (a 404
# it doesn't care about) and we watch the request log for it and open the
# device's own web UI. That's where the patterns and the Mapper live, and it's
# the thing you want next to the streamer anyway.
#
# Piping python's log through this instead of exec'ing it costs one subshell;
# ctrl-c still reaches both, since it goes to the whole foreground group.
serve() {
  # Every address opened so far, space-delimited — not just the last one. The
  # page can drive several Pixelblazes and beacons each of them, so a reload
  # replays the whole set; matching only the previous address would reopen every
  # tab but one on each reload.
  opened=' '
  "$PY" -u -m http.server "$PORT" --bind 0.0.0.0 2>&1 | while IFS= read -r line; do
    printf '%s\n' "$line"
    case "$line" in
      *"/_found?ip="*)
        [ "${PORTAL:-1}" = "0" ] && continue
        ip=$(printf '%s' "$line" | sed -n 's|.*/_found?ip=\([0-9][0-9.]*\).*|\1|p')
        [ -n "$ip" ] || continue
        case "$opened" in *" $ip "*) continue ;; esac
        opened="$opened$ip "
        echo "found a Pixelblaze at $ip — opening its web UI"
        open_url "http://$ip/"
        ;;
    esac
  done
}

if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
  echo "something is already serving on :$PORT — just opening the page"
  open_browser
  exit 0
fi

echo "serving $DIR"
echo "  → $URL"
[ -n "$LAN_IP" ] && echo "  → http://$LAN_IP:$PORT/index.html   (phone / other machine)"
echo "ctrl-c to stop"
echo

open_browser &

cd "$DIR"
serve
