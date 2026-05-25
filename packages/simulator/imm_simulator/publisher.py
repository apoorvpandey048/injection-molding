"""Async MQTT publisher — streams simulator cycles to the bus in (near) real time."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import aiomqtt
import numpy as np

from imm_common.messages import CycleEvent, CyclePhase, RawSamplePacket
from imm_common.mqtt import publish_model, topic_cycle, topic_raw

from .config import MachineConfig
from .process_model import CycleOutput, simulate_cycle

log = logging.getLogger("imm_simulator.publisher")


def _build_phase_list(c: CycleOutput) -> list[CyclePhase]:
    p = c.phases
    base = c.t_start
    def at(s: float) -> datetime:
        return base + timedelta(seconds=s)
    return [
        CyclePhase(name="clamp_close", t_start=base, t_end=at(p.t_clamp_close_end)),
        CyclePhase(name="injection",   t_start=at(p.t_clamp_close_end), t_end=at(p.t_inj_end)),
        CyclePhase(name="pack",        t_start=at(p.t_inj_end),         t_end=at(p.t_pack_end)),
        CyclePhase(name="cool",        t_start=at(p.t_pack_end),        t_end=at(p.t_cool_end)),
        CyclePhase(name="plasticize",  t_start=at(p.t_cool_end),        t_end=at(p.t_plasticize_end)),
        CyclePhase(name="clamp_open",  t_start=at(p.t_plasticize_end),  t_end=at(p.t_clamp_open_end)),
        CyclePhase(name="ejection",    t_start=at(p.t_clamp_open_end),  t_end=at(p.t_eject_end)),
    ]


async def publish_cycle(
    client: aiomqtt.Client,
    cfg: MachineConfig,
    cyc: CycleOutput,
    real_time: bool = True,
) -> None:
    """Stream one cycle's raw data in packets of `packet_rate_hz`, then publish
    the CycleEvent at cycle end."""
    samples_per_packet = max(1, int(round(cfg.sample_rate_hz_tier_a / cfg.packet_rate_hz)))
    packet_period = samples_per_packet / cfg.sample_rate_hz_tier_a

    # Slice the long arrays into per-packet chunks
    n_total = next(iter(cyc.streams.values())).shape[0]
    n_packets = n_total // samples_per_packet
    raw_topic = topic_raw(cfg.machine_id)

    loop_start = asyncio.get_event_loop().time()
    for pkt_idx in range(n_packets):
        lo = pkt_idx * samples_per_packet
        hi = lo + samples_per_packet
        pkt_t_start = cyc.t_start + timedelta(seconds=lo / cfg.sample_rate_hz_tier_a)
        pkt_t_end   = cyc.t_start + timedelta(seconds=hi / cfg.sample_rate_hz_tier_a)
        chunk = {
            name: arr[lo:hi].astype(float).tolist() for name, arr in cyc.streams.items()
        }
        pkt = RawSamplePacket(
            machine_id=cfg.machine_id,
            t_start=pkt_t_start,
            t_end=pkt_t_end,
            sample_rate_hz=cfg.sample_rate_hz_tier_a,
            channels=chunk,
        )
        await publish_model(client, raw_topic, pkt, qos=1)
        if real_time:
            target = loop_start + (pkt_idx + 1) * packet_period
            now = asyncio.get_event_loop().time()
            if target > now:
                await asyncio.sleep(target - now)

    # End-of-cycle event (telemetry svc will also derive scalars from raw in M3;
    # this is the authoritative simulator-side announcement).
    ev = CycleEvent(
        machine_id=cfg.machine_id,
        cycle_id=cyc.cycle_id,
        t_start=cyc.t_start,
        t_end=cyc.t_end,
        phases=_build_phase_list(cyc),
        setpoints={
            "melt_temp_k": cfg.setpoints.melt_temp_k,
            "packing_pressure_bar": cfg.setpoints.packing_pressure_bar,
            "cooling_water_temp_k": cfg.setpoints.cooling_water_temp_k,
            "clamp_force_kn": cfg.setpoints.clamp_force_kn,
        },
        scalars=cyc.scalars,
    )
    await publish_model(client, topic_cycle(cfg.machine_id), ev, qos=1)
    log.info("published cycle %d (machine=%s)", cyc.cycle_id, cfg.machine_id)


async def run_machine(
    client: aiomqtt.Client,
    cfg: MachineConfig,
    n_cycles: int | None = None,
    real_time: bool = True,
) -> None:
    rng = np.random.default_rng(cfg.rng_seed)
    cycle_id = 0
    t = datetime.now(timezone.utc)
    while n_cycles is None or cycle_id < n_cycles:
        cyc = simulate_cycle(cfg, cycle_id, t, rng)
        await publish_cycle(client, cfg, cyc, real_time=real_time)
        cycle_id += 1
        t = cyc.t_end
