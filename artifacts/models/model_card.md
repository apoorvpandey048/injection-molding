# Model Card

## Training data
- Rows: 80000
- Machines: 20

## Quality model
- Type: CalibratedClassifierCV(GradientBoostingClassifier)
- Labels: good / acceptable / waste
- Features: 49

## RUL model (per-component)
- Type: GradientBoostingRegressor (quantile loss)
- Quantiles: p10, p50, p90
- Components: ['hydraulic', 'screw_check_ring', 'heaters', 'drive', 'mold']
- Features: 49
- Val scores per component:
  - hydraulic: {'pinball_p10': 180.18690917740838, 'pinball_p50': 500.701878423775, 'pinball_p90': 180.1189312466132}
  - screw_check_ring: {'pinball_p10': 180.18690917740741, 'pinball_p50': 500.7018784237745, 'pinball_p90': 180.11893124661304}
  - heaters: {'pinball_p10': 180.18690917740747, 'pinball_p50': 500.7018784237745, 'pinball_p90': 180.11893124661304}
  - drive: {'pinball_p10': 180.1869091773574, 'pinball_p50': 500.7018784236354, 'pinball_p90': 180.11893124656302}
  - mold: {'pinball_p10': 180.18690917727403, 'pinball_p50': 500.70187842340385, 'pinball_p90': 180.11893124647972}

## No-leakage note
Models trained exclusively on observable signals. Hidden FSM health state (and RUL targets derived from it) was never used as a feature.
