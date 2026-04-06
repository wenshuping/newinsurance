# Release Dashboard

- Generated At: 2026-03-06T10:02:41.490Z
- Overall: **GREEN**
- Max Age Window: 72h
- Stamped Json: `docs/reports/release-dashboard-20260306-180241.json`
- Stamped Markdown: `docs/reports/release-dashboard-20260306-180241.md`
- Latest Json: `docs/reports/release-dashboard-latest.json`
- Latest Markdown: `docs/reports/release-dashboard-latest.md`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | PASS | 2026-03-06T10:02:41.484Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/release-preflight-20260306-180226.json` |
| perf-baseline | PASS | 2026-03-06T10:02:30.780Z | 0.2 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-180230.json` |
| ci-gate-core | PASS | 2026-03-06T10:02:41.178Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/ci-gate-core-20260306-180231.json` |
| slo-guard | PASS | 2026-03-06T10:02:41.473Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/slo-guard-20260306-180241.json` |

## Preflight Categories

| Category | Result | Total | Failed | Skipped |
|---|---|---:|---:|---:|
| persist | PASS | 2 | 0 | 0 |
| risk | PASS | 1 | 0 | 0 |
| docs | PASS | 1 | 0 | 0 |
| smoke | PASS | 1 | 0 | 0 |
| perf | PASS | 1 | 0 | 0 |
| gate | PASS | 1 | 0 | 0 |
| slo | PASS | 1 | 0 | 0 |

## Perf Baseline Snapshot

| Endpoint | Avg(ms) | P95(ms) | Fail | Total |
|---|---:|---:|---:|---:|
| /api/health | 3.16 | 24.6 | 0 | 10 |
| /api/mall/items | 3.83 | 6.43 | 0 | 10 |
| /api/activities | 0.75 | 1.67 | 0 | 10 |
| /api/learning/courses | 0.74 | 1.18 | 0 | 10 |

## CI Gate

- Result: **PASS**
- Command: `npm run ci:gate:core`
- Duration: 9995ms

## SLO Guard

- Result: **PASS**
- Alerts: 0
- Thresholds: uptime>=99%, errorRate<=1%, p95<=1200ms

## Actions

- 无阻断项，可进入发布评审。

