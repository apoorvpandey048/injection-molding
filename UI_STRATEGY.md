# UI_STRATEGY — IMM Digital Twin Platform

> Objective (from the brief): *"Professional industrial software"* — comparable to
> Siemens / Bosch / Schneider / Rockwell / GE Digital / ABB / PTC ThingWorx.
> **Not** a student dashboard. Information density, clarity, professionalism,
> readability. The platform must **explain itself**.

---

## 1. Layout: Command Center

Three candidate layouts were considered (Split View, Twin Focus, Command Center).
**Chosen: Command Center.** It is the industry-standard SCADA / digital-twin shell
and best satisfies "the viewer should occupy a major portion of the screen" while
keeping live KPIs and the active-context detail panel always visible.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ APP BAR  ◆ IMM Digital Twin · SIM-001     [Operations|Inspection]   ●Live  ⚙ │
├──────────┬──────────────────────────────────────────────┬────────────────────┤
│ SUBSYSTEM│                                              │  CONTEXT PANEL      │
│  RAIL    │                                              │  (active subsystem) │
│          │                                              │                     │
│ ◧ Hydrau │            DIGITAL TWIN VIEWER               │  Health  92%  ▲     │
│ ◧ Screw  │            (hero — model.dae, R3F)           │  RUL     128 d      │
│ ◧ Drive  │            orbit · pan · zoom                │  Status  Running    │
│ ◧ Heater │            health-tinted meshes              │  Fail P  3%         │
│ ◧ Mold   │            click subsystem → focus           │  Recommendation …   │
│          │                                              │  ── Sensor summary  │
│ overall  │                                              │  ── Forecast chart  │
│ health   │   [fit] [reset] [focus] [⤢ isolate]          │  ── Trend           │
├──────────┴──────────────────────────────────────────────┴────────────────────┤
│ STATUS BAR   cycle #12,480 · ● connected · worst: Hydraulic 128 d · 3 alerts  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Viewer is the hero**: it fills the entire center column (≈60–65 % width at
  1080p, more at 1440p+). Compare the old dashboard where the twin was a 288 px
  thumbnail in a 320 px sidebar.
- **Subsystem Rail** (left, ~220 px): five subsystems as color-coded, health-aware
  list items + an overall-health summary. Hover = highlight in 3D; click = select
  + cinematic focus.
- **Context Panel** (right, ~360 px): the *active context*. Everything here is the
  selected subsystem's live data. With nothing selected it shows the
  machine-overview rollup.
- **Status Bar** (bottom): cycle counter, connection, worst component, alert count,
  build/version. Always-on situational awareness.
- **Inspection mode** swaps the rail+panel for the workbench's Hierarchy /
  Inspector / Mapping-editor without leaving the page or losing camera state.

Responsive (as shipped, D-14): **desktop-optimised**. The rail and context panel
use fluid Tailwind-breakpoint widths (rail 208→248 px, panel 348→404 px from
1280 px → 1920 px+), keeping the 3-D viewer the dominant column (≥55 %) from
1280 px up. A "Viewing · <subsystem>" badge on the viewer keeps the user oriented
after a camera focus. There is no phone/tablet reflow — industrial monitoring is a
desktop / large-display use case.

---

## 2. Visual language

Dark, single-theme industrial palette (extends the existing
[`tokens.css`](web/src/styles/tokens.css)). Deep slate-blue surfaces, hairline
borders, restrained accents. The five subsystem hues are the only saturated
colors in chrome, so a lit subsystem reads instantly.

| Token | Value | Use |
|-------|-------|-----|
| bg / surface / elevated | `#0a0e16` / `#121826` / `#1b2433` | app / panels / raised |
| border | `#263043` | hairlines |
| text primary/secondary/muted | `#e8edf4` / `#9babc4` / `#5f6e87` | hierarchy |
| accent | `#38bdf8` | focus, primary action |
| success/warning/critical/failed | `#34d399` / `#fbbf24` / `#f4554e` / `#8a7374` | status |

**Health color scale** (continuous, for mesh tint + gauges):
`#34d399` (≥0.7) → `#fbbf24` (≈0.45) → `#f4554e` (≤0.25) → `#8a7374` (failed).

Typography: Inter Variable (UI) + JetBrains Mono (all numbers — tabular, so
values don't jitter as they stream). Both already vendored.

Motion: purposeful only. Camera transitions (understanding *where* a subsystem
is), value transitions (smooth number changes), highlight fades. **No** decorative
loops, no auto-rotate carousel, no gaming bloom. (The old auto-rotate is removed.)

Density: SCADA-grade. Compact rows, 12–13 px labels, mono numerics, generous use
of small-caps section headers. Every pixel earns its place.

---

## 3. The self-explaining platform ("intelligent tooltips")

This is a **first-class requirement**, not a polish item. The platform answers
three questions for *anything* the user hovers:

> **What am I seeing?**  ·  **Is it good or bad?**  ·  **What should I do?**

### Tooltip taxonomy

| Surface | What the tooltip explains |
|---------|---------------------------|
| **Health score** | meaning of the number, why it's high/low, expected behavior, interpretation band |
| **RUL / replacement date** | what RUL means, p10–p90 spread, how the date is derived, urgency meaning |
| **Graph point (crosshair)** | exact value, timestamp/cycle, local trend, normal/warning/critical band, risk reading |
| **Sensor reading** | current value, normal range, warning range, critical range, operational meaning |
| **Subsystem** | what the subsystem does, which sensors feed it, common failure modes |
| **Machine state / alert** | what triggered it, severity, recommended action |
| **Every control** | what it does, and that demo controls are *not* real machine controls |

### Mechanism

Built on the existing radix `Tooltip` + the `InfoHint` / `Hint` pattern, promoted
into a small **explain system** (`ui/explain/`):

- `<Explain>` — hover wrapper for any element; renders a structured popover with
  **What / Reading / Action** rows.
- `<MetricExplain>` — for numeric KPIs; auto-builds the interpretation from the
  value + its threshold band (so the text is always *true to the current value*,
  e.g. "92 % — healthy, no action" vs "31 % — below maintenance window, schedule
  replacement").
- Chart crosshair tooltips are generated from the same threshold model, so a
  point's tooltip says which band it's in and what that implies.

The explanation text is **data-derived where possible** (computed from value +
threshold), with static copy only for definitions. A non-technical reviewer can
read any panel and understand it without training.

---

## 4. Graph system (enterprise-grade)

Every chart (Recharts) gets the same enterprise toolkit:

- **Crosshair + hover values** synced to the cursor.
- **Threshold overlays**: shaded normal / warning / critical regions
  (`ReferenceArea`) drawn from the channel's threshold model.
- **Forecast region**: the predicted continuation (p50 line, p10–p90 band) drawn
  past "now" with a distinct hatch so future ≠ past.
- **Predicted-failure marker**: a `ReferenceLine` + flag where the forecast crosses
  the failure threshold, labeled with the cycle/date.
- **Contextual explanation**: an `<Explain>` on the chart title and on every
  hovered point.

Charts: **RUL Forecast Band** (per subsystem), **Sensor Curve** (per channel, with
bands), **Health Trend** (per subsystem, history buffer), **Quality** bar.

---

## 5. Interaction model

| Action | Result |
|--------|--------|
| Hover subsystem (rail or 3D) | that subsystem's meshes brighten, others dim; tooltip |
| Click subsystem | select → cinematic camera focus → Context Panel becomes that subsystem |
| Click empty space | deselect → Context Panel returns to machine overview |
| `fit` / `reset` / `focus` | camera commands (toolbar + keyboard F/R) |
| Mode = Inspection | mesh-level pick, hierarchy, isolate (I), wireframe/x-ray, search, mapping editor |
| Inject fault / speed (demo) | clearly fenced "Demonstration" controls, labeled not-real |

State that matters (selected subsystem, camera pose, mode, mapping) is **persistent**
across reloads and **shareable** via URL for collaborative review.

---

## 6. Accessibility & polish

- Keyboard: subsystem hotkeys (1–5), F focus, I isolate, Esc clear, Tab order
  through panels.
- All color cues backed by text/label (color-blind safe — never color-only).
- `cursor-help` on every explainable element; focus-visible rings on controls.
- Loading: skeletons, not spinners; the viewer shows a framed-model placeholder.
- Empty/disconnected states are explicit and reassuring ("reconnecting…").

---

## 7. What we explicitly avoid

- Consumer dashboard tropes (giant single donut, emoji, confetti).
- Gaming aesthetics (bloom, lens flare, perpetual auto-rotate).
- Animation for its own sake.
- Hiding meaning behind jargon — every acronym (RUL, p50) is explained on hover.
