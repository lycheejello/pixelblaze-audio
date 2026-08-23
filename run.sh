#!/bin/sh
# Serve the streamer over http and open it in Chrome.
#
#   ./run.sh              # serve on 8000, open the app on ?auto=1
#   ./run.sh 9000         # another port
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

open_browser() {
  # give the server a moment, then open the page
  sleep 1
  if [ "$(uname)" = "Darwin" ]; then
    open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1
  else
    echo "open this: $URL"
  fi
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
exec "$PY" -m http.server "$PORT" --bind 0.0.0.0
