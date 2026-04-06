import { permissionRequired, tenantContext } from '../common/access-control.mjs';
import { requireActionConfirmation } from '../common/middleware.mjs';
import { appendAuditLog, createActorSession, getState, nextId, persistSessionsByTokens, persistState, resolveSessionFromBearer, upsertActorCsrfToken } from '../common/state.mjs';
import { canAccessTemplate, effectiveTemplateStatusForActor } from '../common/template-visibility.mjs';
import { listSnapshots, latestSnapshot, rebuildDailySnapshot, runReconciliation } from '../services/analytics.service.mjs';
import {
  enqueueOpsAsyncJob,
  getOpsAsyncJob,
  listOpsAsyncJobLogs,
  listOpsAsyncJobs,
  retryOpsAsyncJob,
  runOpsAsyncJobWorkerOnce,
} from '../services/ops-async-job.service.mjs';
import { refundOrder } from '../services/commerce.service.mjs';
import { assignCustomerByMobile, systemAssignCustomers } from '../services/customer-assignment.service.mjs';
import {
  COMPANY_ADMIN_PAGE_MODULES,
  allCompanyAdminPageIds,
    canOperateTenantTemplates,
    decoratePlatformTemplateRow,
    ensureTenantTeams,
    hasRole,
    preferActorTemplateRows,
  } from './p-admin.shared.mjs';
import {
  CONFIGURABLE_EMPLOYEE_ROLE_KEYS,
  EMPLOYEE_ROLE_PAGE_MODULES,
  allEmployeeRolePageIds,
  normalizeEmployeeRoleKey,
  resolveEmployeeRolePageIdsForTenant,
} from './employee-role-page-permissions.shared.mjs';
import {
  METRIC_RULEBOOK_VERSION,
  buildMetricRuleRemark,
  bumpRuleVersion,
  computeMetricCards,
  ensureMetricRuleSeeds,
  metricRuleKey,
  normalizeMetricEnd,
  normalizeMetricRemarkMode,
  normalizeMetricRuleStatus,
  normalizeRuleVersion,
  parseNumber,
  rowDate,
} from './p-admin-metrics.shared.mjs';
import {
  buildTagJobCustomerMetrics,
  collectCustomerIdsForTagJob,
  ensureTagSeeds,
  evaluateTagRuleByCustomer,
  normalizeTagRuleStatus,
  normalizeTagStatus,
  normalizeTagType,
  resolveTagRuleOutputValue,
} from './p-admin-tags.shared.mjs';
import {
  EVENT_DICTIONARY_VERSION,
  normalizeDefinitionVersion,
  ensureEventDefinitionSeeds,
  eventSchemaTemplateById,
  normalizeCollectMethod,
  normalizeEventStatus,
  normalizeEventType,
  toEventStatusCode,
} from './p-admin-events.shared.mjs';

function buildSharedDeps() {
  return {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
  };
}

export function buildAuthDeps() {
  return {
    getState,
    createActorSession,
    resolveSessionFromBearer,
    upsertActorCsrfToken,
    persistSessionsByTokens,
    persistState,
  };
}

export function buildGovernanceDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    appendAuditLog,
    hasRole,
    COMPANY_ADMIN_PAGE_MODULES,
    allCompanyAdminPageIds,
    EMPLOYEE_ROLE_PAGE_MODULES,
    configurableEmployeeRoleKeys: CONFIGURABLE_EMPLOYEE_ROLE_KEYS,
    allEmployeeRolePageIds,
    resolveEmployeeRolePageIdsForTenant,
    normalizeEmployeeRoleKey,
  };
}

export function buildOpsDeps() {
  return {
    tenantContext,
    permissionRequired,
    refundOrder,
    rebuildDailySnapshot,
    latestSnapshot,
    listSnapshots,
    runReconciliation,
    enqueueOpsAsyncJob,
    retryOpsAsyncJob,
    runOpsAsyncJobWorkerOnce,
    listOpsAsyncJobs,
    getOpsAsyncJob,
    listOpsAsyncJobLogs,
  };
}

export function buildActivityDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    decoratePlatformTemplateRow,
    preferActorTemplateRows,
  };
}

export function buildLearningDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    decoratePlatformTemplateRow,
    preferActorTemplateRows,
  };
}

export function buildWorkforceDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    requireActionConfirmation,
    hasRole,
    ensureTenantTeams,
    assignCustomerByMobile,
    systemAssignCustomers,
  };
}

export function buildMallDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
  };
}

export function buildTagDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    normalizeTagType,
    normalizeTagStatus,
    normalizeTagRuleStatus,
    ensureTagSeeds,
    buildTagJobCustomerMetrics,
    evaluateTagRuleByCustomer,
    resolveTagRuleOutputValue,
    collectCustomerIdsForTagJob,
  };
}

export function buildMetricDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    appendAuditLog,
    computeMetricCards,
    normalizeMetricEnd,
    normalizeMetricRuleStatus,
    normalizeMetricRemarkMode,
    buildMetricRuleRemark,
    metricRuleKey,
    parseNumber,
    rowDate,
    ensureMetricRuleSeeds,
    normalizeRuleVersion,
    bumpRuleVersion,
    METRIC_RULEBOOK_VERSION,
  };
}

export function buildPointsRuleDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    appendAuditLog,
  };
}

export function buildEventDeps(shared = buildSharedDeps()) {
  return {
    ...shared,
    appendAuditLog,
    normalizeEventStatus,
    normalizeEventType,
    normalizeCollectMethod,
    eventSchemaTemplateById,
    toEventStatusCode,
    ensureEventDefinitionSeeds,
    normalizeDefinitionVersion,
    EVENT_DICTIONARY_VERSION,
  };
}

export function buildPAdminRouteDeps() {
  const shared = buildSharedDeps();
  return {
    auth: buildAuthDeps(),
    governance: buildGovernanceDeps(shared),
    ops: buildOpsDeps(),
    activity: buildActivityDeps(shared),
    learning: buildLearningDeps(shared),
    workforce: buildWorkforceDeps(shared),
    mall: buildMallDeps(shared),
    pointsRules: buildPointsRuleDeps(shared),
    tags: buildTagDeps(shared),
    metrics: buildMetricDeps(shared),
    events: buildEventDeps(shared),
  };
}
