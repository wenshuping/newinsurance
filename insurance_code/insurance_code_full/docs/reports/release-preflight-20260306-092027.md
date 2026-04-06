# Release Preflight Report

- Time: 2026-03-06T01:20:29.335Z
- Result: **FAIL**
- Stage: ci:gate:core
- Duration: 2325ms
- Report Json: `docs/reports/release-preflight-20260306-092027.json`
- Persist Stats: none

## Category Summary

- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=1)
- persist: PASS (total=1, failed=0, skipped=0)
- gate: FAIL (total=1, failed=1, skipped=0)

## Steps

- risk:check-tenant-fallback [risk]: PASS (code=0, duration=188ms)
- docs:check-links:all [docs]: PASS (code=0, duration=177ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=1241ms)
- test:perf:baseline [perf]: SKIPPED (code=0, duration=0ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=170ms)
- ci:gate:core [gate]: FAIL (code=1, duration=543ms)

