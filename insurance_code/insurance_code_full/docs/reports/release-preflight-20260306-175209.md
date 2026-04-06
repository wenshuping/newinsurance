# Release Preflight Report

- Time: 2026-03-06T09:52:28.665Z
- Result: **FAIL**
- Stage: slo:guard
- Duration: 19024ms
- Report Json: `docs/reports/release-preflight-20260306-175209.json`
- Persist Stats: none

## Category Summary

- persist: PASS (total=2, failed=0, skipped=0)
- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=0)
- gate: PASS (total=1, failed=0, skipped=0)
- slo: FAIL (total=1, failed=1, skipped=0)

## Steps

- db:mall:backfill-source-product-id [persist]: PASS (code=0, duration=284ms)
- risk:check-tenant-fallback [risk]: PASS (code=0, duration=169ms)
- docs:check-links:all [docs]: PASS (code=0, duration=180ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=4100ms)
- test:perf:baseline [perf]: PASS (code=0, duration=274ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=176ms)
- ci:gate:core:report [gate]: PASS (code=0, duration=13365ms)
- slo:guard [slo]: FAIL (code=1, duration=473ms)

