# Release Preflight Report

- Time: 2026-03-06T05:54:05.486Z
- Result: **PASS**
- Stage: done
- Duration: 10756ms
- Report Json: `docs/reports/release-preflight-20260306-135354.json`
- Persist Stats: none

## Category Summary

- persist: PASS (total=2, failed=0, skipped=0)
- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=0)
- gate: PASS (total=1, failed=0, skipped=0)

## Steps

- db:mall:backfill-source-product-id [persist]: PASS (code=0, duration=260ms)
- risk:check-tenant-fallback [risk]: PASS (code=0, duration=148ms)
- docs:check-links:all [docs]: PASS (code=0, duration=171ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=2411ms)
- test:perf:baseline [perf]: PASS (code=0, duration=243ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=144ms)
- ci:gate:core:report [gate]: PASS (code=0, duration=7376ms)

