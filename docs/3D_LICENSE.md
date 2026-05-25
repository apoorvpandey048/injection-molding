# 3D Asset License Check (P5.1)

**Outcome: ✅ CLEARED to proceed (2026-05-24).** Source confirmed as Trimble 3D Warehouse; the General Model License permits embedding the model (as converted/decimated) inside this application as a decorative backdrop. See "Resolution" below.

## Source (provided by project owner)
- Trimble 3D Warehouse model ID `9db581d85786c7251fd4c0ca94ea0bfa`
- Embed origin: `https://3dwarehouse.sketchup.com/embed/9db581d85786c7251fd4c0ca94ea0bfa`
- Governing terms: **3D Warehouse General Model License** (https://embed-3dwarehouse-classic.sketchup.com/tos/)

## Resolution against the General Model License
| Question | License language | Applies to us? |
|----------|------------------|----------------|
| Embed in our app? | *"Incorporating or including Models … into a larger work … ('Combined Work'), provided that the Combined Work includes substantial additional content"* | ✅ Yes — the IMM dashboard (ML, simulator, charts, gauges) is a substantial Combined Work; the model is a decorative backdrop. |
| Convert / decimate? | *"Creating derivative works of Models …, including by substantially modifying geometry, color, or other attributes"* | ✅ Yes — `.dae → .glb` + Draco + decimation permitted. |
| Attribution required? | No attribution obligation stated. | ✅ None required (we may still credit `ratpie` as a courtesy). |
| Prohibited | *"sell, offer to sell, make or distribute any individual Model on a standalone basis"*; aggregate for redistribution / mapping apps | ❌ N/A — we embed, we do not ship the model standalone or in a mapping app. |

**Assumption:** the standard General Model License applies (no custom/restricted license was posted on the listing). If the listing carries non-standard terms, revisit before shipping.

---

## Original finding (pre-resolution, retained for the record)
**Outcome at time of first check: ⛔ HOLD — redistribution rights UNVERIFIED.**

## Asset
- Archive: `web/public/models/injection+machine.zip` (~1.28 MB)
- Contents: `model.dae` (Collada, ~8.66 MB uncompressed) + 11 texture images under `model/`
- **No `README`, `LICENSE`, or copyright/attribution file is present in the archive.**

## Embedded metadata (from `model.dae` `<asset>` block)
| Field | Value |
|-------|-------|
| author | `ratpie` |
| authoring_tool | SketchUp 8.0.3117 |
| created / modified | 2019-12-08 |
| unit | inch (0.0254 m) |
| up_axis | Z_UP |

No `<license>`, copyright string, CC tag, or source URL is embedded anywhere in the file (searched for: license, copyright, author, sketchfab, CC-, CC0, creativecommons, attribution).

## Assessment
- The model was authored in **SketchUp 8** by a third party (`ratpie`), not by this project's owner. This is the classic fingerprint of a **Trimble 3D Warehouse** export.
- 3D Warehouse content is governed by the **3D Warehouse General Model License**, which has specific terms on redistribution and bundling into other products. Those terms are **not satisfied merely by possessing the file**.
- With **no explicit license grant** found in or alongside the asset, redistribution rights **cannot be confirmed**. The conservative and correct reading of the P5.1 gate ("abort if non-redistributable") is to treat *unverified* as *do-not-ship*.

## Decision
- **P5.1: complete** — check performed, outcome documented here.
- **P5.2–P5.4: BLOCKED** — `.dae → .glb` conversion, `ThreeBackdrop.tsx`, and the feature-flag mount must NOT proceed until the asset's license is confirmed to permit bundling/redistribution in this app.

## To unblock
Provide one of:
1. The original **source URL** (e.g. the 3D Warehouse / Sketchfab listing) so the license terms can be read directly, **or**
2. Written confirmation that the asset is licensed for redistribution in this project (e.g. CC0 / CC-BY with attribution / a commercial license), **or**
3. A replacement model with a clear permissive license.

If option 2/3 applies, P5.2 can resume; if the license requires attribution, that attribution must be surfaced in the UI/credits.
