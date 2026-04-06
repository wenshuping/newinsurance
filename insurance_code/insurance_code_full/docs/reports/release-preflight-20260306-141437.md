# Release Preflight Report

- Time: 2026-03-06T06:14:51.439Z
- Result: **PASS**
- Stage: done
- Duration: 13808ms
- Report Json: `docs/reports/release-preflight-20260306-141437.json`
- Persist Stats: none

## Category Summary

- persist: PASS (total=2, failed=0, skipped=0)
- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=0)
- gate: PASS (total=1, failed=0, skipped=0)
- slo: PASS (total=1, failed=0, skipped=0)

## Steps

- db:mall:backfill-source-product-id [persist]: PASS (code=0, duration=290ms)
- risk:check-tenant-fallback [risk]: PASS (code=0, duration=164ms)
- docs:check-links:all [docs]: PASS (code=0, duration=223ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=2812ms)
- test:perf:baseline [perf]: PASS (code=0, duration=339ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=246ms)
- ci:gate:core:report [gate]: PASS (code=0, duration=9481ms)
- slo:guard [slo]: PASS (code=0, duration=250ms)

