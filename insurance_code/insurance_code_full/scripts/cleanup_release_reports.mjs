#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP_COUNT = Number(process.env.RELEASE_REPORT_KEEP || '30');

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportsDir = path.resolve(__dirname, '../docs/reports');

  await fs.mkdir(reportsDir, { recursive: true });
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });

  const releaseStamps = entries
    .filter((entry) => entry.isFile() && /^release-preflight-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^release-preflight-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();

  const ciGateStamps = entries
    .filter((entry) => entry.isFile() && /^ci-gate-core-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^ci-gate-core-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();

  const removeRelease = releaseStamps.slice(0, Math.max(0, releaseStamps.length - KEEP_COUNT));
  const removeCiGate = ciGateStamps.slice(0, Math.max(0, ciGateStamps.length - KEEP_COUNT));
  const perfBaselineStamps = entries
    .filter((entry) => entry.isFile() && /^perf-baseline-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^perf-baseline-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const removePerfBaseline = perfBaselineStamps.slice(0, Math.max(0, perfBaselineStamps.length - KEEP_COUNT));
  const dashboardStamps = entries
    .filter((entry) => entry.isFile() && /^release-dashboard-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^release-dashboard-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const removeDashboard = dashboardStamps.slice(0, Math.max(0, dashboardStamps.length - KEEP_COUNT));
  const sloGuardStamps = entries
    .filter((entry) => entry.isFile() && /^slo-guard-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^slo-guard-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const removeSloGuard = sloGuardStamps.slice(0, Math.max(0, sloGuardStamps.length - KEEP_COUNT));

  for (const stamp of removeRelease) {
    await fs.rm(path.join(reportsDir, `release-preflight-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `release-preflight-${stamp}.md`), { force: true });
  }
  for (const stamp of removeCiGate) {
    await fs.rm(path.join(reportsDir, `ci-gate-core-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `ci-gate-core-${stamp}.md`), { force: true });
  }
  for (const stamp of removePerfBaseline) {
    await fs.rm(path.join(reportsDir, `perf-baseline-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `perf-baseline-${stamp}.md`), { force: true });
  }
  for (const stamp of removeDashboard) {
    await fs.rm(path.join(reportsDir, `release-dashboard-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `release-dashboard-${stamp}.md`), { force: true });
  }
  for (const stamp of removeSloGuard) {
    await fs.rm(path.join(reportsDir, `slo-guard-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `slo-guard-${stamp}.md`), { force: true });
  }

  const payload = {
    ok: true,
    reportsDir,
    keepCount: KEEP_COUNT,
    releasePreflight: {
      beforeCount: releaseStamps.length,
      removedCount: removeRelease.length,
      removed: removeRelease.map((s) => `release-preflight-${s}`),
      afterCount: releaseStamps.length - removeRelease.length,
    },
    ciGateCore: {
      beforeCount: ciGateStamps.length,
      removedCount: removeCiGate.length,
      removed: removeCiGate.map((s) => `ci-gate-core-${s}`),
      afterCount: ciGateStamps.length - removeCiGate.length,
    },
    perfBaseline: {
      beforeCount: perfBaselineStamps.length,
      removedCount: removePerfBaseline.length,
      removed: removePerfBaseline.map((s) => `perf-baseline-${s}`),
      afterCount: perfBaselineStamps.length - removePerfBaseline.length,
    },
    releaseDashboard: {
      beforeCount: dashboardStamps.length,
      removedCount: removeDashboard.length,
      removed: removeDashboard.map((s) => `release-dashboard-${s}`),
      afterCount: dashboardStamps.length - removeDashboard.length,
    },
    sloGuard: {
      beforeCount: sloGuardStamps.length,
      removedCount: removeSloGuard.length,
      removed: removeSloGuard.map((s) => `slo-guard-${s}`),
      afterCount: sloGuardStamps.length - removeSloGuard.length,
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
