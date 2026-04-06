# C/B/P 状态口径回归用例（v1）

更新时间：2026-03-05  
适用范围：
- C 端：`insurance_code/insurance_code_full`
- B 端：`insurance_code_B`
- P 端：`insurance_code_P`
- 共享契约：`shared-contracts/template-status.ts`

## 1. 目标

验证三端状态文案、状态样式、筛选行为对同一后端状态输入保持一致，防止“同状态多口径”。

## 2. 回归前提

1. API 服务可用：`http://127.0.0.1:4000/api/health` 返回 200。  
2. 前端已重启（不是仅刷新页面），避免旧 bundle 缓存。  
3. 当前 CI 门禁通过：`npm run ci:gate:core`。  

## 3. 统一口径基线（来自 shared-contracts）

1. Running 状态归一：`active / draft / inactive`。  
2. Online 状态归一：`online / draft / offline`。  
3. 关键映射函数：
- `toRunningStatus`
- `runningStatusLabel`
- `runningStatusPillClass`
- `isRunningStatusActive`
- `toActivityOnlineStatus`

## 4. 用例清单

| 用例ID | 优先级 | 端 | 场景 | 步骤 | 预期 |
|---|---|---|---|---|---|
| ST-C-001 | P0 | C | 活动详情状态文案 | 打开任一活动详情页 | 文案来自 `runningStatusLabel`，不出现页面本地硬编码分支 |
| ST-C-002 | P0 | C | 活动详情状态样式 | 切换不同状态活动（active/draft/inactive） | 样式来自 `runningStatusPillClass`，与状态一致 |
| ST-B-001 | P0 | B | 内容/活动/商城筛选一致性 | 在获客工具三栏切换状态筛选 | 内容栏走 `CONTENT_STATUS_FILTER_OPTIONS`；活动/商城走 `RUNNING_STATUS_FILTER_OPTIONS` |
| ST-B-002 | P0 | B | 活动货架激活判断一致性 | 活动状态切换后查看图标/active 标记 | 使用 `isRunningStatusActive` 判定，active 与图标联动一致 |
| ST-P-001 | P0 | P | 活动状态映射一致性 | P端活动列表读取 status+canComplete 组合 | 使用 `toActivityOnlineStatus`，`canComplete=false` 必定展示 offline |
| ST-P-002 | P1 | P | 租户/规则状态下拉一致性 | 打开租户和指标规则页面 | 分别来自 `TENANT_STATUS_OPTIONS` 与 `ENABLED_STATUS_OPTIONS` |
| ST-X-001 | P0 | 跨端 | 同数据跨端一致 | 同一活动在 C/B/P 分别查看状态 | 归一后语义一致，不出现“C是进行中/B是草稿”冲突 |
| ST-X-002 | P1 | 跨端 | 异常值兜底一致 | 后端注入未知状态值 | 三端均按共享归一函数兜底，不崩溃 |

## 5. API/数据核验建议

1. 抽样接口：
- `GET /api/activities`
- `GET /api/b/activity-configs`
- `GET /api/p/activities`

2. 核验维度：
- 原始 `status` 输入值
- 前端归一状态值（active/draft/inactive 或 online/draft/offline）
- 文案与样式是否匹配

## 6. 自动化门禁映射

| 门禁脚本 | 覆盖点 |
|---|---|
| `scripts/check_c_frontend_status_bridge.mjs` | C端活动详情必须走桥接状态函数 |
| `scripts/check_b_status_filter_options_bridge.mjs` | B端状态筛选/激活判断必须走共享契约 |
| `scripts/check_frontend_status_options_bridge.mjs` | P端状态选项与活动状态映射必须走共享契约 |
| `scripts/smoke_template_status_contracts.ts` | shared-contracts 状态函数语义正确 |

## 7. 执行命令

推荐一键执行（状态治理聚合命令）：

```bash
cd "$(git rev-parse --show-toplevel)"
npm run test:smoke:status-governance
```

前端治理全量一键（状态 + 分享）：

```bash
npm run test:smoke:frontend-governance
```

分步执行：

```bash
cd "$(git rev-parse --show-toplevel)"
npm run test:smoke:status-caliber-cbp
npm run lint:c-frontend:status-bridge
npm run lint:b-frontend:status-filter-options-bridge
npm run lint:frontend:status-options-bridge
npm run test:smoke:template-status-contracts
npm run ci:gate:core
```

状态跨端自动 smoke（新增）：

- 脚本：`scripts/smoke_status_caliber_cbp.ts`
- 覆盖：
  - C 端 `GET /api/activities` 状态归一与文案校验
  - B 端 `GET /api/b/content/items` 与 `GET /api/b/activity-configs` 状态归一与文案校验
  - P 端 `GET /api/p/activities` 状态归一与文案校验
  - C/B 运行态状态跨端归一一致性校验

## 8. 通过标准（Go）

1. 上述命令全部通过。  
2. `ST-C/B/P/X` 的 P0 用例通过率 100%。  
3. 不存在“同状态跨端文案冲突”或“状态样式与状态值不一致”。
