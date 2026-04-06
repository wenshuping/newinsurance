# Release Dashboard

- Generated At: 2026-03-06T05:54:05.491Z
- Overall: **GREEN**
- Max Age Window: 72h
- Stamped Json: `docs/reports/release-dashboard-20260306-135405.json`
- Stamped Markdown: `docs/reports/release-dashboard-20260306-135405.md`
- Latest Json: `docs/reports/release-dashboard-latest.json`
- Latest Markdown: `docs/reports/release-dashboard-latest.md`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | PASS | 2026-03-06T05:54:05.486Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/release-preflight-20260306-135354.json` |
| perf-baseline | PASS | 2026-03-06T05:53:57.956Z | 0.1 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-135357.json` |
| ci-gate-core | PASS | 2026-03-06T05:54:05.475Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/ci-gate-core-20260306-135358.json` |

## Preflight Categories

| Category | Result | Total | Failed | Skipped |
|---|---|---:|---:|---:|
| persist | PASS | 2 | 0 | 0 |
| risk | PASS | 1 | 0 | 0 |
| docs | PASS | 1 | 0 | 0 |
| smoke | PASS | 1 | 0 | 0 |
| perf | PASS | 1 | 0 | 0 |
| gate | PASS | 1 | 0 | 0 |

## Perf Baseline Snapshot

| Endpoint | Avg(ms) | P95(ms) | Fail | Total |
|---|---:|---:|---:|---:|
| /api/health | 2.98 | 23.06 | 0 | 10 |
| /api/mall/items | 1.29 | 2 | 0 | 10 |
| /api/activities | 0.32 | 0.46 | 0 | 10 |
| /api/learning/courses | 0.46 | 1.3 | 0 | 10 |

## CI Gate

- Result: **PASS**
- Command: `npm run ci:gate:core`
- Duration: 7228ms

## Actions

- 无阻断项，可进入发布评审。

