"""Async TimescaleDB client wrapper (asyncpg-based)."""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg


def dsn_from_env() -> str:
    return (
        f"postgresql://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
        f"@{os.environ.get('PGHOST', 'localhost')}:{os.environ.get('PGPORT', '5432')}"
        f"/{os.environ['PGDATABASE']}"
    )


@asynccontextmanager
async def pool(dsn: str | None = None, min_size: int = 2, max_size: int = 10) -> AsyncIterator[asyncpg.Pool]:
    p = await asyncpg.create_pool(dsn or dsn_from_env(), min_size=min_size, max_size=max_size)
    assert p is not None
    try:
        yield p
    finally:
        await p.close()
