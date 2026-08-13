#!/bin/sh
# Serve the streamer over http and open it in Chrome.
#
#   ./run.sh          # port 8000
#   ./run.sh 9000     # another port
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
URL="http://localhost:$PORT/index.html"

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

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"

echo "serving $DIR"
echo "  → $URL"
[ -n "$LAN_IP" ] && echo "  → http://$LAN_IP:$PORT/index.html   (phone / other machine)"
echo "ctrl-c to stop"
echo

open_browser &

cd "$DIR"
exec "$PY" -m http.server "$PORT" --bind 0.0.0.0
