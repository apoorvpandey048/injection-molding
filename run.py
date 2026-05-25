"""aiohttp server: serves frontend, WebSocket cycle stream, fault/speedup API."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import queue as _queue
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Set

from aiohttp import web

from src.datasource.simulator_source import SimulatorSource
from src.simulator.degradation import FAILURE_THRESHOLD, OPTIMAL_REPLACE_HIGH, OPTIMAL_REPLACE_LOW

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent / "web" / "dist"
if not WEB_DIR.exists():
    WEB_DIR = Path(__file__).parent / "web" / "public"

MODELS_AVAILABLE = (
    Path("artifacts/models/quality.pkl").exists()
    and Path("artifacts/models/rul.pkl").exists()
)
if MODELS_AVAILABLE:
    from src.ml.predict import predict as ml_predict
else:
    log.warning("No trained models found — ML predictions disabled. Run `make train` first.")

source = SimulatorSource(machine_id="SIM-001", seed=42)
_ws_clients: Set[web.WebSocketResponse] = set()
_latest_snapshot: Optional[Dict[str, Any]] = None
_cycle_queue: _queue.Queue = _queue.Queue(maxsize=8)

# Default cycles-per-day. Kept low relative to the simulator's deliberately short
# component lifespans (~4k–13k cycles) so a healthy machine reads schedule/monitor
# rather than "critical"; adjustable live via the Settings drawer (/api/settings).
CONFIG: Dict[str, Any] = {"cycles_per_day": 40}


def _build_snapshot(cycle: Dict[str, Any]) -> Dict[str, Any]:
    health = source.get_health_snapshot()
    rul_cycles = source.get_rul_cycles()
    active_faults = source.get_active_faults()

    ml_block: Dict[str, Any] = {}
    if MODELS_AVAILABLE:
        try:
            ml_block = ml_predict(cycle, cycles_per_day=float(CONFIG["cycles_per_day"]))
        except Exception as exc:
            log.warning("ML predict failed: %s", exc)

    worst_rul = min(rul_cycles.values()) if rul_cycles else 0.0

    rul_block = ml_block.get("rul", {})
    rul_per_component = ml_block.get("rul_per_component") or {
        comp: {"p10": v * 0.8, "p50": v, "p90": v * 1.2}
        for comp, v in rul_cycles.items()
    }

    # ── machine state (V2) ───────────────────────────────────────────────
    machine_state = source.get_machine_state()
    failed = source.is_failed()
    failure = source.get_failure_info()

    quality = ml_block.get("quality", {"label": "unknown", "probability": {}})
    if failed:
        # Serving-layer presentation override only — the ML model is untouched.
        quality = {
            "label": "waste",
            "probability": {"good": 0.0, "acceptable": 0.0, "waste": 1.0},
        }

    return {
        "cycle_index":   cycle["cycle_index"],
        "timestamp":     cycle["timestamp"],
        "machine_id":    cycle["machine_id"],
        "scalars":       cycle["scalars"],
        "curves":        cycle["curves"],
        "hold_profile":  cycle["hold_profile"],
        "barrel_temps":  cycle["barrel_temps"],
        "health":        health,
        "active_faults": active_faults,
        "rul": {
            "p10":                  rul_block.get("p10", worst_rul * 0.8),
            "p50":                  rul_block.get("p50", worst_rul),
            "p90":                  rul_block.get("p90", worst_rul * 1.2),
            "worst_component":      rul_block.get("worst_component"),
            "replacement_date":     rul_block.get("replacement_date"),
            "urgency":              rul_block.get("urgency"),
            "failure_threshold":    FAILURE_THRESHOLD,
            "optimal_replace_low":  OPTIMAL_REPLACE_LOW,
            "optimal_replace_high": OPTIMAL_REPLACE_HIGH,
        },
        "rul_per_component": rul_per_component,
        "quality":       quality,
        "machine_state": machine_state,
        "failed":        failed,
        "failure":       failure,
        "config":        dict(CONFIG),
    }


def _stream_producer() -> None:
    for cycle in source.stream():
        try:
            _cycle_queue.put(cycle, timeout=10)
        except _queue.Full:
            pass


async def _cycle_loop(app: web.Application) -> None:
    global _latest_snapshot
    loop = asyncio.get_event_loop()

    t = threading.Thread(target=_stream_producer, daemon=True)
    t.start()

    while True:
        cycle = await loop.run_in_executor(None, _cycle_queue.get)
        snap = _build_snapshot(cycle)
        _latest_snapshot = snap
        msg = json.dumps(snap)
        dead: Set[web.WebSocketResponse] = set()
        for ws in list(_ws_clients):
            try:
                await ws.send_str(msg)
            except Exception:
                dead.add(ws)
        _ws_clients.difference_update(dead)


async def handle_index(request: web.Request) -> web.Response:
    index = WEB_DIR / "index.html"
    if index.exists():
        return web.FileResponse(index)
    fallback = Path(__file__).parent / "web" / "index.html"
    if fallback.exists():
        return web.FileResponse(fallback)
    return web.Response(
        text="<h1>IMM Demo</h1><p>Run <code>make web</code> to build the frontend.</p>",
        content_type="text/html",
    )


async def handle_snapshot(request: web.Request) -> web.Response:
    if _latest_snapshot:
        return web.json_response(_latest_snapshot)
    return web.json_response({"error": "no data yet"}, status=503)


async def handle_ws(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    _ws_clients.add(ws)
    if _latest_snapshot:
        await ws.send_str(json.dumps(_latest_snapshot))
    try:
        async for _ in ws:
            pass
    finally:
        _ws_clients.discard(ws)
    return ws


async def handle_fault(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON"}, status=400)
    fault        = body.get("fault", "")
    severity     = float(body.get("severity", 0.6))
    onset_cycles = int(body.get("onset_cycles", 20))
    if fault.startswith("clear_"):
        actual = fault[len("clear_"):]
        source.clear_fault(actual)
        return web.json_response({"status": "ok", "cleared": actual})
    try:
        source.inject_fault(fault, severity, onset_cycles)
    except (ValueError, TypeError) as exc:
        return web.json_response({"error": str(exc)}, status=400)
    return web.json_response({"status": "ok", "fault": fault, "severity": severity})


async def handle_reset(request: web.Request) -> web.Response:
    global _latest_snapshot
    source.reset()
    _latest_snapshot = None
    log.info("Machine reset to pristine state (health 1.0, no faults, cycle 0).")
    return web.json_response({"status": "ok"})


async def handle_get_settings(request: web.Request) -> web.Response:
    return web.json_response(dict(CONFIG))


async def handle_post_settings(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON"}, status=400)
    if "cycles_per_day" in body:
        try:
            cpd = float(body["cycles_per_day"])
        except (ValueError, TypeError):
            return web.json_response({"error": "cycles_per_day must be a number"}, status=400)
        if cpd <= 0:
            return web.json_response({"error": "cycles_per_day must be > 0"}, status=400)
        CONFIG["cycles_per_day"] = cpd
    return web.json_response(dict(CONFIG))


async def handle_speedup(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON"}, status=400)
    cps = float(body.get("cycles_per_second", 1.0))
    source.set_speedup(cps)
    return web.json_response({"status": "ok", "cycles_per_second": cps})


async def on_startup(app: web.Application) -> None:
    app["cycle_task"] = asyncio.create_task(_cycle_loop(app))


async def on_cleanup(app: web.Application) -> None:
    app["cycle_task"].cancel()
    try:
        await app["cycle_task"]
    except asyncio.CancelledError:
        pass


def make_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/",             handle_index)
    app.router.add_get("/api/snapshot", handle_snapshot)
    app.router.add_get("/ws",           handle_ws)
    app.router.add_post("/api/fault",   handle_fault)
    app.router.add_post("/api/reset",   handle_reset)
    app.router.add_post("/api/speedup", handle_speedup)
    app.router.add_get("/api/settings",  handle_get_settings)
    app.router.add_post("/api/settings", handle_post_settings)
    if (WEB_DIR / "assets").exists():
        app.router.add_static("/assets", WEB_DIR / "assets", show_index=False)
    # Static public assets needed at runtime by the built app (3D backdrop + Draco decoder).
    for _static_dir in ("models", "draco"):
        _static_path = WEB_DIR / _static_dir
        if _static_path.exists():
            app.router.add_static(f"/{_static_dir}", _static_path, show_index=False)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    log.info("Starting IMM demo on http://localhost:%d", port)
    web.run_app(make_app(), port=port)
