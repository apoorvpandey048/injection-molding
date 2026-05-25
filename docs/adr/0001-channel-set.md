# ADR-0001 — Locked sensor channel taxonomy

**Status**: accepted
**Date**: 2026-05-16
**Deciders**: project lead
**Supersedes**: —

## Context

The IMM platform consumes telemetry from a simulator today and (eventually)
real injection-molding machines. The channel set is the contract between the
simulator, the ingestion service, the feature library, every ML model, the
database schema, and the dashboard. A drift in channel names or tiers
across services breaks the entire pipeline silently. We need a single source
of truth.

Two papers in `research-papers/` give us the most explicit IMM tag
inventories:

- **Aslantas et al. (2022), JAIDA** — Vestel deployment. Names tags such as
  `HOLD_PRESS_STEP_1..10`, `HYDR_HOLD_PRESS`, `OIL_TEMPERATURE`,
  `ZUx-actual` (cycle time), `ZSx-actual` (injection time),
  `CPx` (cushion), `Skx` (closing force).
- **Rousopoulou et al. (2020), Frontiers in AI** — CERTH/CERTH-ITI on a
  large electronics manufacturer's shop floor. Names six barrel-temperature
  zones, switchover pressure, plasticizing position, clamp force, mold
  protection time, oil temperature.

Two further papers supply intra-cycle curve channels:

- **Nagorny et al. (2017), CIVEMSA** — 100 Hz acquisition of cavity
  pressure, cavity temperature, hydraulic injection pressure, screw
  position; thermography frame 25 s after eject.
- **Michiels et al. (2022), arXiv** — Moldflow simulation of cavity P,
  cavity T, ram position.

## Decision

The canonical channel set is the **union** of those four tag inventories,
implemented in `packages/common/imm_common/channels.py` as the
`Channel` enum plus four tier dictionaries
(`TIER_A_CURVES`, `TIER_B_SLOW`, `TIER_C_SCALARS`, `TIER_D_CONTEXT`).

### A. Tiers (sample-rate classes)

| Tier | Rate | Examples |
|------|------|----------|
| A    | 100–1000 Hz | cavity_pressure_1, hydraulic_injection_pressure, screw_position |
| B    | 1–10 Hz     | barrel_zone_temp_1..6, oil_temperature, motor_current, vibrations |
| C    | per cycle   | cycle_time_actual, hold_pressure_step_1..10, clamp_force_actual |
| D    | per shift   | material_lot_id, mold_id, ambient_temp |

### B. The hold profile is a 10-step vector, not a scalar

Aslantas et al. store `HOLD_PRESS_STEP_1..10`. Modern IMMs program a staged
hold profile (piecewise constant). The simulator must support a
programmable 10-step profile from day 1. Feature engineering must treat
these as a vector (per-step mean delivered, per-step deviation from
setpoint). Drift in **step 3** is a known leading indicator of check-ring
wear (early steps see the worst backflow), seeded into the simulator's
symptom map.

### C. Component → leading-channel hints

`COMPONENT_LEADING_CHANNELS` in `channels.py` records, for each component
kind (hydraulic, screw, mold, heater, motor, clamp), the channels most
correlated with its degradation. Used by:

- the rules engine (M11) to cite the root-cause category in alerts,
- the feature → task mapping (`docs/plan.md` §5.3),
- model evaluation (per-component head trained against the hinted channels).

### D. Naming conventions

- snake_case, lowercase, ASCII only.
- Suffix numbered sensors with `_1`, `_2`, … (not `_a`, `_b`).
- SI units in the docstring of each entry (`[K]`, `[bar]`, `[mm/s]`, `[A]`, `[kN]`).
- Setpoint vs actual: use `_set` and `_actual` suffixes (matches Aslantas).

## Consequences

- The DB schema (`infra/timescale/migrations/0001_init.sql`) stores
  per-cycle scalars in a JSONB `scalars` column keyed by the tag names
  above, *not* as columns. This keeps Tier-C extensions cheap.
- The simulator's first deliverable (M2) emits this exact tag set.
  Tier-A curves shipped via `RawSamplePacket` batched per channel;
  Tier-C scalars shipped attached to the `CycleEvent`.
- Any future channel addition requires a follow-up ADR (`0002-…`) that
  cites either a paper or a real-machine source, plus a schema migration.
- The locked set deliberately omits thermographic frames (Nagorny). They
  are listed in the future-work section of `docs/plan.md` §A2; reintroduce
  via ADR-0002 once the simulator emits a synthetic thermal field.

## Alternatives considered

1. **Free-form tag names per service** — rejected: guarantees drift.
2. **OPC UA / Sparkplug B namespace mapping** — premature for MVP;
   defer until a real PLC integration ADR (`0010-…`) is written.
3. **Wide DB column for every Tier-C scalar** — rejected: Tier-C set grows
   per real-machine integration; JSONB + a Pydantic-validated event keeps
   migrations cheap and contracts strong.
