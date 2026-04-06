# B 端状态筛选选项治理（v1）

更新时间：2026-03-05  
适用范围：`insurance_code_B`

## 1. 目标

避免 B 端在页面内部手工拼接状态筛选选项，统一由 `shared-contracts` 提供。

## 2. 本次改动

共享契约新增：

- `CONTENT_STATUS_FILTER_OPTIONS`
- `RUNNING_STATUS_FILTER_OPTIONS`
- `ContentRunningStatusFilter`
- `isRunningStatusActive`

B 端接入：

- `insurance_code_B/src/lib/templateStatus.ts` 已桥接导出上述常量
- `insurance_code_B/src/lib/templateStatus.ts` 已桥接导出 `ContentRunningStatusFilter`
- `insurance_code_B/src/App.tsx` 的 `currentFilterOptions` 改为：
  - 内容页：`CONTENT_STATUS_FILTER_OPTIONS`
  - 活动/商城页：`RUNNING_STATUS_FILTER_OPTIONS`
- `insurance_code_B/src/App.tsx` 的 `statusFilter` state 改为 `useState<ContentRunningStatusFilter>('all')`
- `insurance_code_B/src/App.tsx` 活动货架状态图标/active 判断改为 `isRunningStatusActive(...)`，不再页面内定义 `isActiveStatus`

## 3. 防回退校验

脚本：`scripts/check_b_status_filter_options_bridge.mjs`

校验项：

- `shared-contracts` 已导出筛选常量
- B 端桥接层已导出筛选常量、共享筛选类型与 `isRunningStatusActive`
- B 端页面已使用筛选常量、共享筛选类型与 `isRunningStatusActive`
- 禁止回退为本地拼接：`[{ label: '全部', value: 'all' }, ...STATUS_OPTIONS]`
- 禁止回退为本地联合类型：`type StatusFilter = ...`
- 禁止回退为本地 `const isActiveStatus = ...`

执行：

```bash
npm run lint:b-frontend:status-filter-options-bridge
```

## 4. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:b-frontend:status-filter-options-bridge`
