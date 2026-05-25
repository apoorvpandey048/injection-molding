"""Simulator entrypoint."""
from __future__ import annotations

import argparse
import asyncio
import logging
import os

from imm_common.mqtt import mqtt_client

from .config import MachineConfig
from .publisher import run_machine


async def _amain(args: argparse.Namespace) -> None:
    cfg = MachineConfig(machine_id=args.machine_id, rng_seed=args.seed)
    host = os.environ.get("MQTT_HOST", "localhost")
    port = int(os.environ.get("MQTT_PORT", "1883"))
    user = os.environ.get("MQTT_USER") or None
    pw = os.environ.get("MQTT_PASSWORD") or None
    logging.info("connecting to MQTT %s:%s as machine=%s", host, port, cfg.machine_id)
    async with mqtt_client(host=host, port=port, username=user, password=pw) as client:
        await run_machine(client, cfg, n_cycles=args.cycles, real_time=not args.fast)


def cli() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="IMM healthy-baseline simulator (M2)")
    p.add_argument("--machine-id", default="imm-01")
    p.add_argument("--cycles", type=int, default=None, help="default: run forever")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--fast", action="store_true", help="publish as fast as possible (no real-time pacing)")
    args = p.parse_args()
    asyncio.run(_amain(args))


if __name__ == "__main__":
    cli()
