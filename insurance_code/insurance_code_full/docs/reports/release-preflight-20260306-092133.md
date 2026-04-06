# Release Preflight Report

- Time: 2026-03-06T01:21:41.519Z
- Result: **PASS**
- Stage: done
- Duration: 7712ms
- Report Json: `docs/reports/release-preflight-20260306-092133.json`
- Persist Stats: none

## Category Summary

- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=1)
- persist: PASS (total=1, failed=0, skipped=0)
- gate: PASS (total=1, failed=0, skipped=0)

## Steps

- risk:check-tenant-fallback [risk]: PASS (code=0, duration=347ms)
- docs:check-links:all [docs]: PASS (code=0, duration=172ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=1212ms)
- test:perf:baseline [perf]: SKIPPED (code=0, duration=0ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=158ms)
- ci:gate:core [gate]: PASS (code=0, duration=5819ms)

