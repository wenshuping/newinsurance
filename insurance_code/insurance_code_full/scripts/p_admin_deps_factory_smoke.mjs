#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildActivityDeps,
  buildAuthDeps,
  buildEventDeps,
  buildGovernanceDeps,
  buildLearningDeps,
  buildMallDeps,
  buildMetricDeps,
  buildOpsDeps,
  buildPAdminRouteDeps,
  buildTagDeps,
  buildWorkforceDeps,
} from '../server/skeleton-c-v1/routes/p-admin.deps.mjs';

function expectFn(obj, key) {
  assert.equal(typeof obj?.[key], 'function', `expected function: ${key}`);
}

function main() {
  const sharedCore = {
    tenantContext: () => {},
    permissionRequired: () => {},
    getState: () => {},
    nextId: () => 1,
    persistState: () => {},
  };

  const auth = buildAuthDeps();
  expectFn(auth, 'getState');
  expectFn(auth, 'createActorSession');
  expectFn(auth, 'resolveSessionFromBearer');
  expectFn(auth, 'upsertActorCsrfToken');

  const governance = buildGovernanceDeps(sharedCore);
  expectFn(governance, 'tenantContext');
  expectFn(governance, 'permissionRequired');
  expectFn(governance, 'appendAuditLog');
  expectFn(governance, 'hasRole');
  assert.ok(Array.isArray(governance.COMPANY_ADMIN_PAGE_MODULES), 'COMPANY_ADMIN_PAGE_MODULES should be array');
  expectFn(governance, 'allCompanyAdminPageIds');
  assert.ok(Array.isArray(governance.allCompanyAdminPageIds()), 'allCompanyAdminPageIds() should return array');

  const ops = buildOpsDeps();
  expectFn(ops, 'tenantContext');
  expectFn(ops, 'permissionRequired');
  expectFn(ops, 'refundOrder');
  expectFn(ops, 'rebuildDailySnapshot');
  expectFn(ops, 'latestSnapshot');
  expectFn(ops, 'listSnapshots');
  expectFn(ops, 'runReconciliation');
  expectFn(ops, 'enqueueOpsAsyncJob');
  expectFn(ops, 'retryOpsAsyncJob');
  expectFn(ops, 'runOpsAsyncJobWorkerOnce');
  expectFn(ops, 'listOpsAsyncJobs');
  expectFn(ops, 'getOpsAsyncJob');
  expectFn(ops, 'listOpsAsyncJobLogs');

  const activity = buildActivityDeps(sharedCore);
  expectFn(activity, 'canOperateTenantTemplates');
  expectFn(activity, 'canAccessTemplate');
  expectFn(activity, 'decoratePlatformTemplateRow');

  const learning = buildLearningDeps(sharedCore);
  expectFn(learning, 'canOperateTenantTemplates');
  expectFn(learning, 'canAccessTemplate');

  const workforce = buildWorkforceDeps(sharedCore);
  expectFn(workforce, 'requireActionConfirmation');
  expectFn(workforce, 'ensureTenantTeams');
  expectFn(workforce, 'assignCustomerByMobile');
  expectFn(workforce, 'systemAssignCustomers');

  const mall = buildMallDeps(sharedCore);
  expectFn(mall, 'canOperateTenantTemplates');
  expectFn(mall, 'canAccessTemplate');

  const tags = buildTagDeps(sharedCore);
  expectFn(tags, 'normalizeTagType');
  expectFn(tags, 'normalizeTagStatus');
  expectFn(tags, 'normalizeTagRuleStatus');
  expectFn(tags, 'ensureTagSeeds');
  expectFn(tags, 'buildTagJobCustomerMetrics');
  expectFn(tags, 'evaluateTagRuleByCustomer');
  expectFn(tags, 'resolveTagRuleOutputValue');
  expectFn(tags, 'collectCustomerIdsForTagJob');

  const metrics = buildMetricDeps(sharedCore);
  expectFn(metrics, 'computeMetricCards');
  expectFn(metrics, 'normalizeMetricEnd');
  expectFn(metrics, 'normalizeMetricRuleStatus');
  expectFn(metrics, 'normalizeMetricRemarkMode');
  expectFn(metrics, 'buildMetricRuleRemark');
  expectFn(metrics, 'metricRuleKey');
  expectFn(metrics, 'parseNumber');
  expectFn(metrics, 'rowDate');
  expectFn(metrics, 'ensureMetricRuleSeeds');
  expectFn(metrics, 'normalizeRuleVersion');
  expectFn(metrics, 'bumpRuleVersion');
  assert.equal(typeof metrics.METRIC_RULEBOOK_VERSION, 'string', 'METRIC_RULEBOOK_VERSION should be string');

  const events = buildEventDeps(sharedCore);
  expectFn(events, 'normalizeEventStatus');
  expectFn(events, 'normalizeEventType');
  expectFn(events, 'normalizeCollectMethod');
  expectFn(events, 'eventSchemaTemplateById');
  expectFn(events, 'toEventStatusCode');
  expectFn(events, 'ensureEventDefinitionSeeds');
  expectFn(events, 'normalizeDefinitionVersion');
  assert.equal(typeof events.EVENT_DICTIONARY_VERSION, 'string', 'EVENT_DICTIONARY_VERSION should be string');

  const all = buildPAdminRouteDeps();
  const domains = ['auth', 'governance', 'ops', 'activity', 'learning', 'workforce', 'mall', 'tags', 'metrics', 'events'];
  domains.forEach((name) => {
    assert.ok(all[name] && typeof all[name] === 'object', `missing route deps domain: ${name}`);
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'auth_deps',
          'governance_deps',
          'ops_deps',
          'activity_deps',
          'learning_deps',
          'workforce_deps',
          'mall_deps',
          'tag_deps',
          'metric_deps',
          'event_deps',
          'aggregate_deps',
        ],
      },
      null,
      2
    )
  );
}

main();
