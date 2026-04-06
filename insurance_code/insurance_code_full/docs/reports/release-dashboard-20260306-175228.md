# Release Dashboard

- Generated At: 2026-03-06T09:52:28.670Z
- Overall: **RED**
- Max Age Window: 72h
- Stamped Json: `docs/reports/release-dashboard-20260306-175228.json`
- Stamped Markdown: `docs/reports/release-dashboard-20260306-175228.md`
- Latest Json: `docs/reports/release-dashboard-latest.json`
- Latest Markdown: `docs/reports/release-dashboard-latest.md`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | FAIL | 2026-03-06T09:52:28.665Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/release-preflight-20260306-175209.json` |
| perf-baseline | PASS | 2026-03-06T09:52:14.641Z | 0.2 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-175214.json` |
| ci-gate-core | PASS | 2026-03-06T09:52:28.176Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/ci-gate-core-20260306-175215.json` |
| slo-guard | FAIL | 2026-03-06T09:52:28.652Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/slo-guard-20260306-175228.json` |

## Preflight Categories

| Category | Result | Total | Failed | Skipped |
|---|---|---:|---:|---:|
| persist | PASS | 2 | 0 | 0 |
| risk | PASS | 1 | 0 | 0 |
| docs | PASS | 1 | 0 | 0 |
| smoke | PASS | 1 | 0 | 0 |
| perf | PASS | 1 | 0 | 0 |
| gate | PASS | 1 | 0 | 0 |
| slo | FAIL | 1 | 1 | 0 |

## Perf Baseline Snapshot

| Endpoint | Avg(ms) | P95(ms) | Fail | Total |
|---|---:|---:|---:|---:|
| /api/health | 2.91 | 22.6 | 0 | 10 |
| /api/mall/items | 1.52 | 1.84 | 0 | 10 |
| /api/activities | 0.4 | 0.68 | 0 | 10 |
| /api/learning/courses | 0.74 | 1.58 | 0 | 10 |

## CI Gate

- Result: **PASS**
- Command: `npm run ci:gate:core`
- Duration: 13172ms

## SLO Guard

- Result: **FAIL**
- Alerts: 1
- Thresholds: uptime>=99%, errorRate<=1%, p95<=1200ms

## Actions

- 执行失败：release-preflight, slo-guard

