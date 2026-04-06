# Release Dashboard

- Generated At: 2026-03-06T05:48:59.935Z
- Overall: **GREEN**
- Max Age Window: 72h
- Stamped Json: `docs/reports/release-dashboard-20260306-134859.json`
- Stamped Markdown: `docs/reports/release-dashboard-20260306-134859.md`
- Latest Json: `docs/reports/release-dashboard-latest.json`
- Latest Markdown: `docs/reports/release-dashboard-latest.md`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | PASS | 2026-03-06T05:48:59.931Z | 0 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/release-preflight-20260306-134849.json` |
| perf-baseline | PASS | 2026-03-06T05:48:52.226Z | 0.1 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-134852.json` |
| ci-gate-core | PASS | 2026-03-05T14:42:56.968Z | 906 | `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/ci-gate-core-20260305-224253.json` |

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
| /api/health | 3.22 | 23.17 | 0 | 10 |
| /api/mall/items | 1.85 | 3.09 | 0 | 10 |
| /api/activities | 0.41 | 0.63 | 0 | 10 |
| /api/learning/courses | 0.59 | 1.11 | 0 | 10 |

## CI Gate

- Result: **PASS**
- Command: `npm run typecheck`
- Duration: 3730ms

## Actions

- 无阻断项，可进入发布评审。

