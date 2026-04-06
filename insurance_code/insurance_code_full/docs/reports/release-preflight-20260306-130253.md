# Release Preflight Report

- Time: 2026-03-06T05:03:05.571Z
- Result: **PASS**
- Stage: done
- Duration: 11621ms
- Report Json: `docs/reports/release-preflight-20260306-130253.json`
- Persist Stats: none

## Category Summary

- persist: PASS (total=2, failed=0, skipped=0)
- risk: PASS (total=1, failed=0, skipped=0)
- docs: PASS (total=1, failed=0, skipped=0)
- smoke: PASS (total=1, failed=0, skipped=0)
- perf: PASS (total=1, failed=0, skipped=0)
- gate: PASS (total=1, failed=0, skipped=0)

## Steps

- db:mall:backfill-source-product-id [persist]: PASS (code=0, duration=265ms)
- risk:check-tenant-fallback [risk]: PASS (code=0, duration=154ms)
- docs:check-links:all [docs]: PASS (code=0, duration=194ms)
- test:smoke:api-core [smoke]: PASS (code=0, duration=2620ms)
- test:perf:baseline [perf]: PASS (code=0, duration=296ms)
- lint:persistence:incremental-writepaths [persist]: PASS (code=0, duration=182ms)
- ci:gate:core [gate]: PASS (code=0, duration=7908ms)

