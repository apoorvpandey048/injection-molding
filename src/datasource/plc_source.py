"""PLCSource: stub implementation of DataSource for real PLC hardware."""
from __future__ import annotations

from typing import Iterator

from contracts.datasource import CycleOutput, DataSource

_MSG = (
    "PLCSource is not implemented. "
    "Connect a real PLC and implement this class following the DataSource ABC. "
    "See docs/REAL_DATA_SWAP.md for the integration guide."
)


class PLCSource(DataSource):
    @property
    def machine_id(self) -> str:
        raise NotImplementedError(_MSG)

    def stream(self) -> Iterator[CycleOutput]:
        raise NotImplementedError(_MSG)

    def inject_fault(self, fault: str, severity: float, onset_cycles: int) -> None:
        raise NotImplementedError(_MSG)

    def set_speedup(self, cycles_per_second: float) -> None:
        raise NotImplementedError(_MSG)
