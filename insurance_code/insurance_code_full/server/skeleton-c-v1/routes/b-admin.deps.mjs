import { dataScope, permissionRequired, tenantContext } from '../common/access-control.mjs';
import { appendAuditLog, createActorSession, getState, nextId, persistPoliciesByIds, persistSessionsByTokens, persistState, resolveSessionFromBearer, upsertActorCsrfToken } from '../common/state.mjs';
import { canAccessTemplate, effectiveTemplateStatusForActor, hasRole } from '../common/template-visibility.mjs';
import { fulfillOrderWriteoff } from '../services/commerce.service.mjs';
import { decoratePlatformTemplateRow, preferActorTemplateRows } from './p-admin.shared.mjs';

export function buildBAdminRouteDeps() {
  return {
    dataScope,
    permissionRequired,
    tenantContext,
    appendAuditLog,
    createActorSession,
    getState,
    nextId,
    persistPoliciesByIds,
    persistSessionsByTokens,
    persistState,
    resolveSessionFromBearer,
    upsertActorCsrfToken,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    hasRole,
    decoratePlatformTemplateRow,
    preferActorTemplateRows,
    fulfillOrderWriteoff,
  };
}
