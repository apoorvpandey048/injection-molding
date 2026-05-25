# ml/

Predictive-maintenance + digital-twin ML exploration grounded in 7 papers
(Taşçı 2023, Nagorny 2017, Michiels 2022, Aslantas 2022, Rousopoulou 2020,
Nasiri 2024, Zhou 2023). Primary dataset: NASA C-MAPSS turbofan run-to-failure
(stand-in for IMM run-to-failure trajectories — see honesty caveats in
`IMPLEMENTATION_PLAN.md` §3).

## Quick start

```bash
# from repo root
uv sync --extra ml
uv run python -m ipykernel install --user --name imm-ml --display-name "IMM ML (3.11)"

# extract C-MAPSS (gitignored)
mkdir -p ml/datasets/cmapss
unzip -o archive.zip -d ml/datasets/cmapss
```

Open `ml/notebooks/pdm_imm_exploration.ipynb` in VS Code and select the
`IMM ML (3.11)` kernel.

## Layout

- `notebooks/pdm_imm_exploration.ipynb` — iterative cell-by-cell build
- `features/` — windowing, tsfresh, spectral (CWT), selection helpers
- `datasets/` — raw datasets (gitignored)
- `IMPLEMENTATION_PLAN.md` — phase plan, paper→section map, honesty caveats

`SEED = 20260520` everywhere. Every RUL split is `GroupKFold` by `unit_id`.
