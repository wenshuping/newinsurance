export type ContentStatus = 'published' | 'draft' | 'inactive';
export type OnlineStatus = 'online' | 'draft' | 'offline';
export type RunningStatus = 'active' | 'draft' | 'inactive';
export type LearningStatus = 'published' | 'draft' | 'inactive';
export type EnabledStatus = 'enabled' | 'disabled' | 'draft';
export type TagStatus = 'active' | 'disabled' | 'draft';
export type ActiveStatus = 'active' | 'inactive' | 'draft';
export type TenantStatus = 'active' | 'inactive';
export type OnlineStatusFilter = 'all' | OnlineStatus;
export type RunningStatusFilter = 'all' | RunningStatus;
export type ContentStatusFilter = 'all' | ContentStatus;
export type ContentRunningStatusFilter = 'all' | ContentStatus | RunningStatus;
export type EnabledStatusFilter = 'all' | EnabledStatus;
export type TagStatusFilter = 'all' | TagStatus;

function norm(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeContentStatus(value?: string): ContentStatus {
  const s = norm(value);
  if (['published', 'online', 'active', 'ongoing', 'on', '已发布', '进行中', '生效'].includes(s)) return 'published';
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  if (['inactive', 'offline', 'off', '失效', 'expired', 'ended', '已下线', '已结束', 'disabled'].includes(s)) return 'inactive';
  return 'draft';
}

export function normalizeRunningStatus(value?: string): RunningStatus {
  const s = norm(value);
  if (['active', 'online', 'published', 'ongoing', 'on', '进行中', '已发布', '生效', 'enabled'].includes(s)) return 'active';
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  if (['inactive', 'offline', 'off', '失效', 'expired', 'ended', '已下线', '已结束', 'disabled'].includes(s)) return 'inactive';
  return 'draft';
}

export function toOnlineStatus(value: unknown): OnlineStatus {
  const s = norm(value);
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  if (['offline', 'inactive', 'disabled', 'ended', 'expired', '失效', '已下线', '已结束', 'off'].includes(s)) return 'offline';
  return 'online';
}

export function toActivityOnlineStatus(status: unknown, canComplete?: boolean): OnlineStatus {
  if (canComplete === false) return 'offline';
  return toOnlineStatus(status);
}

export function toRunningStatus(value: unknown): RunningStatus {
  return normalizeRunningStatus(String(value || ''));
}

export function isRunningStatusActive(value: unknown): boolean {
  return toRunningStatus(value) === 'active';
}

export function toLearningStatus(value: unknown): LearningStatus {
  const s = norm(value);
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  if (['inactive', 'offline', 'disabled', 'ended', 'expired', '失效', '已下线', '已结束', 'off'].includes(s)) return 'inactive';
  return 'published';
}

export function toContentStatusLabel(value?: string) {
  const normalized = normalizeContentStatus(value);
  if (normalized === 'published') return '已发布';
  if (normalized === 'inactive') return '失效';
  return '草稿';
}

export function toRunningStatusLabel(value?: string) {
  const normalized = normalizeRunningStatus(value);
  if (normalized === 'active') return '进行中';
  if (normalized === 'inactive') return '失效';
  return '草稿';
}

export function contentStatusPillClass(value?: string) {
  const normalized = normalizeContentStatus(value);
  if (normalized === 'published') return 'bg-emerald-500 text-white';
  if (normalized === 'inactive') return 'bg-rose-500 text-white';
  return 'bg-amber-400 text-slate-900';
}

export function contentStatusSoftPillClass(value?: string) {
  const normalized = normalizeContentStatus(value);
  if (normalized === 'published') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'inactive') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}

export function runningStatusPillClass(value?: string) {
  const normalized = normalizeRunningStatus(value);
  if (normalized === 'active') return 'bg-primary text-white';
  if (normalized === 'inactive') return 'bg-slate-400 text-white';
  return 'bg-amber-400 text-slate-900';
}

export function runningStatusSoftPillClass(value?: string) {
  const normalized = normalizeRunningStatus(value);
  if (normalized === 'active') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'inactive') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-100 text-amber-700';
}

export function onlineStatusLabel(value: unknown) {
  const s = toOnlineStatus(value);
  if (s === 'draft') return '草稿';
  if (s === 'offline') return '已下线';
  return '进行中';
}

export function onlineStatusClass(value: unknown) {
  const s = toOnlineStatus(value);
  if (s === 'draft') return 'bg-gray-100 text-gray-600';
  if (s === 'offline') return 'bg-red-100 text-red-600';
  return 'bg-emerald-100 text-emerald-700';
}

export function runningStatusLabel(value: unknown) {
  const s = toRunningStatus(value);
  if (s === 'draft') return '草稿';
  if (s === 'inactive') return '已下架';
  return '进行中';
}

export function runningListStatusLabel(value: unknown) {
  return toRunningStatus(value) === 'active' ? '进行中' : '已结束';
}

export function learningStatusLabel(value: unknown) {
  const s = toLearningStatus(value);
  if (s === 'draft') return '草稿';
  if (s === 'inactive') return '失效';
  return '已发布';
}

export function normalizeEnabledStatus(value: unknown): EnabledStatus {
  const s = norm(value);
  if (['disabled', 'inactive', 'off', '禁用', '停用', '失效'].includes(s)) return 'disabled';
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  return 'enabled';
}

export function enabledStatusLabel(value: unknown) {
  const s = normalizeEnabledStatus(value);
  if (s === 'disabled') return '禁用';
  if (s === 'draft') return '草稿';
  return '启用';
}

export function enabledStatusPillClass(value: unknown) {
  const s = normalizeEnabledStatus(value);
  if (s === 'disabled') return 'bg-gray-100 text-gray-500';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

export function enabledRuntimeStatusLabel(value: unknown) {
  const s = normalizeEnabledStatus(value);
  if (s === 'disabled') return '已禁用';
  if (s === 'draft') return '草稿';
  return '生效中';
}

export function enabledToggleActionLabel(value: unknown) {
  return normalizeEnabledStatus(value) === 'enabled' ? '禁用' : '启用';
}

export function normalizeTagStatus(value: unknown): TagStatus {
  const s = norm(value);
  if (['active', 'enabled', '启用', '生效'].includes(s)) return 'active';
  if (['disabled', 'inactive', '禁用', '停用', '失效'].includes(s)) return 'disabled';
  return 'draft';
}

export function tagStatusLabel(value: unknown) {
  const s = normalizeTagStatus(value);
  if (s === 'active') return '启用';
  if (s === 'disabled') return '禁用';
  return '草稿';
}

export function tagStatusPillClass(value: unknown) {
  const s = normalizeTagStatus(value);
  if (s === 'active') return 'bg-emerald-100 text-emerald-700';
  if (s === 'disabled') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-100 text-amber-700';
}

export function tagRuleStatusLabel(value: unknown) {
  const s = normalizeTagStatus(value);
  if (s === 'active') return '生效中';
  if (s === 'disabled') return '已禁用';
  return '草稿';
}

export function tagRuleStatusTextClass(value: unknown) {
  return normalizeTagStatus(value) === 'active' ? 'text-gray-600' : 'text-gray-400';
}

export function tagToggleActionLabel(value: unknown) {
  return normalizeTagStatus(value) === 'active' ? '禁用' : '启用';
}

export function normalizeActiveStatus(value: unknown): ActiveStatus {
  const s = norm(value);
  if (['draft', '草稿', '未发布'].includes(s)) return 'draft';
  if (['inactive', 'disabled', 'off', '停用', '失效', '已下线'].includes(s)) return 'inactive';
  return 'active';
}

export function activeStatusLabel(value: unknown) {
  const s = normalizeActiveStatus(value);
  if (s === 'inactive') return '停用';
  if (s === 'draft') return '草稿';
  return '启用';
}

export function activeStatusPillClass(value: unknown) {
  const s = normalizeActiveStatus(value);
  if (s === 'active') return 'bg-emerald-100 text-emerald-700';
  if (s === 'inactive') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-100 text-amber-700';
}

export function normalizeTenantStatus(value: unknown): TenantStatus {
  const s = norm(value);
  if (['inactive', 'disabled', 'off', '停用', '失效', '未激活'].includes(s)) return 'inactive';
  return 'active';
}

export function tenantStatusLabel(value: unknown) {
  return normalizeTenantStatus(value) === 'active' ? '已激活' : '未激活';
}

export function tenantStatusPillClass(value: unknown) {
  return normalizeTenantStatus(value) === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
}

export function tenantStatusTextClass(value: unknown) {
  return normalizeTenantStatus(value) === 'active' ? 'text-emerald-600' : 'text-gray-500';
}

export const ONLINE_STATUS_OPTIONS: Array<{ value: OnlineStatus; label: string }> = [
  { value: 'online', label: '进行中' },
  { value: 'draft', label: '草稿' },
  { value: 'offline', label: '已下线' },
];

export const ONLINE_STATUS_FILTER_OPTIONS: Array<{ value: OnlineStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  ...ONLINE_STATUS_OPTIONS,
];

export const RUNNING_STATUS_OPTIONS: Array<{ value: RunningStatus; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'draft', label: '草稿' },
  { value: 'inactive', label: '已下架' },
];

export const RUNNING_STATUS_FILTER_OPTIONS: Array<{ value: RunningStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  ...RUNNING_STATUS_OPTIONS,
];

export const CONTENT_STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'inactive', label: '失效' },
];

export const CONTENT_STATUS_FILTER_OPTIONS: Array<{ value: ContentStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  ...CONTENT_STATUS_OPTIONS,
];

export const ENABLED_STATUS_FILTER_OPTIONS: Array<{ value: EnabledStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'enabled', label: '启用' },
  { value: 'disabled', label: '禁用' },
  { value: 'draft', label: '草稿' },
];

export const ENABLED_STATUS_OPTIONS: Array<{ value: Exclude<EnabledStatus, 'draft'>; label: string }> = [
  { value: 'enabled', label: '生效中' },
  { value: 'disabled', label: '已禁用' },
];

export const TAG_STATUS_FILTER_OPTIONS: Array<{ value: TagStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '启用' },
  { value: 'draft', label: '草稿' },
  { value: 'disabled', label: '禁用' },
];

export const TAG_RULE_STATUS_OPTIONS: Array<{ value: TagStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '禁用' },
];

export const TENANT_STATUS_OPTIONS: Array<{ value: TenantStatus; label: string }> = [
  { value: 'active', label: '已激活' },
  { value: 'inactive', label: '未激活' },
];
