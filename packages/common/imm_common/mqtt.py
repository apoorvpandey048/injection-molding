"""MQTT topic helpers and async client wrapper."""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import aiomqtt
from pydantic import BaseModel


def topic_raw(machine_id: str) -> str:
    return f"imm/{machine_id}/raw"


def topic_cycle(machine_id: str) -> str:
    return f"imm/{machine_id}/cycle"


def topic_feat(machine_id: str) -> str:
    return f"imm/{machine_id}/feat"


def topic_pred(machine_id: str) -> str:
    return f"imm/{machine_id}/pred"


def topic_alert(machine_id: str) -> str:
    return f"imm/{machine_id}/alert"


def topic_ground_truth(machine_id: str) -> str:
    return f"imm/{machine_id}/health"


@asynccontextmanager
async def mqtt_client(
    host: str, port: int = 1883, username: str | None = None, password: str | None = None
) -> AsyncIterator[aiomqtt.Client]:
    async with aiomqtt.Client(hostname=host, port=port, username=username, password=password) as c:
        yield c


async def publish_model(client: aiomqtt.Client, topic: str, model: BaseModel, qos: int = 1) -> None:
    await client.publish(topic, payload=model.model_dump_json().encode("utf-8"), qos=qos)


async def publish_json(client: aiomqtt.Client, topic: str, payload: dict[str, Any], qos: int = 1) -> None:
    import json
    await client.publish(topic, payload=json.dumps(payload).encode("utf-8"), qos=qos)
