"""Pure functions: cycles → replacement date + urgency band."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal

Urgency = Literal["critical", "imminent", "schedule", "monitor"]


def cycles_to_date(cycles: float, cycles_per_day: float, now: datetime) -> date:
    """Convert remaining cycles to a calendar replacement date.

    cycles_per_day must be positive. now is treated as the reference instant; the
    return value is the date `cycles / cycles_per_day` days into the future,
    rounded down (floor) to the nearest whole day.
    """
    if cycles_per_day <= 0:
        raise ValueError(f"cycles_per_day must be > 0, got {cycles_per_day!r}")
    days = max(0.0, float(cycles) / float(cycles_per_day))
    return (now + timedelta(days=days)).date()


def classify(days: float) -> Urgency:
    """Map days-until-replacement to an urgency band.

    Bands (lower-inclusive, upper-exclusive):
        days <  7  → critical
        7  ≤ d <30 → imminent
        30 ≤ d <90 → schedule
        d  ≥ 90    → monitor
    """
    if days < 7:
        return "critical"
    if days < 30:
        return "imminent"
    if days < 90:
        return "schedule"
    return "monitor"


def days_until(target: date, now: datetime) -> float:
    """Whole-day delta between now and target. Negative if target is past."""
    return (target - now.date()).days
