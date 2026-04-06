const toInt = (value, fallback = null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
};
const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const toStringOrEmpty = (value) => String(value ?? '').trim();
const toCreatePLearningCoursePayload = (body) => ({
  title: toStringOrEmpty(body?.title),
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  points: body?.points,
  sortOrder: body?.sortOrder,
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  contentType: body?.contentType,
  sourceType: body?.sourceType,
  videoChannelMeta: body?.videoChannelMeta,
  status: body?.status,
  level: body?.level,
  content: body?.content,
  media: Array.isArray(body?.media) ? body.media : [],
  uploadItems: Array.isArray(body?.uploadItems) ? body.uploadItems : [],
  coverUrl: body?.coverUrl,
});
const toCreatePActivityPayload = (body) => ({
  title: toStringOrEmpty(body?.title),
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  content: body?.content,
  media: Array.isArray(body?.media) ? body.media : [],
  uploadItems: Array.isArray(body?.uploadItems) ? body.uploadItems : [],
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  status: body?.status,
});

const toCreatePLearningCourseSharedDeps = ({ actor, tenantContext, headers, protocol, host, deps }) => ({
  protocol: String(headers?.['x-forwarded-proto'] || protocol || 'http'),
  host: String(headers?.['x-forwarded-host'] || host || '127.0.0.1:4000'),
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
  uploadDeps: deps.uploadDeps || null,
});
const toCreatePActivitySharedDeps = ({ actor, tenantContext, headers, protocol, host, deps }) => ({
  protocol: String(headers?.['x-forwarded-proto'] || protocol || 'http'),
  host: String(headers?.['x-forwarded-host'] || host || '127.0.0.1:4000'),
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
  uploadDeps: deps.uploadDeps || null,
});

export const toSignInCommand = ({ user, actor }) => ({
  userId: Number(user?.id || 0),
  tenantId: Number(user?.tenantId || actor?.tenantId || 1),
  isVerifiedBasic: Boolean(user?.isVerifiedBasic),
  actor,
});

export const toActivityCompleteCommand = ({ params, query, user, actor }) => ({
  activityId: toInt(params?.id, 0),
  shareCode: toStringOrEmpty(query?.shareCode) || null,
  userId: Number(user?.id || 0),
  isVerifiedBasic: Boolean(user?.isVerifiedBasic),
  actor,
});

export const toRedemptionWriteoffCommand = ({ params, body, user }) => ({
  redemptionId: toStringOrEmpty(params?.id),
  token: toStringOrEmpty(body?.token),
  userId: Number(user?.id || 0),
  tenantId: toInt(user?.tenantId, 1),
});

export const toRedeemCommand = ({ body, user, tenantContext, actor }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  customerId: Number(user?.id || 0),
  isVerifiedBasic: Boolean(user?.isVerifiedBasic),
  itemId: toInt(body?.itemId, 0),
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  actor,
});

export const toCreateOrderCommand = ({ body, user, tenantContext, actor }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  customerId: Number(user?.id || 0),
  productId: toInt(body?.productId, 0),
  quantity: Math.max(1, toInt(body?.quantity, 1)),
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  actor,
});

export const toPayOrderCommand = ({ params, body, user, tenantContext, actor }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  customerId: Number(user?.id || 0),
  orderId: toInt(params?.id, 0),
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  actor,
});

export const toCancelOrderCommand = ({ params, body, user, tenantContext, actor }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  customerId: Number(user?.id || 0),
  orderId: toInt(params?.id, 0),
  reason: toStringOrEmpty(body?.reason),
  actor,
});

export const toRefundOrderCommand = ({ params, body, user, tenantContext, actor }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  operatorId: Number(user?.id || 0),
  orderId: toInt(params?.id, 0),
  reason: toStringOrEmpty(body?.reason) || 'customer_refund',
  actor,
});

export const toCreateBActivityConfigCommand = ({ body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  title: toStringOrEmpty(body?.title),
  category: toStringOrEmpty(body?.category) || 'task',
  desc: String(body?.desc ?? ''),
  rewardPoints: toInt(body?.rewardPoints, 0),
  sortOrder: toInt(body?.sortOrder, 1),
  status: toStringOrEmpty(body?.status) || 'online',
  media: Array.isArray(body?.media) ? body.media : [],
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  actor,
  getState: deps.getState,
  hasRole: deps.hasRole,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toUpdateBActivityConfigCommand = ({ params, body, actor, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  category: body?.category,
  desc: body?.desc,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  status: body?.status,
  media: body?.media,
  actor,
  getState: deps.getState,
  canAccessTemplate: deps.canAccessTemplate,
  persistState: deps.persistState,
});

export const toCreateBMallProductCommand = ({ body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  name: toStringOrEmpty(body?.name) || toStringOrEmpty(body?.title),
  title: body?.title,
  desc: body?.desc,
  points: body?.points,
  pointsCost: body?.pointsCost,
  stock: body?.stock,
  sortOrder: body?.sortOrder,
  status: body?.status,
  media: Array.isArray(body?.media) ? body.media : [],
  actor,
  getState: deps.getState,
  hasRole: deps.hasRole,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toUpdateBMallProductCommand = ({ params, body, actor, deps }) => ({
  id: toInt(params?.id, 0),
  name: body?.name,
  title: body?.title,
  desc: body?.desc,
  description: body?.description,
  points: body?.points,
  pointsCost: body?.pointsCost,
  stock: body?.stock,
  sortOrder: body?.sortOrder,
  status: body?.status,
  media: body?.media,
  actor,
  getState: deps.getState,
  canAccessTemplate: deps.canAccessTemplate,
  persistState: deps.persistState,
});

export const toCreateBMallActivityCommand = ({ body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  title: toStringOrEmpty(body?.title),
  type: body?.type,
  desc: body?.desc,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  status: body?.status,
  media: Array.isArray(body?.media) ? body.media : [],
  actor,
  getState: deps.getState,
  hasRole: deps.hasRole,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toUpdateBMallActivityCommand = ({ params, body, actor, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  displayTitle: body?.displayTitle,
  type: body?.type,
  desc: body?.desc,
  description: body?.description,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  status: body?.status,
  media: body?.media,
  actor,
  getState: deps.getState,
  canAccessTemplate: deps.canAccessTemplate,
  persistState: deps.persistState,
});

export const toCreatePTeamCommand = ({ body, actor, tenantContext, deps }) => ({
  name: toStringOrEmpty(body?.name),
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toUpdatePTeamCommand = ({ params, body, actor, tenantContext, deps }) => ({
  teamId: toInt(params?.id, 0),
  name: toStringOrEmpty(body?.name),
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  persistState: deps.persistState,
});

export const toDeletePTeamCommand = ({ params, actor, tenantContext, deps }) => ({
  teamId: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  persistState: deps.persistState,
});

export const toCreatePEmployeeCommand = ({ body, actor, tenantContext, deps }) => ({
  name: toStringOrEmpty(body?.name),
  email: toStringOrEmpty(body?.email),
  mobile: toStringOrEmpty(body?.mobile),
  role: toStringOrEmpty(body?.role) || 'salesperson',
  initialPassword: toStringOrEmpty(body?.initialPassword) || '123456',
  teamId: toInt(body?.teamId, 0),
  orgId: toInt(body?.orgId, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  ensureTenantTeams: deps.ensureTenantTeams,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toUpdatePEmployeeCommand = ({ params, body, actor, tenantContext, deps }) => ({
  employeeId: toInt(params?.id, 0),
  name: body?.name,
  email: body?.email,
  mobile: body?.mobile,
  role: body?.role,
  teamId: body?.teamId,
  orgId: body?.orgId,
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  ensureTenantTeams: deps.ensureTenantTeams,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toDeletePEmployeeCommand = ({ params, actor, tenantContext, deps }) => ({
  employeeId: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  persistState: deps.persistState,
});

export const toCreateTenantCommand = ({ body, actor, tenantContext, deps }) => ({
  name: toStringOrEmpty(body?.name),
  type: toStringOrEmpty(body?.type) || 'company',
  status: toStringOrEmpty(body?.status) || 'active',
  adminEmail: toStringOrEmpty(body?.adminEmail).toLowerCase(),
  initialPassword: toStringOrEmpty(body?.initialPassword),
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  appendAuditLog: deps.appendAuditLog,
});

export const toUpdateTenantCommand = ({ params, body, actor, tenantContext, deps }) => ({
  tenantId: toInt(params?.id, 0),
  name: body?.name,
  type: body?.type,
  status: body?.status,
  adminEmail: body?.adminEmail,
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toDeleteTenantCommand = ({ params, actor, tenantContext, deps }) => ({
  tenantId: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toCreateApprovalCommand = ({ body, actor, tenantContext, deps }) => ({
  requestType: toStringOrEmpty(body?.requestType) || 'customer_detail_view',
  requesterUserType: toStringOrEmpty(body?.requesterUserType) || 'employee',
  requesterUserId: toInt(body?.requesterUserId, Number(actor?.actorId || 0)),
  reason: String(body?.reason || ''),
  scope: body?.scope || {},
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toApproveApprovalCommand = ({ params, actor, tenantContext, deps }) => ({
  approvalId: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
});

export const toUpdateCompanyAdminPagesCommand = ({ body, actor, tenantContext, deps }) => ({
  requestedTenantId: toInt(body?.tenantId, 0),
  grants: Array.isArray(body?.grants) ? body.grants : [],
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  allCompanyAdminPageIds: deps.allCompanyAdminPageIds,
  nextId: deps.nextId,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
});

export const toUpdateEmployeeRolePagesCommand = ({ body, actor, tenantContext, deps }) => ({
  requestedTenantId: toInt(body?.tenantId, 0),
  roleKey: toStringOrEmpty(body?.roleKey),
  grants: Array.isArray(body?.grants) ? body.grants : [],
  dataPermissions: body?.dataPermissions ?? null,
  actor,
  tenantContext,
  getState: deps.getState,
  hasRole: deps.hasRole,
  nextId: deps.nextId,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
  configurableRoleKeys: deps.configurableEmployeeRoleKeys,
  allEmployeeRolePageIds: deps.allEmployeeRolePageIds,
  resolveEmployeeRolePageIdsForTenant: deps.resolveEmployeeRolePageIdsForTenant,
  normalizeEmployeeRoleKey: deps.normalizeEmployeeRoleKey,
});

export const toSaveEventDefinitionCommand = ({ body, actor, tenantContext, deps }) => ({
  id: toInt(body?.id, 0),
  eventId: toInt(body?.eventId, 0),
  eventName: toStringOrEmpty(body?.eventName),
  eventType: body?.eventType,
  description: body?.description,
  collectMethod: body?.collectMethod,
  status: body?.status,
  schema: body?.schema,
  syncSchemaWithEvent: Boolean(body?.syncSchemaWithEvent),
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  appendAuditLog: deps.appendAuditLog,
  normalizeEventType: deps.normalizeEventType,
  normalizeCollectMethod: deps.normalizeCollectMethod,
  normalizeEventStatus: deps.normalizeEventStatus,
  normalizeDefinitionVersion: deps.normalizeDefinitionVersion,
  eventSchemaTemplateById: deps.eventSchemaTemplateById,
  toEventStatusCode: deps.toEventStatusCode,
});

export const toUpdateEventDefinitionStatusCommand = ({ params, body, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  status: body?.status,
  tenantContext,
  getState: deps.getState,
  normalizeEventStatus: deps.normalizeEventStatus,
  normalizeDefinitionVersion: deps.normalizeDefinitionVersion,
  persistState: deps.persistState,
});

export const toDeleteEventDefinitionCommand = ({ params, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  tenantContext,
  getState: deps.getState,
  normalizeEventType: deps.normalizeEventType,
  persistState: deps.persistState,
});

export const toCreateMetricRuleCommand = ({ body, actor, tenantContext, deps }) => ({
  name: toStringOrEmpty(body?.name),
  formula: toStringOrEmpty(body?.formula),
  period: toStringOrEmpty(body?.period),
  source: toStringOrEmpty(body?.source),
  end: body?.end,
  status: body?.status,
  threshold: body?.threshold,
  remark: body?.remark,
  remarkMode: body?.remarkMode,
  remark_mode: body?.remark_mode,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
  normalizeMetricEnd: deps.normalizeMetricEnd,
  normalizeMetricRuleStatus: deps.normalizeMetricRuleStatus,
  normalizeMetricRemarkMode: deps.normalizeMetricRemarkMode,
  normalizeRuleVersion: deps.normalizeRuleVersion,
  buildMetricRuleRemark: deps.buildMetricRuleRemark,
  metricRuleKey: deps.metricRuleKey,
});

export const toUpdateMetricRuleCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  name: body?.name,
  formula: body?.formula,
  period: body?.period,
  source: body?.source,
  end: body?.end,
  status: body?.status,
  threshold: body?.threshold,
  remark: body?.remark,
  remarkMode: body?.remarkMode,
  remark_mode: body?.remark_mode,
  actor,
  tenantContext,
  getState: deps.getState,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
  normalizeMetricEnd: deps.normalizeMetricEnd,
  normalizeMetricRuleStatus: deps.normalizeMetricRuleStatus,
  normalizeMetricRemarkMode: deps.normalizeMetricRemarkMode,
  normalizeRuleVersion: deps.normalizeRuleVersion,
  buildMetricRuleRemark: deps.buildMetricRuleRemark,
  metricRuleKey: deps.metricRuleKey,
});

export const toDeleteMetricRuleCommand = ({ params, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toSavePTagCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(body?.id ?? params?.id, 0),
  tagCode: toStringOrEmpty(body?.tagCode),
  tagName: toStringOrEmpty(body?.tagName),
  tagType: body?.tagType,
  source: body?.source,
  description: body?.description,
  status: body?.status,
  valueSchema: body?.valueSchema,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  normalizeTagType: deps.normalizeTagType,
  normalizeTagStatus: deps.normalizeTagStatus,
});

export const toUpdatePTagStatusCommand = ({ params, body, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  status: body?.status,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  normalizeTagStatus: deps.normalizeTagStatus,
});

export const toDeletePTagCommand = ({ params, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toSavePTagRuleCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(body?.id ?? params?.id, 0),
  ruleCode: toStringOrEmpty(body?.ruleCode),
  ruleName: toStringOrEmpty(body?.ruleName),
  targetTagId: toInt(body?.targetTagId, 0),
  targetTagIds: Array.isArray(body?.targetTagIds) ? body.targetTagIds : [],
  priority: body?.priority,
  status: body?.status,
  conditionDsl: body?.conditionDsl,
  outputExpr: body?.outputExpr,
  effectiveStartAt: body?.effectiveStartAt,
  effectiveEndAt: body?.effectiveEndAt,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  normalizeTagRuleStatus: deps.normalizeTagRuleStatus,
});

export const toUpdatePTagRuleStatusCommand = ({ params, body, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  status: body?.status,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  normalizeTagRuleStatus: deps.normalizeTagRuleStatus,
});

export const toDeletePTagRuleCommand = ({ params, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toCreatePTagRuleJobCommand = ({ body, tenantContext, deps }) => ({
  jobType: body?.jobType,
  triggerType: body?.triggerType,
  scope: body?.scope,
  targetRuleIds: Array.isArray(body?.targetRuleIds) ? body.targetRuleIds : [],
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  ensureTagSeeds: deps.ensureTagSeeds,
  collectCustomerIdsForTagJob: deps.collectCustomerIdsForTagJob,
  buildTagJobCustomerMetrics: deps.buildTagJobCustomerMetrics,
  evaluateTagRuleByCustomer: deps.evaluateTagRuleByCustomer,
  resolveTagRuleOutputValue: deps.resolveTagRuleOutputValue,
});

export const toAddBCustomerTagCommand = ({ params, body, actor, tenantContext, dataScope, deps }) => ({
  customerId: toInt(params?.id, 0),
  tagName: toStringOrEmpty(body?.tag),
  actor,
  tenantContext,
  dataScope,
  getState: deps.getState,
  nextId: deps.nextId,
  appendAuditLog: deps.appendAuditLog,
  persistState: deps.persistState,
});

export const toCreateBCustomTagCommand = ({ body, actor, tenantContext, deps }) => ({
  name: toStringOrEmpty(body?.name),
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
});

export const toCreatePLearningCourseCommand = ({ body, actor, tenantContext, headers, protocol, host, deps }) => ({
  ...toCreatePLearningCoursePayload(body),
  ...toCreatePLearningCourseSharedDeps({ actor, tenantContext, headers, protocol, host, deps }),
});

export const toCreatePLearningCourseBatchCommand = ({ body, actor, tenantContext, headers, protocol, host, deps }) => ({
  idempotencyKey: toStringOrEmpty(body?.idempotencyKey) || null,
  items: Array.isArray(body?.items) ? body.items.map((item) => toCreatePLearningCoursePayload(item)) : [],
  ...toCreatePLearningCourseSharedDeps({ actor, tenantContext, headers, protocol, host, deps }),
});

export const toUpdatePLearningCourseCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  points: body?.points,
  sortOrder: body?.sortOrder,
  contentType: body?.contentType,
  sourceType: body?.sourceType,
  videoChannelMeta: body?.videoChannelMeta,
  status: body?.status,
  level: body?.level,
  content: body?.content,
  coverUrl: body?.coverUrl,
  media: body?.media,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePLearningCourseCommand = ({ params, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePLearningCourseBatchCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toReorderPLearningCoursesCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toCreatePActivityCommand = ({ body, actor, tenantContext, headers, protocol, host, deps }) => ({
  ...toCreatePActivityPayload(body),
  ...toCreatePActivitySharedDeps({ actor, tenantContext, headers, protocol, host, deps }),
});

export const toUpdatePActivityCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  content: body?.content,
  media: body?.media,
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePActivityCommand = ({ params, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePActivityBatchCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toReorderPActivitiesCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toCreatePMallProductCommand = ({ body, actor, tenantContext, deps }) => ({
  title: toStringOrEmpty(body?.title),
  points: body?.points,
  pointsCost: body?.pointsCost,
  stock: body?.stock,
  sortOrder: body?.sortOrder,
  category: body?.category,
  description: body?.description,
  limitPerUser: body?.limitPerUser,
  vipOnly: body?.vipOnly,
  enableCountdown: body?.enableCountdown,
  media: Array.isArray(body?.media) ? body.media : [],
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
});

export const toUpdatePMallProductCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  points: body?.points,
  pointsCost: body?.pointsCost,
  stock: body?.stock,
  sortOrder: body?.sortOrder,
  category: body?.category,
  description: body?.description,
  limitPerUser: body?.limitPerUser,
  vipOnly: body?.vipOnly,
  enableCountdown: body?.enableCountdown,
  media: body?.media,
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePMallProductCommand = ({ params, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toReorderPMallProductsCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toCreatePMallActivityCommand = ({ body, actor, tenantContext, deps }) => ({
  title: toStringOrEmpty(body?.title),
  displayTitle: body?.displayTitle,
  type: body?.type,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  description: body?.description,
  media: Array.isArray(body?.media) ? body.media : [],
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
});

export const toUpdatePMallActivityCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  displayTitle: body?.displayTitle,
  type: body?.type,
  rewardPoints: body?.rewardPoints,
  sortOrder: body?.sortOrder,
  description: body?.description,
  media: body?.media,
  status: body?.status,
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toDeletePMallActivityCommand = ({ params, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toReorderPMallActivitiesCommand = ({ body, actor, tenantContext, deps }) => ({
  ids: Array.isArray(body?.ids) ? body.ids.map((id) => toInt(id, 0)) : [],
  actor,
  tenantContext,
  getState: deps.getState,
  persistState: deps.persistState,
  canOperateTenantTemplates: deps.canOperateTenantTemplates,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toCreateBContentItemCommand = ({ body, actor, tenantContext, deps }) => ({
  title: toStringOrEmpty(body?.title),
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  points: body?.points,
  contentType: body?.contentType,
  status: body?.status,
  level: body?.level,
  body: body?.body,
  sortOrder: body?.sortOrder,
  coverUrl: body?.coverUrl,
  media: Array.isArray(body?.media) ? body.media : [],
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
});

export const toUpdateBContentItemCommand = ({ params, body, actor, tenantContext, deps }) => ({
  id: toInt(params?.id, 0),
  title: body?.title,
  category: body?.category,
  rewardPoints: body?.rewardPoints,
  points: body?.points,
  contentType: body?.contentType,
  status: body?.status,
  level: body?.level,
  body: body?.body,
  sortOrder: body?.sortOrder,
  coverUrl: body?.coverUrl,
  media: body?.media,
  actor,
  tenantContext,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  hasRole: deps.hasRole,
  canAccessTemplate: deps.canAccessTemplate,
});

export const toSendAuthCodeCommand = ({ body, tenant, deps }) => ({
  mobile: toStringOrEmpty(body?.mobile),
  lookupOnly: Boolean(body?.lookupOnly),
  tenant,
  getState: deps.getState,
  nextId: deps.nextId,
  persistState: deps.persistState,
  persistSmsCodesByIds: deps.persistSmsCodesByIds,
  dateOnly: deps.dateOnly,
});

export const toBAdminLoginCommand = ({ body, deps }) => ({
  account: toStringOrEmpty(body?.account),
  password: toStringOrEmpty(body?.password),
  getState: deps.getState,
  createActorSession: deps.createActorSession,
  persistSessionsByTokens: deps.persistSessionsByTokens,
  persistState: deps.persistState,
  resolveSessionFromBearer: deps.resolveSessionFromBearer,
  upsertActorCsrfToken: deps.upsertActorCsrfToken,
});

export const toPAdminLoginCommand = ({ body, deps }) => ({
  account: toStringOrEmpty(body?.account),
  password: toStringOrEmpty(body?.password),
  getState: deps.getState,
  createActorSession: deps.createActorSession,
  persistSessionsByTokens: deps.persistSessionsByTokens,
  persistState: deps.persistState,
  resolveSessionFromBearer: deps.resolveSessionFromBearer,
  upsertActorCsrfToken: deps.upsertActorCsrfToken,
});

export const toVerifyBasicCommand = ({ body, headers, tenant, deps }) => ({
  name: toStringOrEmpty(body?.name),
  mobile: toStringOrEmpty(body?.mobile),
  code: toStringOrEmpty(body?.code),
  openId: toStringOrEmpty(body?.openId),
  unionId: toStringOrEmpty(body?.unionId),
  appType: toStringOrEmpty(body?.appType),
  tenant,
  userAgent: String(headers?.['user-agent'] || ''),
  getState: deps.getState,
  nextId: deps.nextId,
  createSession: deps.createSession,
  formatUser: deps.formatUser,
  persistState: deps.persistState,
  persistCustomersByIds: deps.persistCustomersByIds,
  persistSessionsByTokens: deps.persistSessionsByTokens,
  persistSmsCodesByIds: deps.persistSmsCodesByIds,
  persistPointTransactionsByIds: deps.persistPointTransactionsByIds,
  recordPoints: deps.recordPoints,
});

export const toResolveWechatIdentityCommand = ({ body, deps }) => ({
  openId: toStringOrEmpty(body?.openId),
  unionId: toStringOrEmpty(body?.unionId),
  appType: toStringOrEmpty(body?.appType),
  getState: deps.getState,
});

export const toBindWechatIdentityCommand = ({ body, user, deps }) => ({
  customerId: toInt(body?.customerId, Number(user?.id || 0)),
  actorCustomerId: Number(user?.id || 0),
  openId: toStringOrEmpty(body?.openId),
  unionId: toStringOrEmpty(body?.unionId),
  appType: toStringOrEmpty(body?.appType),
  getState: deps.getState,
  persistState: deps.persistState,
});

export const toResolveWechatH5SessionCommand = ({ body, deps }) => ({
  code: toStringOrEmpty(body?.code),
  openId: toStringOrEmpty(body?.openId),
  unionId: toStringOrEmpty(body?.unionId),
  appType: toStringOrEmpty(body?.appType),
  getState: deps.getState,
  createSession: deps.createSession,
  formatUser: deps.formatUser,
  persistState: deps.persistState,
  resolveWechatH5IdentityByCode: deps.resolveWechatH5IdentityByCode,
});

export const toCreateInsurancePolicyCommand = ({ body, user, deps }) => ({
  customerId: Number(body?.customerId || 0),
  company: body?.company,
  name: body?.name,
  type: body?.type,
  applicant: body?.applicant,
  applicantRelation: body?.applicantRelation,
  insured: body?.insured,
  insuredRelation: body?.insuredRelation,
  date: body?.date,
  paymentPeriod: body?.paymentPeriod,
  coveragePeriod: body?.coveragePeriod,
  amount: body?.amount,
  firstPremium: body?.firstPremium,
  analysis: body?.analysis || null,
  userId: Number(user?.id || 0),
  actorType: String(user?.actorType || 'customer'),
  tenantId: Number(user?.tenantId || 1),
  getState: deps.getState,
  nextId: deps.nextId,
  persistPoliciesByIds: deps.persistPoliciesByIds,
  persistState: deps.persistState,
  inferPolicyType: deps.inferPolicyType,
  nextPaymentDate: deps.nextPaymentDate,
  calcPeriodEnd: deps.calcPeriodEnd,
  defaultResponsibilities: deps.defaultResponsibilities,
  refreshInsuranceSummaryFromState: deps.refreshInsuranceSummaryFromState,
});

export const toUpdateInsurancePolicyCommand = ({ params, body, user, deps }) => ({
  policyId: Number(params?.id || 0),
  customerId: Number(body?.customerId || 0),
  company: body?.company,
  name: body?.name,
  type: body?.type,
  applicant: body?.applicant,
  applicantRelation: body?.applicantRelation,
  insured: body?.insured,
  insuredRelation: body?.insuredRelation,
  date: body?.date,
  paymentPeriod: body?.paymentPeriod,
  coveragePeriod: body?.coveragePeriod,
  amount: body?.amount,
  firstPremium: body?.firstPremium,
  analysis: body?.analysis || null,
  userId: Number(user?.id || 0),
  actorType: String(user?.actorType || 'customer'),
  tenantId: Number(user?.tenantId || 1),
  getState: deps.getState,
  persistPoliciesByIds: deps.persistPoliciesByIds,
  persistState: deps.persistState,
  inferPolicyType: deps.inferPolicyType,
  nextPaymentDate: deps.nextPaymentDate,
  calcPeriodEnd: deps.calcPeriodEnd,
  defaultResponsibilities: deps.defaultResponsibilities,
  refreshInsuranceSummaryFromState: deps.refreshInsuranceSummaryFromState,
});

export const toDeleteInsurancePolicyCommand = ({ params, deps }) => ({
  policyId: Number(params?.id || 0),
  getState: deps.getState,
  persistPoliciesByIds: deps.persistPoliciesByIds,
  persistState: deps.persistState,
  refreshInsuranceSummaryFromState: deps.refreshInsuranceSummaryFromState,
});

export const toScanInsurancePolicyCommand = ({ body, deps }) => ({
  ocrText: toStringOrEmpty(body?.ocrText),
  uploadItem: body?.uploadItem
    ? {
        name: toStringOrEmpty(body.uploadItem?.name),
        type: toStringOrEmpty(body.uploadItem?.type),
        dataUrl: toStringOrEmpty(body.uploadItem?.dataUrl),
      }
    : null,
  scanInsurancePolicy: deps.scanInsurancePolicy,
});

export const toTrackEventCommand = ({ body, actor, headers, tenantContext, deps }) => ({
  event: toStringOrEmpty(body?.event),
  properties: body?.properties,
  actorType: actor?.actorType || 'anonymous',
  actorId: Number(actor?.actorId || 0),
  tenantId: toInt(tenantContext?.tenantId, 0),
  orgId: toInt(tenantContext?.orgId, 0),
  teamId: toInt(tenantContext?.teamId, 0),
  path: String(headers?.['x-client-path'] || ''),
  source: String(headers?.['x-client-source'] || 'web'),
  userAgent: String(headers?.['user-agent'] || ''),
  appendTrackEvent: deps.appendTrackEvent,
});

export const toTouchMeCommand = ({ user, headers, deps }) => ({
  user,
  userAgent: String(headers?.['user-agent'] || ''),
  persistState: deps.persistState,
});

export const toLearningCompleteCommand = ({ params, body, query, user, actor }) => ({
  courseId: toInt(params?.id, 0),
  userId: Number(user?.id || 0),
  completionSource: toStringOrEmpty(body?.completionSource) || null,
  videoProgressPercent: Math.max(0, Math.min(100, toInt(body?.videoProgressPercent, 0) || 0)),
  videoWatchedSeconds: Math.max(0, toInt(body?.videoWatchedSeconds, 0) || 0),
  videoDurationSeconds: Math.max(0, toInt(body?.videoDurationSeconds, 0) || 0),
  videoEnded: toBoolean(body?.videoEnded),
  videoChannelOpened: toBoolean(body?.videoChannelOpened),
  articleDwellSeconds: Math.max(0, toInt(body?.articleDwellSeconds, 0) || 0),
  articleReachedEnd: toBoolean(body?.articleReachedEnd),
  shareCode: toStringOrEmpty(query?.shareCode) || null,
  actor,
});

export const toUploadBase64Command = ({ body, tenantContext, headers, protocol, host, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 0),
  dataUrl: toStringOrEmpty(body?.dataUrl),
  type: toStringOrEmpty(body?.type),
  name: toStringOrEmpty(body?.name) || 'upload',
  protocol: String(headers?.['x-forwarded-proto'] || protocol || 'http'),
  host: String(headers?.['x-forwarded-host'] || host || '127.0.0.1:4000'),
  uploadsRoot: deps.uploadsRoot,
  mkdirRecursive: deps.mkdirRecursive,
  writeFileBuffer: deps.writeFileBuffer,
  nowMs: deps.nowMs,
  randomHex: deps.randomHex,
});

export const toBOrderWriteoffCommand = ({ params, body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  orderId: toInt(params?.id, 0),
  orderType: toStringOrEmpty(body?.orderType),
  sourceRecordId: toInt(body?.sourceRecordId, 0),
  operatorAgentId: Number(actor?.actorId || 0),
  token: toStringOrEmpty(body?.token),
  actor,
  fulfillOrderWriteoff: deps.fulfillOrderWriteoff,
});

export const toPRefundOrderCommand = ({ params, body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  orderId: toInt(params?.id, 0),
  operatorId: Number(actor?.actorId || 0),
  reason: toStringOrEmpty(body?.reason) || 'ops_refund',
  actor,
  refundOrder: deps.refundOrder,
});

export const toPRebuildStatsCommand = ({ body, deps }) => ({
  day: toStringOrEmpty(body?.day) || new Date().toISOString().slice(0, 10),
  rebuildDailySnapshot: deps.rebuildDailySnapshot,
});

export const toPRunReconciliationCommand = ({ body, deps }) => ({
  day: toStringOrEmpty(body?.day) || new Date().toISOString().slice(0, 10),
  runReconciliation: deps.runReconciliation,
});

export const toCreatePOpsAsyncJobCommand = ({ body, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  actorId: Number(actor?.actorId || 0) || 0,
  jobType: toStringOrEmpty(body?.jobType),
  payload: body?.payload,
  maxAttempts: toInt(body?.maxAttempts, 3),
  enqueueOpsAsyncJob: deps.enqueueOpsAsyncJob,
});

export const toRetryPOpsAsyncJobCommand = ({ params, actor, tenantContext, deps }) => ({
  tenantId: toInt(tenantContext?.tenantId, 1),
  actorId: Number(actor?.actorId || 0) || 0,
  jobId: toInt(params?.id, 0),
  retryOpsAsyncJob: deps.retryOpsAsyncJob,
});

export const toRunPOpsAsyncJobWorkerCommand = ({ body, deps }) => ({
  limit: Math.max(1, toInt(body?.limit, 5)),
  runOpsAsyncJobWorkerOnce: deps.runOpsAsyncJobWorkerOnce,
});
