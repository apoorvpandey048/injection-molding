You are the lead planner for a fast-track prototype build. Your job is to produce
TWO ARTIFACTS in this conversation, then stop:

1. IMPLEMENTATION_PLAN.md — a single markdown document, the source of truth
2. TASKS.md — a task tracker with status columns the agents update as they work

Then you produce three ready-to-paste KICKOFF PROMPTS, one per agent. Do not
write any code yourself. Do not start executing. Plan only.

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

We are building a portfolio-grade demo of a predictive maintenance + quality
monitoring system for plastic injection molding machines (IMMs). The audience is
a manufacturing buyer who will only share real data AFTER seeing a convincing
prototype. So:

- Everything in the prototype is synthetic
- The synthetic data must look and behave like real IMM data
- The system must be architected so real data can be plugged in later without
  rewriting the application

A separate notebook track is running in parallel on real public datasets
(NASA C-MAPSS, airtlab quality dataset). That work informs methodology but does
NOT block this prototype. Treat the notebook as a sibling project, not a
dependency.

═══════════════════════════════════════════════════════════════════════════════
WHAT THE DEMO MUST SHOW (the 60-second story)
═══════════════════════════════════════════════════════════════════════════════

1. A simulated IMM running continuously, displaying live process curves
   (cavity pressure, hydraulic pressure, etc.) and per-cycle scalars
   (cushion, peak pressure, cycle time, etc.)

2. Per-component health bars (hydraulic, screw/check-ring, heaters, drive,
   mold) updating each cycle

3. An RUL prediction for the most-degraded component, with a confidence band

4. A quality classifier predicting good / waste / acceptable per cycle

5. Three "Inject fault" buttons (check-ring wear, heater drift, hydraulic pump
   wear) that visibly cause symptoms within 30–100 cycles

6. A 2D twin diagram of the IMM with named regions that change color as the
   corresponding component's health drops

7. A "speedup" mode so 5,000 cycles play out in 60 seconds for demo recording

═══════════════════════════════════════════════════════════════════════════════
HARD ARCHITECTURAL CONSTRAINTS
═══════════════════════════════════════════════════════════════════════════════

* Real-data swap: All data must flow through a DataSource interface with two
  implementations: SimulatorDataSource (built now) and PLCDataSource (stub,
  raises NotImplementedError, documented). The frontend, ML, and twin layers
  must not know which is in use.

* Channel taxonomy: Use the locked channel set from Aslantas (2022) and
  Rousopoulou (2020) — cavity_pressure, hydraulic_injection_pressure,
  screw_position, cushion_min, hold_pressure_step_1..10, oil_temperature,
  barrel_zone_temp_1..6, clamp_force, etc. The INFRA agent authors the canonical
  channels.py from the literature.

* No leakage in ML: The simulator's hidden component-health state is NEVER
  exposed to any model. Models train only on observable signals. RUL models
  use group-split-by-machine for validation. This is a hard rule.

* 2D twin only for now: A polished SVG or Canvas side-view of an IMM with
  named regions. Defer 3D. Frontend agent designs the twin so a 3D glTF could
  swap in later with the same data-binding contract.

* Single command runs the demo: `make demo` or `python run.py`. No Docker
  required. SQLite or JSON files for storage. No message broker. No
  microservices.

* Three agents, parallel safe, file-level lane ownership.

═══════════════════════════════════════════════════════════════════════════════
EXPLICIT NON-GOALS
═══════════════════════════════════════════════════════════════════════════════

Do NOT include any of these in the plan. If an agent reaches for one, the plan
should explicitly forbid it:

- Docker, Kubernetes, docker-compose
- MQTT, Kafka, RabbitMQ, any message broker
- TimescaleDB, MinIO, MLflow, Prefect
- FastAPI auth, JWT, RBAC
- 3D models, glTF, Three.js, React Three Fiber
- Microservices (one process, maybe two — sim+web)
- Retraining pipelines, drift detection, shadow deployment
- Multi-machine fleet view
- Cost-aware policy optimization, reinforcement learning
- Anything described as "production-grade"

═══════════════════════════════════════════════════════════════════════════════
THE THREE AGENTS
═══════════════════════════════════════════════════════════════════════════════

LANE A — SIMULATOR + ML
  Mission: Synthetic IMM that emits realistic per-cycle curves and scalars
  with a hidden degradation FSM, plus two trained models (RUL regressor,
  quality classifier) using only observable signals.

  Owns: src/simulator/, src/ml/, src/datasource/, artifacts/models/,
        data/synthetic/, tests for those.

  Consumes from other lanes: channels.py (read-only from contracts/),
                              schemas (read-only from contracts/)

  Produces: SimulatorDataSource implementing the DataSource interface;
            two pickled models loadable by name; a script that regenerates
            training data and retrains both models deterministically.

LANE B — FRONTEND + 2D TWIN
  Mission: Single-page app showing live charts, health bars, RUL band,
  quality prediction, 2D twin, fault-injection buttons.

  Owns: web/, web/src/, web/public/, web/styles/

  Consumes: contracts/snapshot.schema.json (the JSON the backend pushes);
            contracts/fault_injection.schema.json (the buttons emit this)

  Produces: A working dashboard. Looks intentional — dark theme, considered
            typography, one accent color. Reads from a local JSON endpoint
            or WebSocket. Works against mock_snapshot.json from day one.

LANE C — INFRA + GLUE + DEMO
  Mission: Contracts, run scripts, the "fake live loop" connecting simulator
  to frontend, README, demo recording script, environment setup.

  Owns: contracts/, scripts/, docs/, README.md, pyproject.toml or
        requirements.txt, Makefile, .gitignore

  Consumes: nothing — INFRA defines the contracts the other lanes depend on,
            so INFRA must move first.

  Produces: All JSON schemas, channels.py, the runner script that loops the
            simulator and writes snapshot.json (or pushes via WebSocket), the
            README with a 5-line "what" and a 30-line "how to run", a written
            60-second demo script with timestamps, a 30-second elevator
            paragraph.

═══════════════════════════════════════════════════════════════════════════════
YOUR DELIVERABLES (THIS CONVERSATION)
═══════════════════════════════════════════════════════════════════════════════

Produce these as separate, clearly delimited markdown artifacts:

────────────────────────────────────────────────────────────────────────────
ARTIFACT 1 — IMPLEMENTATION_PLAN.md
────────────────────────────────────────────────────────────────────────────

Structure:

  ## 1. One-paragraph project summary
  ## 2. Architecture diagram (ASCII) — show DataSource abstraction explicitly
  ## 3. Repo layout — every directory, who owns it
  ## 4. The shared contracts
       - channels.py contents (full list of channel names with units)
       - snapshot.schema.json (what frontend consumes per tick)
       - cycle_output.schema.json (what simulator emits per cycle)
       - fault_injection.schema.json (what buttons emit)
       - datasource.py interface definition
  ## 5. Lane A (Simulator+ML) detailed plan
       - Files to create, in build order
       - The degradation FSM design (components, curves, symptom maps)
       - The two models: what they predict, what features they use, how
         they're trained, how leakage is avoided
       - Tests required
       - "Done" criteria, concrete and checkable
  ## 6. Lane B (Frontend+Twin) detailed plan
       - Tech stack recommendation (recommend the simplest credible option —
         lean toward Vite + vanilla TS or React, not Next.js)
       - Layout sketch
       - 2D twin design — which components are visible, how they bind to
         health values, swap-to-3D contract
       - Tests / visual QA approach
       - "Done" criteria
  ## 7. Lane C (Infra+Glue+Demo) detailed plan
       - Contracts to author first
       - Glue runner architecture
       - Demo script (the actual 60-second narration)
       - README outline
       - "Done" criteria
  ## 8. Execution timeline (hours, not weeks)
       - Hour 0–2: INFRA publishes contracts, others read
       - Hour 2–6: parallel build
       - Hour 6–8: first integration (smoke moment)
       - Hour 8+: polish
       Be specific. If something will take 30 minutes, say 30 minutes.
  ## 9. The "first smoke moment" — define it precisely
       What's the earliest point where simulator data appears in the
       frontend UI, even with most things stubbed? Front-load this.
  ## 10. Stubs and assumptions
       Every place where one lane stubs another lane's output until it
       exists. Each stub has a kill-by date (when it must be replaced).
  ## 11. Risk register (5 items max)
       Specific to this build, not generic project risks.
  ## 12. What changes when real data arrives
       Specific list: what code changes, what stays the same.

────────────────────────────────────────────────────────────────────────────
ARTIFACT 2 — TASKS.md
────────────────────────────────────────────────────────────────────────────

A markdown task tracker with this structure:

  # Task Tracker

  Legend: 🔲 todo · 🟡 in-progress · ✅ done · ⛔ blocked

  ## Lane A — Simulator + ML
  | ID | Task | Status | Owner | Notes |
  |----|------|--------|-------|-------|
  | A1 | ... | 🔲 | sim-agent | |
  ...

  ## Lane B — Frontend + Twin
  ...

  ## Lane C — Infra + Glue + Demo
  ...

  ## Cross-lane integration points
  | ID | What | Lanes | Status |
  |----|------|-------|--------|
  | X1 | Contracts published, A and B unblocked | C → A,B | 🔲 |
  | X2 | First snapshot.json reaches frontend | A,C → B | 🔲 |
  | X3 | Fault button triggers visible symptom in <30 cycles | B → A → B | 🔲 |
  | X4 | Models trained and integrated | A | 🔲 |
  | X5 | Full demo recording captured | C | 🔲 |

  ## Update protocol
  Agents update their own rows only. Status changes go through a commit:
    git commit -m "[LANE-X] task A3 → 🟡 in-progress"
  When marking ✅, append a one-line note about what shipped.

Generate roughly 8–15 tasks per lane. Number them A1, A2, B1, B2, C1, C2 so
they're easy to reference.

────────────────────────────────────────────────────────────────────────────
ARTIFACT 3 — THREE KICKOFF PROMPTS
────────────────────────────────────────────────────────────────────────────

One per agent. Each must be:
  - Self-contained (the agent will paste it into a fresh chat)
  - Reference the IMPLEMENTATION_PLAN.md and TASKS.md by name
  - Specify exact lane ownership and forbidden directories
  - State the "no model layer without observable-signal discipline" rule
    (Lane A specifically)
  - State the "no 3D, no Docker, no broker" rule (all lanes)
  - List the agent's first three concrete tasks from TASKS.md
  - End with: "State back to me your understanding of your lane, the three
    tasks you're starting, and any stub you'll need. Then begin."

Delimit each kickoff prompt clearly so I can copy them cleanly.

═══════════════════════════════════════════════════════════════════════════════
QUALITY BAR
═══════════════════════════════════════════════════════════════════════════════

Your plan will be judged on:

1. Could three agents pick this up and not collide? (clear lane boundaries)
2. Is the "first smoke moment" reachable in under 6 hours of total work?
3. Can the demo be recorded within 24 hours of execution start?
4. Does the architecture genuinely support real-data swap, or is that lip
   service?
5. Is the ML setup leakage-free, or is it secretly cheating?
6. Are non-goals explicit enough that an over-eager agent won't drift?
7. Is every claim in the demo defensible to a domain expert?

If you find yourself adding complexity to look thorough, cut it. The user has
already had this project over-scoped twice. Lean toward less.

Now produce ARTIFACT 1, then ARTIFACT 2, then ARTIFACT 3. Stop after the
three artifacts. Do not begin execution.