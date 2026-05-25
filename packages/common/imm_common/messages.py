"""Pydantic v2 message schemas for the MQTT bus and the REST/WS surface.

All inter-service messages are validated against these models. Schema changes
require a version bump and migration of consumers (see docs/adr/).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# Topic conventions:
#   imm/<machine_id>/raw     -> RawSamplePacket (high frequency)
#   imm/<machine_id>/cycle   -> CycleEvent (per cycle)
#   imm/<machine_id>/feat    -> FeatureEvent (per cycle, after FE)
#   imm/<machine_id>/pred    -> PredictionEvent (anomaly|quality|health|rul)
#   imm/<machine_id>/alert   -> AlertEvent
#   imm/<machine_id>/health  -> GroundTruthHealth (admin/eval only)


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class RawSamplePacket(_Base):
    """A burst of raw samples for one or more channels from one machine.

    Batched to keep MQTT message rate sane: ~10 packets/s/machine each
    carrying ~10-100 samples per channel.
    """

    schema_version: Literal[1] = 1
    machine_id: str
    t_start: datetime
    t_end: datetime
    sample_rate_hz: float
    # channel -> list of values aligned to t_start..t_end
    channels: dict[str, list[float]]


class CyclePhase(_Base):
    name: Literal["clamp_close", "injection", "pack", "cool", "plasticize", "clamp_open", "ejection"]
    t_start: datetime
    t_end: datetime


class CycleEvent(_Base):
    """Emitted by the telemetry service when it detects a cycle boundary."""

    schema_version: Literal[1] = 1
    machine_id: str
    cycle_id: int
    t_start: datetime
    t_end: datetime
    phases: list[CyclePhase]
    setpoints: dict[str, float] = Field(default_factory=dict)
    scalars: dict[str, float] = Field(default_factory=dict)
    curves_blob_uri: str | None = None  # MinIO URI to Parquet of intra-cycle curves


class FeatureEvent(_Base):
    """Emitted by the feature service once features are computed."""

    schema_version: Literal[1] = 1
    machine_id: str
    cycle_id: int
    t_end: datetime
    features: dict[str, float]


PredictionKind = Literal["anomaly", "quality", "health", "rul"]


class PredictionEvent(_Base):
    schema_version: Literal[1] = 1
    machine_id: str
    cycle_id: int | None
    t: datetime
    kind: PredictionKind
    component: str | None = None
    payload: dict[str, Any]
    model_name: str
    model_version: str


AlertSeverity = Literal["info", "warning", "critical"]


class AlertEvent(_Base):
    schema_version: Literal[1] = 1
    id: str
    machine_id: str
    component: str | None = None
    severity: AlertSeverity
    kind: str
    opened_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class GroundTruthHealth(_Base):
    """Simulator-only: true hidden health vector for offline evaluation."""

    schema_version: Literal[1] = 1
    machine_id: str
    cycle_id: int
    t: datetime
    health: dict[str, float]   # component -> [0, 1]
    rul_cycles: dict[str, int] # component -> cycles to threshold crossing


# ---------------------------------------------------------------------------
# WebSocket snapshot (server -> browser) at ~2 Hz
# ---------------------------------------------------------------------------
class RulBand(_Base):
    p10: int
    p50: int
    p90: int
    unit: Literal["cycles", "hours"] = "cycles"


class TwinSnapshot(_Base):
    schema_version: Literal[1] = 1
    machine_id: str
    ts: datetime
    state: Literal["idle", "running", "alarm", "stopped"]
    current_cycle: int
    live: dict[str, float]                 # latest scalar tile values
    health: dict[str, float]               # component -> [0,1]
    rul: dict[str, RulBand]                # component -> band
    alerts: list[AlertEvent] = Field(default_factory=list)


__all__ = [
    "AlertEvent",
    "AlertSeverity",
    "CycleEvent",
    "CyclePhase",
    "FeatureEvent",
    "GroundTruthHealth",
    "PredictionEvent",
    "PredictionKind",
    "RawSamplePacket",
    "RulBand",
    "TwinSnapshot",
]
