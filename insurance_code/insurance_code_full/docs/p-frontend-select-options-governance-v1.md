# P 端下拉选项治理（事件类型/采集方式/员工角色）（v1）

更新时间：2026-03-05  
适用范围：`insurance_code_P`

## 1. 目标

将 P 端高频硬编码下拉选项收敛到 `shared-contracts`，避免同一语义在不同页面产生口径漂移。

## 2. 本次统一项

共享契约新增文件：`shared-contracts/select-options.ts`

- `EVENT_TYPE_OPTIONS`
- `EVENT_COLLECT_METHOD_OPTIONS`
- `EMPLOYEE_ROLE_OPTIONS`
- `employeeRoleLabel`
- `eventTypeLabel`
- `eventTypePillClass`
- `eventCollectMethodLabel`
- `ACTIVITY_TYPE_OPTIONS`
- `METRIC_END_OPTIONS`
- `METRIC_PERIOD_OPTIONS`

并在 `shared-contracts/index.ts` 统一导出。

P 端桥接文件：

- `insurance_code_P/src/lib/selectOptions.ts`

P 端页面接入：

- `insurance_code_P/src/App.tsx`
  - 事件管理：事件类型、采集方式
  - 积分商城：活动类型（任务活动/竞赛活动/邀请活动）
  - 员工管理：新增员工角色、编辑员工角色
  - 指标配置：所属端（C/B/P/system）
  - 指标配置：统计周期

## 3. 防回退校验

脚本：`scripts/check_p_select_options_bridge.mjs`

校验项：

- `shared-contracts/select-options.ts` 是否导出三组选项
- `shared-contracts/index.ts` 是否导出 `select-options`
- `insurance_code_P/src/lib/selectOptions.ts` 是否桥接导出
- `insurance_code_P/src/App.tsx` 是否使用 `*.map(...)` 渲染选项
- 禁止回退为硬编码 `<option value="...">...</option>`

脚本：`scripts/check_p_metric_period_options_bridge.mjs`

校验项：

- `METRIC_PERIOD_OPTIONS` 由 `shared-contracts` 导出
- P 端桥接层导出该常量
- `insurance_code_P/src/App.tsx` 使用 `METRIC_PERIOD_OPTIONS.map(...)`
- 禁止回退为本地 `const METRIC_PERIOD_OPTIONS = [...]`

执行命令：

```bash
npm run lint:p-frontend:select-options-bridge
npm run lint:p-frontend:metric-period-options-bridge
npm run lint:p-frontend:metric-end-options-bridge
```

## 4. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:p-frontend:select-options-bridge`
- `npm run lint:p-frontend:metric-period-options-bridge`
- `npm run lint:p-frontend:metric-end-options-bridge`
