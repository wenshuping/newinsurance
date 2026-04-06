#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHARED = path.resolve(ROOT, '../../shared-contracts/select-options.ts');
const SHARED_INDEX = path.resolve(ROOT, '../../shared-contracts/index.ts');
const P_BRIDGE = path.resolve(ROOT, '../../insurance_code_P/src/lib/selectOptions.ts');
const P_APP = path.resolve(ROOT, '../../insurance_code_P/src/App.tsx');

function fail(message, context = null) {
  console.error(JSON.stringify({ ok: false, message, context }, null, 2));
  process.exit(1);
}

function mustContain(code, pattern, file, why) {
  if (!code.includes(pattern)) fail(why, { file, pattern });
}

function mustNotContain(code, pattern, file, why) {
  if (code.includes(pattern)) fail(why, { file, pattern });
}

function main() {
  for (const file of [SHARED, SHARED_INDEX, P_BRIDGE, P_APP]) {
    if (!fs.existsSync(file)) fail('required file not found', { file });
  }

  const sharedCode = fs.readFileSync(SHARED, 'utf8');
  const indexCode = fs.readFileSync(SHARED_INDEX, 'utf8');
  const bridgeCode = fs.readFileSync(P_BRIDGE, 'utf8');
  const appCode = fs.readFileSync(P_APP, 'utf8');

  mustContain(sharedCode, 'export const METRIC_PERIOD_OPTIONS', SHARED, 'shared select-options must export METRIC_PERIOD_OPTIONS');
  mustContain(indexCode, "export * from './select-options';", SHARED_INDEX, 'shared index must export select-options');
  mustContain(bridgeCode, 'METRIC_PERIOD_OPTIONS', P_BRIDGE, 'P bridge must re-export METRIC_PERIOD_OPTIONS');

  mustContain(appCode, "from './lib/selectOptions'", P_APP, 'P app must import from selectOptions bridge');
  mustContain(appCode, 'METRIC_PERIOD_OPTIONS.map', P_APP, 'P app must use METRIC_PERIOD_OPTIONS.map');
  mustNotContain(appCode, 'const METRIC_PERIOD_OPTIONS = [', P_APP, 'P app should not define local METRIC_PERIOD_OPTIONS');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_metric_period_exported',
          'shared_index_exported',
          'p_bridge_reexported',
          'p_app_uses_bridge_constant',
          'no_local_metric_period_options_definition',
        ],
      },
      null,
      2
    )
  );
}

main();
