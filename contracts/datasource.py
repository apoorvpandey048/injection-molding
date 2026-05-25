from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Iterator

CycleOutput = Dict[str, Any]


class DataSource(ABC):
    """Abstraction over data origin. Sim today, PLC tomorrow."""

    @abstractmethod
    def stream(self) -> Iterator[CycleOutput]:
        """Yield one CycleOutput per cycle, forever, ordered by cycle_index."""

    @abstractmethod
    def inject_fault(self, fault: str, severity: float, onset_cycles: int) -> None:
        """Inject a named fault. May raise NotImplementedError on real PLC implementations."""

    @abstractmethod
    def set_speedup(self, cycles_per_second: float) -> None:
        """Demo-only speed knob. PLC implementation raises NotImplementedError."""

    @property
    @abstractmethod
    def machine_id(self) -> str: ...
