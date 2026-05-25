"""Generate docs/PROTOTYPE_OVERVIEW.docx — a complete walkthrough of the prototype."""
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "docs" / "PROTOTYPE_OVERVIEW.docx"


def H(doc, text, level=1):
    doc.add_heading(text, level=level)


def P(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    return p


def bullet(doc, text):
    doc.add_paragraph(text, style="List Bullet")


def code(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.name = "Consolas"
    r.font.size = Pt(9)


def img(doc, name, caption, width=6.0):
    path = SHOTS / name
    if not path.exists():
        P(doc, f"[missing screenshot: {name}]", italic=True)
        return
    doc.add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(f"Figure: {caption}")
    r.italic = True
    r.font.size = Pt(9)


def _shade(cell, hex_color):
    """Fill a table cell with a solid background color (for palette swatches)."""
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color.lstrip("#"))
    cell._tc.get_or_add_tcPr().append(shd)


def glossary_entry(doc, term, technical, plain, floor):
    p = doc.add_paragraph()
    p.add_run(f"{term} — ").bold = True
    p.add_run(technical)
    pl = doc.add_paragraph()
    r = pl.add_run("In plain English: ")
    r.bold = True
    pl.add_run(plain)
    fl = doc.add_paragraph()
    r = fl.add_run("On the factory floor: ")
    r.bold = True
    r.italic = True
    fr = fl.add_run(floor)
    fr.italic = True
    doc.add_paragraph()


def palette_table(doc, rows):
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for c, txt in zip(hdr, ("Token", "Swatch", "Hex · purpose")):
        c.paragraphs[0].add_run(txt).bold = True
    for token, hexv, purpose in rows:
        cells = table.add_row().cells
        cells[0].text = token
        _shade(cells[1], hexv)
        cells[2].text = f"{hexv} · {purpose}"


def main():
    doc = Document()

    # ---------- Title ----------
    t = doc.add_heading("Injection-Molding Predictive Maintenance Digital Twin", 0)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("Prototype Overview — what was built, how it works, and how to extend it")
    r.italic = True

    # ---------- Goal ----------
    H(doc, "1. Goal", 1)
    P(doc,
      "Decide when exactly to replace an injection-molding machine — neither too early "
      "(wasted residual life, lost capital) nor too late (catastrophic failure, zero resale "
      "value). The prototype predicts Remaining Useful Life (RUL) per component, converts that "
      "into a calendar replacement date and an urgency band, and surfaces it all in a live "
      "dashboard so an operator can plan interventions component-by-component.")
    P(doc, "The replacement decision is anchored on three health constants exposed via the API:")
    code(doc,
         "FAILURE_THRESHOLD    = 0.20   # below this: imminent failure, do not run\n"
         "OPTIMAL_REPLACE_LOW  = 0.35   # sweet-spot lower bound\n"
         "OPTIMAL_REPLACE_HIGH = 0.42   # sweet-spot upper bound — best resale window")
    P(doc, "Replace when median predicted health enters [0.35, 0.42]. Above 0.42 → keep running. "
           "Below 0.20 → already too late.")

    # ---------- What was built ----------
    H(doc, "2. What was built", 1)
    P(doc, "End-to-end working prototype, intentionally minimal stack:")
    bullet(doc, "Physics-style cycle simulator with hidden component health (5 components) and injectable faults.")
    bullet(doc, "DataSource abstraction — same interface for sim and real PLC. Swap one class to go live.")
    bullet(doc, "Cycle-feature extractor (49 observable features per shot, no hidden state leakage).")
    bullet(doc, "Per-component RUL: for each of the 5 components, three quantile regressors (p10/p50/p90). "
                "Plus a calibrated 3-class quality classifier (good / acceptable / waste).")
    bullet(doc, "Urgency engine: converts each component's predicted RUL (cycles) into a calendar "
                "replacement date and an urgency band (critical / imminent / schedule / monitor), "
                "driven by a configurable cycles-per-day setting.")
    bullet(doc, "aiohttp WebSocket server streaming live cycles + predictions; REST endpoints for "
                "fault injection, sim speed, and runtime settings (/api/settings).")
    bullet(doc, "Modern React UI (Vite + React 18 + Tailwind + shadcn/ui + Recharts + lucide): radial "
                "component gauges, per-component detail dialogs, RUL band chart, quality card, live "
                "process charts, fault controls.")
    bullet(doc, "Optional interactive 3-D digital twin of the machine (Three.js, Draco-compressed glb), "
                "feature-flagged on via VITE_ENABLE_3D.")

    H(doc, "2.1 Component map", 2)
    code(doc,
         "src/simulator/   machine.py, profiles.py, degradation.py (FSM), faults.py\n"
         "src/datasource/  simulator_source.py, plc_source.py  (same interface)\n"
         "src/ml/          features.py, splits.py, train_quality.py, train_rul.py,\n"
         "                 predict.py, urgency.py\n"
         "scripts/         generate_training_data.py, retrain_models.py,\n"
         "                 capture_screenshots.py, build_overview_doc.py\n"
         "run.py           aiohttp server — WS stream, /api/fault, /api/speedup,\n"
         "                 /api/settings, static frontend + /models + /draco\n"
         "web/             Vite + React (TS strict). components/: ComponentGauge,\n"
         "                 ComponentGrid, RULBand, QualityCard, ProcessCharts,\n"
         "                 FaultButtons, Twin2D, Twin3D, ui/ (shadcn primitives)\n"
         "web/public/      models/injection_machine.glb (Draco), draco/ (decoder)")

    # ---------- Live demo ----------
    H(doc, "3. The live demo", 1)
    P(doc, "Healthy machine streaming live cycles: five radial gauges show per-component health and "
           "days-until-replacement, the RUL band sits far from the failure threshold, quality is GOOD.")
    img(doc, "01_dashboard.png", "Full dashboard — live cycles, per-component gauges, RUL band, quality, process curves")

    P(doc, "After clicking a fault (e.g. Hydraulic Pump Wear): the affected component's gauge swings "
           "toward critical, health drops, the RUL band collapses toward the failure threshold, and "
           "quality degrades. This proves the simulator → features → ML → UI pipeline reacts end-to-end.")
    img(doc, "03_with_fault.png", "Fault injected — component health drops, RUL shrinks, quality degrades")

    # ---------- UI semantics ----------
    H(doc, "4. How to read the UI", 1)

    H(doc, "4.1 Component gauges (Component Health & RUL)", 2)
    P(doc, "Five radial gauges, one per component (hydraulic, screw / check ring, heaters, drive, mold). "
           "The ring fill encodes health; the ring color encodes urgency band — red = critical (< 7 days), "
           "amber = imminent (7–30), cyan = schedule (30–90), green = monitor (> 90). Center text shows "
           "days until replacement. Click any gauge to open its detail dialog.")

    H(doc, "4.2 Component detail dialog", 2)
    img(doc, "02_gauge_dialog.png", "Per-component dialog — p10/p50/p90, RUL band, replacement date, urgency", width=5.0)
    P(doc, "The dialog shows that component's RUL quantiles (p10 / p50 / p90 in cycles), a component-scoped "
           "RUL band with the failure-threshold reference, the calendar replacement date, days remaining, "
           "and a (stub) Schedule-maintenance action.")

    H(doc, "4.3 RUL forecast band", 2)
    P(doc, "Recharts area band for the worst component (lowest median RUL). Three quantiles from three models:")
    bullet(doc, "p50 (line) — median estimate, the headline number.")
    bullet(doc, "p10 / p90 (band) — pessimistic / optimistic bounds (10 % tails).")
    P(doc, "A failure-threshold reference line and the resale sweet-spot window are drawn for context. "
           "The footer names the worst component and its replace-by date.")

    H(doc, "4.4 Quality card", 2)
    P(doc, "Calibrated 3-class prediction per shot: GOOD / ACCEPTABLE / WASTE with probability bars. "
           "Probabilities are calibrated (CalibratedClassifierCV) so they can be thresholded directly — "
           "e.g. alert when P(waste) > 0.3 for three consecutive shots.")

    H(doc, "4.5 Process charts", 2)
    P(doc, "Live cavity-pressure, injection-pressure, screw-position / velocity, and nozzle-temperature "
           "traces from the most recent cycle (Recharts line charts). Models consume engineered cycle "
           "features, not the raw curves.")

    H(doc, "4.6 Fault buttons + controls", 2)
    P(doc, "Click a fault button (Check Ring Wear, Heater Drift, Hydraulic Pump Wear) to inject that "
           "failure mode; the button turns red while active, click again to clear. The speed slider scales "
           "sim wall-clock for demos / fast degradation. The header shows machine id, cycle counter, and a "
           "green WebSocket-health dot.")

    H(doc, "4.7 Digital twin", 2)
    P(doc, "Default build: a lightweight 2-D schematic twin. With the 3-D feature flag enabled, the same "
           "card becomes an interactive 3-D model of the machine (drag to orbit, scroll to zoom, idle "
           "auto-rotate). See section 6.")
    img(doc, "app_3d_panel.png", "Dashboard with the interactive 3-D digital twin enabled (top-left card)")

    # ---------- Under the hood ----------
    H(doc, "5. How it works under the hood", 1)

    H(doc, "5.1 Simulator", 2)
    P(doc, "Each cycle the machine produces cavity-pressure / velocity / screw-position curves. A hidden "
           "finite-state machine (degradation.py) advances each component's true health, accelerated by "
           "injected faults. The FSM state is private — used only to label training rows, never as a feature.")

    H(doc, "5.2 Feature extraction", 2)
    P(doc, "features.py turns each raw cycle into 49 scalar features: peak pressures, areas under the curve, "
           "time-to-peak, slopes, ratios, temperature stats, etc. These are the only inputs to the models. "
           "An AST-level lint test forbids features.py from importing src.simulator.* — a hard guard against "
           "leaking hidden state into features.")

    H(doc, "5.3 Models (per-component RUL + quality)", 2)
    bullet(doc, "RUL: for EACH of the 5 components, 3 GradientBoostingRegressors with quantile loss "
                "(alpha = 0.1, 0.5, 0.9). Artifact shape: {components: {<comp>: {models, feature_cols, val_scores}}}.")
    bullet(doc, "Quality: CalibratedClassifierCV(GradientBoostingClassifier) — 3 classes, calibrated probabilities.")
    bullet(doc, "Validation: GroupKFold by machine_id — a machine's cycles are never split across train/val.")
    bullet(doc, "Calibration gate: a held-out test asserts [p10, p90] coverage >= 70 % per component.")
    bullet(doc, "No-leakage: neither head may use hidden FSM health nor the RUL target columns "
                "(rul_*_cycles) as features — enforced in both trainers.")
    P(doc, "Note on per-component val scores: because an un-faulted component's RUL is essentially "
           "(0.8 / base_wear) − elapsed_cycles, the per-component targets are affine-equivalent (same shape, "
           "different offset). Quantile pinball loss is invariant to that additive offset once learned, so the "
           "per-component pinball scores come out nearly identical — this is a property of the simulator's "
           "design, not a training bug; predicted RUL ranges still differ correctly per component.")
    P(doc, "Predictor (predict.py) loads the per-component artifact, returns rul_per_component (p10/p50/p90 "
           "+ replacement_date + urgency for each component) plus a back-compat top-level rul block for the "
           "worst component. Quantile crossings from the independent heads are absorbed by sorting.")

    H(doc, "5.4 Replacement dates + urgency", 2)
    P(doc, "urgency.py is pure functions:")
    code(doc,
         "cycles_to_date(cycles, cycles_per_day, now) -> date\n"
         "classify(days) -> 'critical' (<7) | 'imminent' (7-30) | 'schedule' (30-90) | 'monitor' (>=90)")
    P(doc, "cycles_per_day is a runtime setting (default 40, adjustable live in the Settings drawer) "
           "read/updated via GET/POST /api/settings and echoed in every snapshot's config block; the "
           "predictor uses it to turn cycles into dates. It is kept low relative to the simulator's "
           "deliberately short component lifespans (~4k–13k cycles to the failure line) so a healthy "
           "machine reads schedule/monitor rather than critical.")

    H(doc, "5.5 Serving", 2)
    P(doc, "run.py launches an aiohttp app. On each incoming cycle it extracts features, calls "
           "predict.predict(cycles_per_day=...), and broadcasts the snapshot over WebSocket to all browser "
           "clients. REST: /api/fault, /api/speedup, /api/settings. Static: the built frontend plus /models "
           "and /draco (needed by the 3-D twin). If model artifacts are missing the server still runs — the "
           "UI shows raw cycles with a per-cycle FSM fallback for RUL.")

    # ---------- 3D twin ----------
    H(doc, "6. The 3-D digital twin", 1)
    P(doc, "Optional, feature-flagged interactive 3-D model of the machine.")
    img(doc, "model_preview.png", "The Draco-compressed injection-machine model (350 KB)", width=5.0)
    bullet(doc, "Source: Trimble 3D Warehouse model. Its General Model License permits embedding in a "
                "larger 'Combined Work' and format conversion, requires no attribution; only standalone "
                "redistribution is barred (N/A here). License analysis: docs/3D_LICENSE.md.")
    bullet(doc, "Pipeline: .dae (8.7 MB) -> glb via trimesh -> gltf-transform optimize "
                "(dedup/join/weld/Draco/WebP) -> 350 KB (307 KB gzipped). Output is committed at "
                "web/public/models/injection_machine.glb.")
    bullet(doc, "Twin3D.tsx: plain Three.js + GLTFLoader + DRACOLoader (decoder served from /draco/) + "
                "OrbitControls; bbox auto-fit, ResizeObserver, full dispose-on-unmount.")
    bullet(doc, "Enable with VITE_ENABLE_3D=true at build/dev time; the Digital Twin card then renders "
                "Twin3D instead of the 2-D schematic. Off by default (no three.js model fetch).")
    bullet(doc, "Live per-component binding is deferred: the model's nodes have only generic names "
                "(group_*, instance_*), so health is shown via the gauges, not bound to meshes. Binding "
                "would require re-authoring the model with semantic node names.")

    # ---------- Reproducibility / cloning ----------
    H(doc, "7. Reproducibility — cloning to a new machine (e.g. DGX)", 1)
    P(doc, "What is tracked in the source tree and survives a clone:", bold=True)
    bullet(doc, "All code (src/, scripts/, run.py, tests/, web/src/).")
    bullet(doc, "3-D assets: web/public/models/injection_machine.glb and web/public/draco/* "
                "(NOT gitignored) — the twin works after clone with no re-conversion.")
    bullet(doc, "The original 3-D source archive web/public/models/injection+machine.zip (re-conversion is reproducible).")
    bullet(doc, "Dependency manifests: pyproject.toml (Python) and web/package.json + package-lock.json (JS, incl. three).")
    P(doc, "What is gitignored and must be regenerated after clone:", bold=True)
    bullet(doc, "Python venv (.venv/) and node_modules/ — reinstall (see section 8).")
    bullet(doc, "Training data (data/, *.parquet) and ML artifacts (artifacts/, *.pkl) — regenerate via `make train`.")
    P(doc, "Notes:", bold=True)
    bullet(doc, "Project is not yet a git repo; when you git init + add, ensure the binary 3-D assets under "
                "web/public/ are committed (they are not ignored, so a normal `git add` includes them).")
    bullet(doc, "Retraining is parallelized: train_rul/train_quality accept n_jobs (retrain_models.py uses "
                "5/3). On a many-core box (DGX) the full retrain is comfortably fast.")
    bullet(doc, "trimesh/pycollada (3-D conversion) and playwright (screenshots) are dev-only; not needed at "
                "runtime because the glb is already committed.")

    # ---------- How to run ----------
    H(doc, "8. How to run it", 1)
    code(doc,
         "python -m venv .venv && source .venv/bin/activate\n"
         "pip install -e \".[dev]\"                        # deps from pyproject.toml\n"
         "python scripts/generate_training_data.py        # synthetic cycles across machines\n"
         "python scripts/retrain_models.py                # writes artifacts/models/* (parallel)\n"
         "# build the frontend:\n"
         "cd web && npm install && npm run build && cd ..\n"
         "#   (3-D twin: VITE_ENABLE_3D=true npm run build)\n"
         "python run.py                                   # serves the app (default PORT 8000)\n"
         "#   open http://localhost:8000  — try fault buttons, watch RUL + quality react")

    # ---------- Constraints ----------
    H(doc, "9. Hard architectural rules (do not violate)", 1)
    P(doc, "These constraints protect model integrity or keep the prototype shippable on a single laptop:")
    bullet(doc, "Hidden component-health state is NEVER exposed to any model; models train only on observable signals.")
    bullet(doc, "RUL target columns (rul_*_cycles) are never used as features (enforced in both trainers).")
    bullet(doc, "RUL models use group-split-by-machine for validation — no cross-machine leakage.")
    bullet(doc, "src/ml/features.py must not import from src/simulator/* — enforced by an AST lint test.")
    bullet(doc, "Held-out [p10, p90] coverage must stay >= 70 % per component (calibration test).")
    P(doc, "Scope guardrails (deliberately out of scope): Docker/K8s, message brokers (MQTT/Kafka), "
           "TimescaleDB/MinIO/MLflow/Prefect, auth/JWT/RBAC, microservices, fleet view, RL, drift "
           "detection, and anything described as 'production-grade'. (Note: an optional decorative 3-D "
           "twin IS now included and license-cleared — see section 6.)")

    # ======================================================================
    #  Appended for the visual-polish + correctness iteration (V1–V5)
    # ======================================================================

    # ---------- Glossary ----------
    H(doc, "10. Glossary — plain English", 1)
    P(doc, "Every technical term on the dashboard, translated. Each entry: one technical "
           "sentence, one plain sentence, and one factory-floor analogy.")

    glossary_entry(doc, "RUL (Remaining Useful Life)",
        "The number of production cycles a component is predicted to survive before its true "
        "health crosses the failure threshold.",
        "How much life the part has left, counted in shots.",
        "Like an oil-life gauge in a car — but counting molded parts instead of miles.")
    glossary_entry(doc, "p10 / p50 / p90 quantile",
        "Three points on the predicted RUL distribution: the model estimates a 10 %, 50 %, and "
        "90 % chance the true RUL falls below each value.",
        "A pessimistic, a most-likely, and an optimistic estimate of remaining life.",
        "Like a forecast: 'most likely 50k more shots, but could be as few as 10k or as many as 90k.'")
    glossary_entry(doc, "Calibration",
        "Post-processing (CalibratedClassifierCV) that makes the model's reported probabilities "
        "match real-world frequencies, so a stated '70 %' really happens about 70 % of the time.",
        "Making the confidence numbers honest.",
        "If the card says '30 % chance of a bad part', roughly 3 of every 10 such shots really are bad.")
    glossary_entry(doc, "GroupKFold",
        "A cross-validation split that keeps all cycles from one machine entirely in either "
        "training or validation — never both.",
        "Testing the model on machines it has never seen, not just new shots from familiar machines.",
        "Proving the model works on a brand-new press, not only the few it learned on.")
    glossary_entry(doc, "Urgency band",
        "A bucket (critical / imminent / schedule / monitor) derived from days-until-replacement: "
        "<7, 7–30, 30–90, ≥90.",
        "A traffic-light label for how soon to act on a part.",
        "Red = order the part now; green = check again next month.")
    glossary_entry(doc, "Replacement date",
        "The calendar date the predicted p50 RUL runs out, computed as RUL cycles ÷ cycles-per-day.",
        "The day to put this part on the maintenance calendar.",
        "'Replace the hydraulic pump by June 5' — something a scheduler can act on.")
    glossary_entry(doc, "Failure threshold",
        "The health value (0.20) below which a component is considered failed; the machine then "
        "latches into a FAILED state.",
        "The point where the part is too worn to trust.",
        "Like a brake-pad wear line — past it, stop the press.")
    glossary_entry(doc, "Sweet spot",
        "The resale-optimal health window [0.35, 0.42] where replacing recovers the most residual "
        "and resale value.",
        "The best time to replace — not too early, not too late.",
        "Trade the press while it still has resale value, before it becomes scrap.")
    glossary_entry(doc, "Fault injection",
        "A demo control that ramps extra wear pressure into a component's hidden FSM to simulate a "
        "developing fault.",
        "A test button that fakes a part going bad.",
        "Like a trainer tripping a sensor to check the alarm catches it — for demonstration only.")
    glossary_entry(doc, "Digital twin",
        "A live software model of the machine driven by the same data stream — here a 2-D schematic, "
        "or an optional interactive 3-D model.",
        "A virtual copy of the machine that mirrors its current condition.",
        "A dashboard stand-in of your press that lights up where it hurts.")
    glossary_entry(doc, "Machine state",
        "A ground-truth status (running / warning / critical / failed) derived from the worst "
        "component's true health — distinct from the ML-predicted urgency band.",
        "The overall traffic-light for the whole press, right now.",
        "Green = making good parts; red FAILED = stopped, reset to continue.")

    # ---------- Reading the dashboard at a glance ----------
    H(doc, "11. Reading the dashboard at a glance", 1)
    img(doc, "dashboard_annotated.png", "The dashboard with numbered callouts (see below)")
    bullet(doc, "1  Machine-state badge — the overall press status at a glance (Running/Warning/Critical/Failed).")
    bullet(doc, "2  Live cycle counter — shots produced this run; returns to 0 after a Reset.")
    bullet(doc, "3  Connection indicator — green 'Live' means the data stream is healthy.")
    bullet(doc, "4  Component gauges — health % (large), days-to-replace, and urgency for each of the five parts.")
    bullet(doc, "5  RUL forecast band — predicted remaining life (cycles) of the worst part, with the red failure line.")
    bullet(doc, "6  Worst-component footer — which part to act on first, and its replace-by date or status.")
    bullet(doc, "7  Quality card — the predicted class (good / acceptable / waste) of the most recent shot.")
    bullet(doc, "8  Reset · Settings · Demo controls — reset to pristine, set cycles-per-day, or inject test faults.")

    P(doc, "What should I do? — the decision in four bullets:", bold=True)
    bullet(doc, "All gauges green (Monitor) → keep running; check again next month.")
    bullet(doc, "Any gauge amber or blue (Imminent / Schedule) → put that part on the maintenance calendar by its replace-by date.")
    bullet(doc, "Any gauge red (Critical) or OVERDUE → order the part now and plan a stop.")
    bullet(doc, "Banner reads FAILED → the press has stopped; replace the named part, then press Reset.")

    # ---------- Visual design system ----------
    H(doc, "12. Visual design system", 1)
    P(doc, "Dark-mode-only industrial palette, defined once as CSS variables in "
           "web/src/styles/tokens.css and mirrored into the shadcn theme.")
    palette_table(doc, [
        ("--color-bg",               "#0a0e16", "app background"),
        ("--color-surface",          "#121826", "cards / panels"),
        ("--color-surface-elevated", "#1b2433", "header, dialogs, hover"),
        ("--color-border",           "#263043", "hairline borders"),
        ("--color-text-primary",     "#e8edf4", "headings, key numbers"),
        ("--color-text-secondary",   "#9babc4", "body, labels"),
        ("--color-text-muted",       "#5f6e87", "captions, axis ticks"),
        ("--color-accent",           "#38bdf8", "interactive chrome, focus"),
        ("--color-success",          "#34d399", "healthy / good / monitor"),
        ("--color-warning",          "#fbbf24", "attention / acceptable"),
        ("--color-critical",         "#f4554e", "urgent / waste"),
        ("--color-failed",           "#8a7374", "STOPPED — distinct grey-red"),
    ])
    P(doc, "Typography:", bold=True)
    bullet(doc, "Inter (variable, self-hosted via Fontsource) for all UI text.")
    bullet(doc, "JetBrains Mono (variable) for every number — cycle counter, health %, RUL cycles, dates — with tabular figures so digits don't jitter.")
    bullet(doc, "Type scale only: text-xs 12 / sm 14 / base 16 / lg 18 / xl 20 / 2xl 24 / 3xl 30 — no arbitrary sizes.")
    P(doc, "Spacing & hierarchy:", bold=True)
    bullet(doc, "4 px spacing base; cards use a ~10 px corner radius and consistent internal padding.")
    bullet(doc, "The most important thing (machine state, worst component) is largest and highest; less important panels are smaller and lower.")
    bullet(doc, "Demo-only controls are collapsed and de-emphasized so a viewer never mistakes them for production features.")

    # ---------- Failure behavior ----------
    H(doc, "13. What happens when the machine fails", 1)
    P(doc, "The simulator exposes a single top-level machine_state, derived from the worst "
           "component's true (hidden) health and anchored on the existing health constants:")
    bullet(doc, "health > 0.42 → running")
    bullet(doc, "0.35 – 0.42 → warning (entering the resale sweet spot)")
    bullet(doc, "0.20 – 0.35 → critical (past the sweet spot, approaching failure)")
    bullet(doc, "≤ 0.20 → failed (latched)")
    P(doc, "The moment any component crosses 0.20 the machine latches into FAILED and stays there "
           "until Reset. While failed:")
    bullet(doc, "Degradation freezes — health is pinned at its crossed value and never goes below 0.0.")
    bullet(doc, "New cycles still stream, flagged failed=true in the snapshot.")
    bullet(doc, "Quality is forced to WASTE (a serving-layer presentation override; the ML model is untouched).")
    P(doc, "The UI then shows a red banner naming the failed component and the cycle at which it "
           "crossed, a FAILED status badge, and a distinct 'stopped' gauge (lock icon, desaturated "
           "grey-red ring, struck-through label) — so it reads as stopped, not merely bad.")
    img(doc, "state_failed.png", "Failed state — banner, FAILED badge, STOPPED gauge, quality forced to WASTE")
    P(doc, "Note the distinction: machine_state is ground truth from the simulator's hidden health, "
           "whereas a gauge's urgency band is the ML model's days-based forecast. They answer "
           "different questions — 'what condition is the press in now?' versus 'how soon should I "
           "plan to replace this part?'")

    # ---------- Replacement-date edge cases ----------
    H(doc, "14. Replacement-date edge cases", 1)
    P(doc, "Turning predicted cycles into calendar dates has three edge cases the UI handles "
           "explicitly so a date never looks broken:")
    bullet(doc, "Normal: a real date plus a day count (e.g. 'replace by 2026-06-05 · in 12 days').")
    bullet(doc, "Already due (days ≤ 0) or a failed component: shows OVERDUE with a distinct red "
                "style and no date — never 'replace on [yesterday]'.")
    bullet(doc, "Far out (days > 365): shows '> 1 year' instead of a literal multi-year date, which "
                "would be technically correct but unhelpful.")
    P(doc, "Underpinning guarantees (unit-tested): the backend clamps predicted p50 RUL to ≥ 0 and "
           "never emits a past date. At 4000 cycles/day, a fresh component with a 50,000-cycle p50 "
           "RUL resolves to roughly 12.5 days out (2026-06-05, 12 whole days) — verified by "
           "tests/test_urgency.py. A failed component's part is treated as OVERDUE.")

    # ---------- Demonstration guide ----------
    H(doc, "15. Demonstrating the prototype — the easy version", 1)
    P(doc, "In one sentence: this dashboard watches an injection-molding machine and tells you, "
           "component by component, how much life is left and exactly when to replace each part — "
           "early enough to avoid a breakdown, late enough not to throw away good life.")
    P(doc, "Run it:", bold=True)
    code(doc,
         "./demo.sh            # build if needed, then open http://localhost:8000\n"
         "./demo.sh --tunnel   # same, plus a temporary public https link (Cloudflare)")
    P(doc, "You don't need to memorise anything: hover any label, gauge, chart, or the small ⓘ "
           "icons and the UI explains — in plain English — what it means and what to do.", bold=True)
    P(doc, "A 60-second walkthrough:", bold=True)
    bullet(doc, "1. Open the dashboard. The top badge reads RUNNING and the five gauges are "
                "green/cyan — a healthy machine. Each gauge: the big number is health, the ring "
                "colour is how urgently to replace, the small number is days left.")
    bullet(doc, "2. Hover a gauge — it states the reading and the recommended action ('plenty of "
                "life left', 'replace now', …). Hover any ⓘ to learn how to read that whole panel.")
    bullet(doc, "3. Open 'Demo controls' (left), click 'Hydraulic Pump Wear', and drag 'Speed' up. "
                "This simulates a failing hydraulic pump.")
    bullet(doc, "4. Watch the story unfold live: the Hydraulic gauge falls, the status badge moves "
                "RUNNING → WARNING → CRITICAL, the RUL forecast line drops toward the red failure "
                "line, the process curves get noisy, and quality slides toward WASTE.")
    bullet(doc, "5. Let it cross the line: a red 'MACHINE FAILED' banner names the part and the exact "
                "cycle, and that gauge shows a STOPPED lock.")
    bullet(doc, "6. Click 'Reset' — everything returns to 100% health and you can run the story again.")
    P(doc, "That arc — healthy → predicted decline → failure → reset — is the entire value "
           "proposition in about a minute.")

    # ---------- Highlights ----------
    H(doc, "16. Highlights — why it stands out", 1)
    bullet(doc, "Per-component remaining-life predictions with honest uncertainty (p10/p50/p90) and "
                "calibrated quality probabilities — not a single black-box number.")
    bullet(doc, "Turns predictions into decisions: a calendar replacement date and a red/amber/cyan/"
                "green urgency band per component, plus a single 'worst component — act first' callout.")
    bullet(doc, "Leakage-proof by construction: the machine's hidden health is never a model input "
                "(enforced by an AST lint test), validation never splits one machine across train/test "
                "(GroupKFold), and prediction-interval coverage is gate-tested at ≥ 70%.")
    bullet(doc, "Live end-to-end: simulator → 49 engineered features → ML → dashboard over a "
                "WebSocket; inject a fault and the whole pipeline reacts within seconds.")
    bullet(doc, "Swap-to-real ready: one DataSource interface means the same app runs on the "
                "simulator or a real PLC by changing a single class.")
    bullet(doc, "Defined failure behaviour: the machine latches FAILED at the threshold, freezes, "
                "flags the cycle, and forces WASTE — with a one-click reset.")
    bullet(doc, "Self-teaching UI: every control, gauge and chart explains itself on hover; designed "
                "empty/loading/offline states; accessible keyboard focus.")
    bullet(doc, "Optional interactive 3-D twin, and a one-command demo that can publish a temporary "
                "public link via Cloudflare — clone, run, share.")

    # ---------- Future work ----------
    H(doc, "17. Future work", 1)
    bullet(doc, "Bind live component health to the 3-D model's meshes (requires the model re-authored "
                "with semantic node names) so the twin itself lights up where it hurts.")
    bullet(doc, "Connect a real machine through the PLC DataSource and validate predictions against "
                "real run-to-failure data.")
    bullet(doc, "Drift / anomaly detection and alerting — e.g. notify when P(waste) > 0.3 for N "
                "consecutive shots.")
    bullet(doc, "Cost-aware replacement policy: weigh residual life, downtime cost and resale value to "
                "recommend the optimal day, not just the urgency band.")
    bullet(doc, "Fleet view across many machines, backed by a historian/database for trends and audit.")
    bullet(doc, "Authentication and role-based access for a multi-user shop-floor deployment.")
    bullet(doc, "Continuous retraining / online learning as real operating data accumulates.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
