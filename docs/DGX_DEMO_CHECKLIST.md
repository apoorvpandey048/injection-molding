# DGX Demo Checklist — IMM Digital Twin Platform

A copy-paste runbook for an investor demo on the DGX with a shareable public link.

## 0. One-time setup (per DGX, first run only)
```bash
git clone https://github.com/apoorvpandey048/injection-molding.git
cd injection-molding
./demo.sh            # first run: creates venv + builds the frontend, then serves
```
Requirements: Python ≥ 3.11, Node.js + npm, outbound internet (pip/npm + tunnel).
Trained models, the component map and the default config are committed — **no
retraining, no re-mapping**. First run only does venv + `npm install && build`.

## 1. Launch with a public link
```bash
./demo.sh --tunnel
```
Watch the banner for:
```
============================================================
  Public demo URL (share this — temporary):
      https://<random>.trycloudflare.com
  Local URL:  http://localhost:8000
============================================================
```
The tunnel URL is **temporary** (regenerated each launch). Keep this terminal open;
`Ctrl-C` stops the server and closes the tunnel.

## 2. Share the right link
- **Presenter (you):** use the plain URL — full control (reset, settings, fault
  injection) for driving the demo.
- **Investors / remote viewers:** share the **read-only** link so they can explore
  but never disrupt the live machine:
  ```
  https://<random>.trycloudflare.com/#mode=operations&sub=Mold&ro=1
  ```
  - `ro=1` → read-only (a 🔒 READ-ONLY badge shows; reset/settings/demo controls hidden).
  - `sub=Mold` (optional) → opens straight into a subsystem. Omit `&sub=...` for the
    machine overview. Any of: `Hydraulic`, `ScrewCheckRing`, `Drive`, `Heaters`, `Mold`.
  - `mode=inspection` → opens the engineering inspection view instead.

## 3. The 90-second demo script
1. Open the link → **Operations**. Healthy machine, green twin, five subsystems live.
2. **Hover** a subsystem in the rail → its region lights up on the 3-D model; the
   tooltip explains it in plain English.
3. **Click** a subsystem (e.g. Mold) → the camera flies in, the right panel becomes
   that subsystem's live detail (health, RUL, forecast, sensors).
4. (Presenter) Open **Demo controls** → inject **Hydraulic** at high severity, raise
   **Speed** → watch the base of the machine go green → amber → red, the RUL forecast
   collapse, quality flip to WASTE, and a **MACHINE FAILED** banner appear.
5. Hover any number or chart point → it tells you what it means and what to do.
6. (Presenter) **Reset** → back to 100%, run the story again.
7. Flip to **Inspection** → show the mesh hierarchy, isolate a part, wireframe/x-ray.

## 4. Reset between runs
- Click **Reset** (presenter) — restores 100% health, clears faults, zeros the counter.
- Set **Speed ×1** for a calm live view between fault demos.

## 5. Troubleshooting
- **RUL shows "—" everywhere and Predicted Quality is UNKNOWN:** the ML models can't
  be loaded by this machine's scikit-learn (the committed models are trained with
  1.8.x). Retrain once in the local env:
  ```bash
  rm -f artifacts/models/*.pkl && ./demo.sh --tunnel   # trains ~few min, then serves
  ```
  After it restarts, dates / urgency / quality populate. Confirm the cause with:
  `grep -i "ML predict failed" /tmp/imm_demo.log`.
- **Tunnel URL not printed:** check `cloudflared.log`; re-run `./demo.sh --tunnel`.
- **Public link opens but shows Cloudflare error 530 (origin unreachable):** the
  tunnel printed a URL but never registered an edge connection (no
  `Registered tunnel connection` line in `cloudflared.log`). `demo.sh` now uses
  `TUNNEL_PROTOCOL=auto` (QUIC first, http2 fallback) and verifies the URL returns
  200 before printing it as shareable, so this should not surface. If a network
  blocks UDP, force TCP: `TUNNEL_PROTOCOL=http2 ./demo.sh --tunnel`. To put a fresh
  tunnel in front of an already-running server without restarting it:
  ```bash
  pkill -9 -f 'cloudflared.*--url http://localhost:8000' 2>/dev/null; sleep 2
  tmux new -d -s immtun "cloudflared tunnel --no-autoupdate --url http://localhost:8000 2>&1 | tee cloudflared.log"
  ```
  then read the URL from `cloudflared.log` once `Registered tunnel connection` appears.
- **Live badge shows Offline / cycles frozen:** restart the server (`Ctrl-C`, then
  `./demo.sh --tunnel`). A very long-running instance can stall the cycle thread;
  a fresh start always resumes streaming.
- **Blank 3-D / slow first paint:** the model is ~8.6 MB COLLADA; first load parses
  it (a few seconds). Subsequent interactions are smooth.
- **Roll back to the legacy dashboard:** `WEB_DIR=web/dist ./demo.sh`.

## 6. Stop
`Ctrl-C` in the demo terminal — stops the server and closes the tunnel.
