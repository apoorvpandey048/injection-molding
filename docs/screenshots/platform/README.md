# IMM Digital Twin Platform — Screenshot Gallery

Fresh captures of the shipped platform (headless Chromium, 1600×900 unless noted).
These are the figures embedded in `docs/PROTOTYPE_OVERVIEW.docx`.

## Operations mode
| File | What it shows |
|------|----------------|
| [01_operations_overview](01_operations_overview.png) | Command Center — health-tinted twin, subsystem rail, machine-overview panel |
| [02_rail_tooltip](02_rail_tooltip.png) | Hover a subsystem → 3-D highlight + What/Reading/Action tooltip |
| [03_select_hydraulic](03_select_hydraulic.png) | Hydraulic selected — base region + live detail panel |
| [04_select_screw](04_select_screw.png) | Screw & Check Ring selected |
| [05_select_drive](05_select_drive.png) | Drive selected — central region, "Viewing ·" badge |
| [06_select_heaters](06_select_heaters.png) | Heaters selected |
| [07_select_mold](07_select_mold.png) | Mold & Clamp selected — clamp end |
| [08_kpi_tooltip](08_kpi_tooltip.png) | Metric tooltip — defines RUL, interprets the reading |
| [09_forecast_crosshair](09_forecast_crosshair.png) | RUL forecast crosshair — cycles, calendar horizon, band, risk |
| [10_sensor_tooltip](10_sensor_tooltip.png) | Sensor tooltip — value, normal direction, band, meaning |
| [11_demo_controls](11_demo_controls.png) | Fenced demonstration controls |
| [12_settings](12_settings.png) | Settings — production rate (persisted) |

## Degradation & failure
| File | What it shows |
|------|----------------|
| [13_state_warning](13_state_warning.png) | Warning — base shifts amber |
| [14_state_critical](14_state_critical.png) | Critical — region reddens, quality → WASTE |
| [15_state_failed](15_state_failed.png) | Failed — red region, banner, alerts |

## Inspection mode
| File | What it shows |
|------|----------------|
| [16_inspection_overview](16_inspection_overview.png) | Hierarchy + inspector + mapping editor |
| [17_inspection_mesh_selected](17_inspection_mesh_selected.png) | A mesh selected — inspector populated |
| [18_inspection_wireframe](18_inspection_wireframe.png) | Wireframe view |
| [19_inspection_xray](19_inspection_xray.png) | X-ray view |
| [20_inspection_isolate](20_inspection_isolate.png) | Isolation — only the selection shown |

## Collaboration
| File | What it shows |
|------|----------------|
| [23_readonly_review](23_readonly_review.png) | Read-only investor link (#…&ro=1) — controls hidden, monitoring live |

## Layout
| File | What it shows |
|------|----------------|
| [21_responsive_1280](21_responsive_1280.png) | Layout at 1280 px |
| [22_widescreen_1920](22_widescreen_1920.png) | Layout at 1920 px |

> Regenerate: run the platform (`./demo.sh`), then drive it with Playwright (see the
> capture scripts referenced in the commit history) or re-shoot manually.
