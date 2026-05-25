"""Deterministic seeded training. Writes artifacts/models/{rul,quality}.pkl + model_card.md"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

from src.ml.train_quality import train as train_quality
from src.ml.train_rul import train as train_rul


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="data/synthetic/training.parquet")
    parser.add_argument("--out",  type=str, default="artifacts/models")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Training data not found at {data_path}. Run scripts/generate_training_data.py first.")
        sys.exit(1)

    df = pd.read_parquet(data_path)
    print(f"Loaded {len(df)} rows from {data_path}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Training quality classifier...")
    q_art = train_quality(df, out_dir / "quality.pkl", n_jobs=3)

    print("Training RUL quantile regressors...")
    r_art = train_rul(df, out_dir / "rul.pkl", n_jobs=5)

    comp_score_lines = "\n".join(
        f"  - {comp}: {art['val_scores']}"
        for comp, art in r_art["components"].items()
    )
    card = (
        "# Model Card\n\n"
        f"## Training data\n- Rows: {len(df)}\n- Machines: {df['machine_id'].nunique()}\n\n"
        "## Quality model\n"
        "- Type: CalibratedClassifierCV(GradientBoostingClassifier)\n"
        "- Labels: good / acceptable / waste\n"
        f"- Features: {len(q_art['feature_cols'])}\n\n"
        "## RUL model (per-component)\n"
        "- Type: GradientBoostingRegressor (quantile loss)\n"
        "- Quantiles: p10, p50, p90\n"
        f"- Components: {list(r_art['components'].keys())}\n"
        f"- Features: {len(r_art['feature_cols'])}\n"
        f"- Val scores per component:\n{comp_score_lines}\n\n"
        "## No-leakage note\n"
        "Models trained exclusively on observable signals. "
        "Hidden FSM health state was never used as a feature.\n"
    )
    (out_dir / "model_card.md").write_text(card)
    print("Done. Artifacts written to", out_dir)


if __name__ == "__main__":
    main()
