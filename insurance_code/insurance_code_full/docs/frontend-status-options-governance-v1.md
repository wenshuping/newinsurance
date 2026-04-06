# 前端状态下拉选项治理（v1）

更新时间：2026-03-05  
适用范围：P 端（优先），共享契约层 `shared-contracts/template-status.ts`

## 1. 目标

状态下拉项不再在页面里硬编码，统一从 `shared-contracts` 导出，避免不同端口径漂移。

## 2. 本次统一内容

在 `shared-contracts/template-status.ts` 新增：

- `TENANT_STATUS_OPTIONS`
- `ENABLED_STATUS_OPTIONS`
- `toActivityOnlineStatus(status, canComplete)`（活动状态统一映射）

P 端接入：

- 租户状态下拉改为 `TENANT_STATUS_OPTIONS.map(...)`
- 指标规则状态下拉改为 `ENABLED_STATUS_OPTIONS.map(...)`
- 状态筛选 state 类型改为共享类型：
  - `OnlineStatusFilter`
  - `EnabledStatusFilter`
  - `TagStatusFilter`
- 活动列表状态映射改为 `toActivityOnlineStatus`，不再在页面内定义 `normalizeActivityStatus`

## 3. 防回退校验

脚本：`scripts/check_frontend_status_options_bridge.mjs`

校验项：

- `shared-contracts` 已导出上述两个 options 常量
- `insurance_code_P/src/lib/templateStatus.ts` 已桥接导出
- `insurance_code_P/src/App.tsx` 使用 options 常量渲染，并使用共享 filter type
- 禁止回退为硬编码 `<option value="...">...</option>`

执行命令：

```bash
npm run lint:frontend:status-options-bridge
npm run test:smoke:template-status-contracts
```

## 4. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:frontend:status-options-bridge`
- `npm run test:smoke:template-status-contracts`

语义 smoke（新增）：

- `scripts/smoke_template_status_contracts.ts`
- 校验 `template-status` 关键映射与 options 输出行为，覆盖：
  - `toOnlineStatus/toRunningStatus/toLearningStatus`
  - `toActivityOnlineStatus`
  - `normalizeEnabledStatus/normalizeTagStatus/normalizeTenantStatus`
  - `runningListStatusLabel`
  - `ONLINE/RUNNING/CONTENT/ENABLED/TAG/TENANT` 状态选项存在性
