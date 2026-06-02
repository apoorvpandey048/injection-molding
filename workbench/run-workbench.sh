#!/usr/bin/env bash
# Launcher for the Component Mapping Workbench (Phase 8 deployment workflow).
#
#   ./run-workbench.sh             # build (if needed) + serve at http://localhost:4173
#   ./run-workbench.sh --tunnel    # also expose a public Cloudflare URL for remote sessions
#   ./run-workbench.sh --rebuild   # force a fresh production build first
#   PORT=8080 ./run-workbench.sh   # choose the local port
#
# Designed for: develop locally (Stage A) -> commit (Stage B) -> clone on the DGX
# (Stage C/D) -> `./run-workbench.sh --tunnel` (Stage E) -> share the printed URL
# so developer + client review the SAME running instance (Stage F/G) and export
# the final component-map.json (Stage H).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-4173}"
TUNNEL=0
REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --tunnel)  TUNNEL=1 ;;
    --rebuild) REBUILD=1 ;;
  esac
done

SERVER_PID=""
TUNNEL_PID=""
cleanup() { kill "$SERVER_PID" "$TUNNEL_PID" 2>/dev/null || true; }

echo "==> Component Mapping Workbench"

# 1. Dependencies -------------------------------------------------------------
if [ ! -d node_modules ]; then
  command -v npm >/dev/null 2>&1 || { echo "ERROR: npm (Node.js) is required." >&2; exit 1; }
  echo "==> Installing dependencies (first run)…"
  npm install
fi

# 2. Production build ----------------------------------------------------------
if [ "$REBUILD" = "1" ] || [ ! -f dist/index.html ]; then
  echo "==> Building…"
  npm run build
fi

# 3. Locate cloudflared (only for --tunnel) -----------------------------------
ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then CFD="$(command -v cloudflared)"; return; fi
  if [ -x ../bin/cloudflared ]; then CFD="../bin/cloudflared"; return; fi   # reuse repo binary
  CFD="./cloudflared"
  [ -x "$CFD" ] && return
  echo "==> Downloading cloudflared…"
  local arch; arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)  arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "ERROR: unsupported arch '$arch'. Install cloudflared manually." >&2; exit 1 ;;
  esac
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$arch" -o "$CFD"
  chmod +x "$CFD"
}

# 4. Serve --------------------------------------------------------------------
# Vite preview is configured (vite.config.ts) with host:true + allowedHosts:true
# so it accepts the rotating *.trycloudflare.com hostnames — never localhost-only.
echo "==> Serving on :$PORT"
npm run preview -- --host 0.0.0.0 --port "$PORT" >/tmp/workbench_server.log 2>&1 &
SERVER_PID=$!
trap cleanup EXIT INT TERM
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done

if [ "$TUNNEL" = "1" ]; then
  ensure_cloudflared
  echo "==> Opening Cloudflare quick tunnel…"
  rm -f cloudflared.log
  # http2 protocol tunnels over TCP/443 — survives firewalls that block QUIC/UDP.
  "$CFD" tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" >cloudflared.log 2>&1 &
  TUNNEL_PID=$!
  PUBLIC_URL=""
  for _ in $(seq 1 60); do
    PUBLIC_URL="$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' cloudflared.log | head -1 || true)"
    [ -n "$PUBLIC_URL" ] && break
    sleep 0.5
  done
  echo ""
  echo "============================================================"
  [ -n "$PUBLIC_URL" ] && echo "  Public URL (share this — temporary):  $PUBLIC_URL" \
                       || echo "  Tunnel URL not detected yet — see cloudflared.log"
  echo "  Local URL:  http://localhost:$PORT"
  echo "============================================================"
fi

echo "  Press Ctrl-C to stop."
wait "$SERVER_PID"
