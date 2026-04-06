# Release Dashboard

- Generated At: 2026-03-06T05:47:19.949Z
- Overall: **GREEN**
- Max Age Window: 72h
- Stamped Json: `docs/reports/release-dashboard-20260306-134719.json`
- Stamped Markdown: `docs/reports/release-dashboard-20260306-134719.md`
- Latest Json: `docs/reports/release-dashboard-latest.json`
- Latest Markdown: `docs/reports/release-dashboard-latest.md`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | PASS | 2026-03-06T05:03:05.571Z | 44.2 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/release-preflight-20260306-130253.json` |
| perf-baseline | PASS | 2026-03-06T05:02:57.470Z | 44.4 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-130257.json` |
| ci-gate-core | PASS | 2026-03-05T14:42:56.968Z | 904.4 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/ci-gate-core-20260305-224253.json` |

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
| /api/health | 3.87 | 28.19 | 0 | 10 |
| /api/mall/items | 1.8 | 4.82 | 0 | 10 |
| /api/activities | 0.53 | 1.15 | 0 | 10 |
| /api/learning/courses | 0.58 | 0.99 | 0 | 10 |

## CI Gate

- Result: **PASS**
- Command: `npm run typecheck`
- Duration: 3730ms

## Actions

- 无阻断项，可进入发布评审。

