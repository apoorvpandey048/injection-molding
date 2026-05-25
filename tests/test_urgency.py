"""P2.2 — unit tests for src/ml/urgency.py."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ml.urgency import classify, cycles_to_date, days_until


NOW = datetime(2026, 5, 24, 12, 0, 0, tzinfo=timezone.utc)


def test_cycles_to_date_exact_day_math():
    # 4000 cycles/day, 8000 cycles → +2 days
    assert cycles_to_date(8000, 4000, NOW).isoformat() == "2026-05-26"


def test_cycles_to_date_fractional_day_via_timestamp_arith():
    # 6000 / 4000 = 1.5 days; NOW is noon → +36h → midnight on 2026-05-26
    assert cycles_to_date(6000, 4000, NOW).isoformat() == "2026-05-26"


def test_cycles_to_date_fractional_day_from_midnight():
    midnight = datetime(2026, 5, 24, 0, 0, 0, tzinfo=timezone.utc)
    # 1.5 days from midnight = 36h → 2026-05-25 noon → date is 2026-05-25
    assert cycles_to_date(6000, 4000, midnight).isoformat() == "2026-05-25"


def test_cycles_to_date_zero_cycles_is_today():
    assert cycles_to_date(0, 4000, NOW).isoformat() == "2026-05-24"


def test_cycles_to_date_negative_cycles_clamped_to_today():
    assert cycles_to_date(-500, 4000, NOW).isoformat() == "2026-05-24"


def test_cycles_to_date_rejects_zero_cycles_per_day():
    with pytest.raises(ValueError):
        cycles_to_date(1000, 0, NOW)


def test_cycles_to_date_rejects_negative_cycles_per_day():
    with pytest.raises(ValueError):
        cycles_to_date(1000, -1, NOW)


@pytest.mark.parametrize(
    "days,expected",
    [
        (0,    "critical"),
        (6.9,  "critical"),
        (7,    "imminent"),
        (29.9, "imminent"),
        (30,   "schedule"),
        (89.9, "schedule"),
        (90,   "monitor"),
        (365,  "monitor"),
    ],
)
def test_classify_band_edges(days, expected):
    assert classify(days) == expected


def test_days_until_future():
    target = cycles_to_date(8000, 4000, NOW)  # 2026-05-26
    assert days_until(target, NOW) == 2


def test_days_until_past_is_negative():
    from datetime import date
    assert days_until(date(2026, 5, 20), NOW) == -4


# ---------------------------------------------------------------------------
# V3 — replacement-date sanity audit
# ---------------------------------------------------------------------------

MIDNIGHT = datetime(2026, 5, 24, 0, 0, 0, tzinfo=timezone.utc)


def test_v3_fresh_50k_cycles_is_about_twelve_days_out():
    # 50_000 cycles / 4_000 cpd = 12.5 days. From midnight that lands on
    # 2026-06-05 (noon), i.e. 12 whole days out — "roughly 12.5 days".
    target = cycles_to_date(50_000, 4_000, MIDNIGHT)
    assert target.isoformat() == "2026-06-05"
    assert days_until(target, MIDNIGHT) == 12


def test_v3_negative_rul_clamps_to_today_zero_days():
    # p50 RUL below zero (already past the predicted failure point) → today, 0 days.
    target = cycles_to_date(-5_000, 4_000, MIDNIGHT)
    assert target.isoformat() == "2026-05-24"
    assert days_until(target, MIDNIGHT) == 0


def test_v3_huge_rul_is_more_than_a_year_out():
    # 2_000_000 / 4_000 = 500 days → well beyond the 365-day ">1 year" UI cutoff.
    target = cycles_to_date(2_000_000, 4_000, MIDNIGHT)
    assert days_until(target, MIDNIGHT) == 500
    assert days_until(target, MIDNIGHT) > 365
