type Option<T extends string = string> = { value: T; label: string };

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function loadTemplateStatusContracts() {
  const mod = await import('../../../shared-contracts/template-status.ts');
  const ns = ((mod as { default?: unknown; 'module.exports'?: unknown }).default ??
    (mod as { 'module.exports'?: unknown })['module.exports'] ??
    mod) as {
    toOnlineStatus: (value: unknown) => string;
    toActivityOnlineStatus: (status: unknown, canComplete?: boolean) => string;
    toRunningStatus: (value: unknown) => string;
    isRunningStatusActive: (value: unknown) => boolean;
    toLearningStatus: (value: unknown) => string;
    normalizeEnabledStatus: (value: unknown) => string;
    normalizeTagStatus: (value: unknown) => string;
    normalizeTenantStatus: (value: unknown) => string;
    runningListStatusLabel: (value: unknown) => string;
    ONLINE_STATUS_FILTER_OPTIONS: Option[];
    RUNNING_STATUS_FILTER_OPTIONS: Option[];
    CONTENT_STATUS_FILTER_OPTIONS: Option[];
    ENABLED_STATUS_FILTER_OPTIONS: Option[];
    TAG_STATUS_FILTER_OPTIONS: Option[];
    TENANT_STATUS_OPTIONS: Option[];
  };
  return ns;
}

function hasOption(options: Option[], value: string, label?: string) {
  return options.some((it) => it.value === value && (label ? it.label === label : true));
}

async function main() {
  const c = await loadTemplateStatusContracts();

  assert(c.toOnlineStatus('进行中') === 'online', 'toOnlineStatus(进行中) should be online');
  assert(c.toOnlineStatus('已下线') === 'offline', 'toOnlineStatus(已下线) should be offline');
  assert(c.toActivityOnlineStatus('进行中', false) === 'offline', 'toActivityOnlineStatus should force offline when canComplete=false');
  assert(c.toActivityOnlineStatus('草稿', true) === 'draft', 'toActivityOnlineStatus should map status when canComplete=true');

  assert(c.toRunningStatus('已发布') === 'active', 'toRunningStatus(已发布) should be active');
  assert(c.toRunningStatus('失效') === 'inactive', 'toRunningStatus(失效) should be inactive');
  assert(c.isRunningStatusActive('进行中') === true, 'isRunningStatusActive(进行中) should be true');
  assert(c.isRunningStatusActive('已结束') === false, 'isRunningStatusActive(已结束) should be false');

  assert(c.toLearningStatus('草稿') === 'draft', 'toLearningStatus(草稿) should be draft');
  assert(c.toLearningStatus('已结束') === 'inactive', 'toLearningStatus(已结束) should be inactive');

  assert(c.normalizeEnabledStatus('停用') === 'disabled', 'normalizeEnabledStatus(停用) should be disabled');
  assert(c.normalizeTagStatus('启用') === 'active', 'normalizeTagStatus(启用) should be active');
  assert(c.normalizeTenantStatus('未激活') === 'inactive', 'normalizeTenantStatus(未激活) should be inactive');

  assert(c.runningListStatusLabel('draft') === '已结束', 'runningListStatusLabel(draft) should be 已结束');
  assert(c.runningListStatusLabel('active') === '进行中', 'runningListStatusLabel(active) should be 进行中');

  assert(hasOption(c.ONLINE_STATUS_FILTER_OPTIONS, 'all', '全部状态'), 'ONLINE_STATUS_FILTER_OPTIONS missing all');
  assert(hasOption(c.RUNNING_STATUS_FILTER_OPTIONS, 'active', '进行中'), 'RUNNING_STATUS_FILTER_OPTIONS missing active');
  assert(hasOption(c.CONTENT_STATUS_FILTER_OPTIONS, 'published', '已发布'), 'CONTENT_STATUS_FILTER_OPTIONS missing published');
  assert(hasOption(c.ENABLED_STATUS_FILTER_OPTIONS, 'enabled', '启用'), 'ENABLED_STATUS_FILTER_OPTIONS missing enabled');
  assert(hasOption(c.TAG_STATUS_FILTER_OPTIONS, 'disabled', '禁用'), 'TAG_STATUS_FILTER_OPTIONS missing disabled');
  assert(hasOption(c.TENANT_STATUS_OPTIONS, 'inactive', '未激活'), 'TENANT_STATUS_OPTIONS missing inactive');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'status_normalization_mapping',
          'activity_online_status_mapping',
          'running_active_mapping',
          'running_list_status_label',
          'status_filter_options_presence',
        ],
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
