#!/usr/bin/env bash
# One-command launcher for the IMM Predictive Maintenance demo.
#
#   ./demo.sh              # serve locally at http://localhost:$PORT (default 8000)
#   ./demo.sh --tunnel     # also expose a temporary public Cloudflare URL
#   PORT=9000 ./demo.sh    # pick the local port
#
# Idempotent: first-run setup (venv / models / frontend build / cloudflared)
# only happens when those pieces are missing.
set -euo pipefail
cd "$(dirname "$0")"

VENV=".venv"
PY="$VENV/bin/python"
PORT="${PORT:-8000}"
TUNNEL="${TUNNEL:-0}"
# Tunnel transport. "auto" tries QUIC/UDP first (lowest latency) and falls back to
# http2/TCP if UDP is blocked — the most robust default across networks. Override
# with TUNNEL_PROTOCOL=http2 on networks that block UDP, or =quic to force QUIC.
TUNNEL_PROTOCOL="${TUNNEL_PROTOCOL:-auto}"
for arg in "$@"; do
  case "$arg" in
    --tunnel) TUNNEL=1 ;;
  esac
done

SERVER_PID=""
TUNNEL_PID=""
cleanup() { kill "$SERVER_PID" "$TUNNEL_PID" 2>/dev/null || true; }

echo "==> IMM Predictive Maintenance — demo launcher"

# 1. Python virtualenv + dependencies ----------------------------------------
if [ ! -x "$PY" ]; then
  echo "==> Creating virtualenv and installing dependencies (first run, ~1 min)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip >/dev/null
  "$VENV/bin/pip" install -e .
else
  echo "==> Virtualenv present."
fi

# 2. Trained models -----------------------------------------------------------
if [ ! -f "artifacts/models/quality.pkl" ] || [ ! -f "artifacts/models/rul.pkl" ]; then
  echo "==> Training models (first run, a few minutes)…"
  "$PY" scripts/generate_training_data.py
  "$PY" scripts/retrain_models.py
else
  echo "==> Models present."
fi

# 3. Platform frontend build --------------------------------------------------
# Builds the unified Digital Twin Platform (workbench/dist). run.py serves this
# by default; set WEB_DIR=web/dist to roll back to the legacy dashboard.
if [ ! -f "workbench/dist/index.html" ]; then
  echo "==> Building the Digital Twin Platform frontend (first run)…"
  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is required to build the frontend. Install Node.js, then re-run ./demo.sh" >&2
    exit 1
  fi
  ( cd workbench && npm install && npm run build )
else
  echo "==> Platform build present."
fi

# 4. cloudflared (only when --tunnel) -----------------------------------------
ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    CFD="$(command -v cloudflared)"; return
  fi
  CFD="./bin/cloudflared"
  [ -x "$CFD" ] && return
  echo "==> Downloading cloudflared (first run)…"
  mkdir -p bin
  local arch; arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)  arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "ERROR: unsupported arch '$arch' for auto-download. Install cloudflared manually." >&2; exit 1 ;;
  esac
  if ! curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$arch" -o "$CFD"; then
    echo "ERROR: could not download cloudflared. Install it manually:" >&2
    echo "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
    exit 1
  fi
  chmod +x "$CFD"
}

# 5. Serve --------------------------------------------------------------------
if [ "$TUNNEL" = "1" ]; then
  ensure_cloudflared
  trap cleanup EXIT INT TERM

  echo "==> Starting server on :$PORT…"
  PORT="$PORT" "$PY" run.py >/tmp/imm_server.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "http://localhost:$PORT/" && break
    sleep 0.5
  done

  echo "==> Opening Cloudflare quick tunnel (protocol: $TUNNEL_PROTOCOL)…"
  rm -f cloudflared.log
  "$CFD" tunnel --no-autoupdate --protocol "$TUNNEL_PROTOCOL" --url "http://localhost:$PORT" >cloudflared.log 2>&1 &
  TUNNEL_PID=$!

  # Wait for the URL AND a registered edge connection — a printed URL alone does
  # not mean the tunnel routes (that's the HTTP 530 trap).
  PUBLIC_URL=""
  for _ in $(seq 1 80); do
    PUBLIC_URL="$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' cloudflared.log | head -1 || true)"
    if [ -n "$PUBLIC_URL" ] && grep -q "Registered tunnel connection" cloudflared.log; then
      break
    fi
    sleep 0.5
  done

  # Verify the tunnel actually serves before telling anyone to share it.
  TUNNEL_OK=""
  if [ -n "$PUBLIC_URL" ]; then
    for _ in $(seq 1 10); do
      if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$PUBLIC_URL/")" = "200" ]; then
        TUNNEL_OK=1; break
      fi
      sleep 1
    done
  fi

  echo ""
  echo "============================================================"
  if [ -n "$PUBLIC_URL" ] && [ -n "$TUNNEL_OK" ]; then
    echo "  Public demo URL (share this — temporary):"
    echo "      $PUBLIC_URL"
    echo "  Read-only investor link:"
    echo "      $PUBLIC_URL/#mode=operations&sub=Mold&ro=1"
  elif [ -n "$PUBLIC_URL" ]; then
    echo "  Tunnel URL printed but NOT routing yet (edge returned non-200):"
    echo "      $PUBLIC_URL"
    echo "  If it stays down, retry with: TUNNEL_PROTOCOL=http2 ./demo.sh --tunnel"
    echo "  (and check cloudflared.log for 'Registered tunnel connection')"
  else
    echo "  Tunnel URL not detected yet — check cloudflared.log"
  fi
  echo "  Local URL:  http://localhost:$PORT"
  echo "============================================================"
  echo "  Press Ctrl-C to stop the demo and close the tunnel."
  echo ""
  wait
else
  echo ""
  echo "==> Starting server.  Open:  http://localhost:$PORT"
  echo "    Press Ctrl-C to stop."
  echo ""
  PORT="$PORT" exec "$PY" run.py
fi
