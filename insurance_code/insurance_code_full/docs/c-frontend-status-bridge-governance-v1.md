# C 端状态桥接治理（v1）

更新时间：2026-03-05  
适用范围：`insurance_code/insurance_code_full`

## 1. 目标

确保 C 端活动状态文案/样式不在页面内手写分支，统一复用 `shared-contracts/template-status.ts`，避免和 B/P 端出现状态口径漂移。

## 2. 本次改动

- 新增校验脚本：`scripts/check_c_frontend_status_bridge.mjs`
- 新增 npm 脚本：`lint:c-frontend:status-bridge`
- `ci:gate:core` 已接入该门禁

## 3. 校验范围

- `shared-contracts/template-status.ts` 必须导出：
  - `runningStatusLabel`
  - `runningStatusPillClass`
  - `normalizeRunningStatus`
- C 端桥接 `src/lib/templateStatus.ts` 必须重导出上述函数
- C 端活动详情页 `src/components/activities/ActivityDetail.tsx` 必须通过桥接调用：
  - `runningStatusLabel(activity?.status)`
  - `runningStatusPillClass(activity?.status)`
- 禁止在活动详情页写本地状态分支：
  - `activity?.status === 'active'|'draft'|'inactive'`

## 4. 执行命令

```bash
npm run lint:c-frontend:status-bridge
```

## 5. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:c-frontend:status-bridge`
