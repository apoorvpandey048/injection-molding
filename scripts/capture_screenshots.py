"""Capture demo screenshots of the dashboard across all major states.

Run the backend first (PORT=8765 python run.py), then:
    python scripts/capture_screenshots.py

Drives the live machine through healthy → warning → critical → failed and
captures the reset dialog, settings drawer, and a component detail dialog.
"""
import json
import os
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

OUT = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
PORT = os.environ.get("PORT", "8765")
BASE = f"http://localhost:{PORT}"
URL = f"{BASE}/"


def _post(path: str, body: dict | None = None) -> None:
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    urllib.request.urlopen(req).read()


def _state() -> dict:
    with urllib.request.urlopen(f"{BASE}/api/snapshot") as r:
        return json.load(r)


def _wait_for_state(target: str, timeout_s: float = 240.0) -> None:
    """Block until the simulator's machine_state reaches `target`.

    The effective cycle rate is bounded by ML-predict latency (~5/s), not the
    speedup setting, so degradation to failure takes a couple of minutes.
    """
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            if _state().get("machine_state") == target:
                return
        except Exception:
            pass
        time.sleep(0.2)
    raise TimeoutError(f"machine_state never reached {target!r}")


def _shot(page: Page, name: str, full: bool = True) -> None:
    page.screenshot(path=str(OUT / name), full_page=full)
    print(f"  [ok]   {name}")


def main() -> None:
    # Start from a pristine machine at normal speed.
    _post("/api/reset")
    _post("/api/speedup", {"cycles_per_second": 1})
    _post("/api/settings", {"cycles_per_day": 40})

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
        )
        ctx = browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
        page = ctx.new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector("text=COMPONENT HEALTH & RUL", timeout=15000)
        page.wait_for_timeout(2500)

        # ── healthy dashboard ──────────────────────────────────────────────
        _shot(page, "01_dashboard.png")

        # ── component detail dialog ────────────────────────────────────────
        page.locator("button[aria-label*='health']").first.click()
        dlg = page.locator("[role=dialog]")
        dlg.wait_for(state="visible", timeout=5000)
        page.wait_for_timeout(1000)
        dlg.screenshot(path=str(OUT / "02_gauge_dialog.png"))
        print("  [ok]   02_gauge_dialog.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ── reset confirmation dialog ──────────────────────────────────────
        page.get_by_role("button", name="Reset", exact=True).click()
        page.locator("[role=dialog]").wait_for(state="visible", timeout=5000)
        page.wait_for_timeout(500)
        _shot(page, "reset_confirm.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ── settings drawer ────────────────────────────────────────────────
        page.get_by_role("button", name="Open settings").click()
        page.locator("[role=dialog]").wait_for(state="visible", timeout=5000)
        page.wait_for_timeout(600)
        _shot(page, "settings_drawer.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ── drive to failure, capturing each state on the way ──────────────
        # Inject via the API at full severity (the UI button uses 0.6, slower);
        # the snapshot's active_faults still lights up the Demo-controls button.
        _post("/api/fault", {"fault": "hydraulic_pump_wear", "severity": 1.0, "onset_cycles": 1})
        _post("/api/speedup", {"cycles_per_second": 30})

        _wait_for_state("warning")
        page.wait_for_timeout(500)
        _shot(page, "state_warning.png")

        _wait_for_state("critical")
        page.wait_for_timeout(500)
        _shot(page, "state_critical.png")
        # The existing overview's "fault injected" figure: reuse the critical view.
        _shot(page, "03_with_fault.png")

        _wait_for_state("failed")
        page.wait_for_selector("text=Machine FAILED", timeout=10000)
        page.wait_for_timeout(800)
        _shot(page, "state_failed.png")

        browser.close()

    # Leave the machine clean for the live demo.
    _post("/api/reset")
    _post("/api/speedup", {"cycles_per_second": 1})
    print("done — machine reset to pristine.")


if __name__ == "__main__":
    main()
