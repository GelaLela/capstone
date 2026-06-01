"""
piggery/analytics/
==================
The analytics service layer for Piglytics.

All KPI calculations live here — not in ViewSets.
Views consume functions from this package, they do NOT calculate.

Modules:
  breeding.py     — Breeding KPIs (corrected formulas)
  health.py       — Farm Health Index (4-factor composite)
  growth.py       — ADG pipeline, GPI, market readiness
  feed.py         — Rolling avg consumption, FCR
  farm_score.py   — Composite farm performance score
  kpi_snapshot.py — Daily KPI computation + caching
"""
