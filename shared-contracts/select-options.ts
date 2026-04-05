export type EventTypeOptionValue = 'system' | 'custom';
export type EventCollectMethodOptionValue = 'frontend' | 'backend' | 'both';
export type EmployeeRoleOptionValue = 'manager' | 'salesperson' | 'support';
export type ActivityTypeOptionValue = 'task' | 'competition' | 'invite';
export type MetricEndOptionValue = 'c' | 'b' | 'p' | 'system';
export type MetricPeriodOptionValue =
  | '实时（秒级）'
  | '每分钟'
  | '每小时'
  | '每日'
  | '每周'
  | '每月'
  | '每季度'
  | '每年'
  | '近7日滚动'
  | '近30日滚动'
  | '月累计'
  | '年累计';

export const EVENT_TYPE_OPTIONS: Array<{ value: EventTypeOptionValue; label: string }> = [
  { value: 'system', label: '系统预置' },
  { value: 'custom', label: '自定义' },
];

export const EVENT_COLLECT_METHOD_OPTIONS: Array<{ value: EventCollectMethodOptionValue; label: string }> = [
  { value: 'frontend', label: '前端埋点' },
  { value: 'backend', label: '后端日志' },
  { value: 'both', label: '两者兼有' },
];

export function eventTypeLabel(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase() as EventTypeOptionValue;
  const found = EVENT_TYPE_OPTIONS.find((item) => item.value === normalized);
  return found?.label || '自定义';
}

export function eventTypePillClass(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase() as EventTypeOptionValue;
  return normalized === 'system' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600';
}

export function eventCollectMethodLabel(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase() as EventCollectMethodOptionValue;
  if (normalized === 'backend') return '后端日志';
  if (normalized === 'both') return '前后端';
  return '前端埋点';
}

export const EMPLOYEE_ROLE_OPTIONS: Array<{ value: EmployeeRoleOptionValue; label: string }> = [
  { value: 'manager', label: '公司管理员' },
  { value: 'salesperson', label: '业务员' },
  { value: 'support', label: '团队主管' },
];

export function employeeRoleLabel(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase() as EmployeeRoleOptionValue;
  const found = EMPLOYEE_ROLE_OPTIONS.find((item) => item.value === normalized);
  return found?.label || '业务员';
}

export const ACTIVITY_TYPE_OPTIONS: Array<{ value: ActivityTypeOptionValue; label: string }> = [
  { value: 'task', label: '任务活动' },
  { value: 'competition', label: '竞赛活动' },
  { value: 'invite', label: '邀请活动' },
];

export const METRIC_END_OPTIONS: Array<{ key: MetricEndOptionValue; label: string }> = [
  { key: 'c', label: 'C端指标' },
  { key: 'b', label: 'B端指标' },
  { key: 'p', label: 'P端指标' },
  { key: 'system', label: '系统指标' },
];

export const METRIC_PERIOD_OPTIONS: MetricPeriodOptionValue[] = [
  '实时（秒级）',
  '每分钟',
  '每小时',
  '每日',
  '每周',
  '每月',
  '每季度',
  '每年',
  '近7日滚动',
  '近30日滚动',
  '月累计',
  '年累计',
];
