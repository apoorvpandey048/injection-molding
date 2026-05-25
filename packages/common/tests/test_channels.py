"""Smoke tests pinning the locked channel taxonomy.

If these fail, do NOT silently rename or drop channels — amend ADR-0001
first, then update the test.
"""
from __future__ import annotations

from imm_common.channels import (
    ALL_CHANNELS,
    COMPONENT_LEADING_CHANNELS,
    TIER_A_CURVES,
    TIER_B_SLOW,
    TIER_C_SCALARS,
    TIER_D_CONTEXT,
    Channel,
    SampleRateTier,
    tier_of,
)


def test_no_duplicate_channel_names_across_tiers() -> None:
    keys = (
        list(TIER_A_CURVES)
        + list(TIER_B_SLOW)
        + list(TIER_C_SCALARS)
        + list(TIER_D_CONTEXT)
    )
    assert len(keys) == len(set(keys)), "channel names must be unique across tiers"


def test_aslantas_hold_profile_is_ten_steps() -> None:
    steps = [f"hold_pressure_step_{i}" for i in range(1, 11)]
    for s in steps:
        assert s in TIER_C_SCALARS, f"missing Aslantas tag {s}"


def test_rousopoulou_six_barrel_zones_present() -> None:
    for i in range(1, 7):
        assert f"barrel_zone_temp_{i}" in TIER_B_SLOW


def test_required_paper_grounded_tags() -> None:
    # Aslantas: oil temp, hydraulic hold peak, cushion, closing force, cycle time
    for tag in (
        "oil_temperature",
        "hydr_hold_pressure_peak",
        "cushion_min",
        "closing_force_actual",
        "cycle_time_actual",
        "cycle_time_set",
    ):
        assert tag in ALL_CHANNELS, f"required Aslantas-grounded tag missing: {tag}"

    # Rousopoulou: switchover pressure, plasticizing position, clamp force, mold protection
    for tag in (
        "switchover_pressure",
        "plasticizing_position_corrected",
        "clamp_force_actual",
        "mold_protection_time",
    ):
        assert tag in ALL_CHANNELS, f"required Rousopoulou-grounded tag missing: {tag}"

    # Nagorny / Michiels: in-mold P, in-mold T, hydraulic injection P, screw pos, ram pos
    for tag in (
        "cavity_pressure_1",
        "cavity_temperature_1",
        "hydraulic_injection_pressure",
        "screw_position",
        "ram_position",
    ):
        assert tag in ALL_CHANNELS, f"required curve channel missing: {tag}"


def test_tier_of_classifies_everything() -> None:
    for name in ALL_CHANNELS:
        assert tier_of(name) in SampleRateTier


def test_channel_enum_covers_continuous_signals() -> None:
    # Every Tier-A and Tier-B name must be reachable through the Channel enum.
    enum_values = {c.value for c in Channel}
    for name in {**TIER_A_CURVES, **TIER_B_SLOW}:
        assert name in enum_values, f"Channel enum is missing {name}"


def test_component_hints_reference_real_channels() -> None:
    for component, channels in COMPONENT_LEADING_CHANNELS.items():
        for ch in channels:
            assert ch in ALL_CHANNELS, (
                f"component {component!r} references unknown channel {ch!r}"
            )
