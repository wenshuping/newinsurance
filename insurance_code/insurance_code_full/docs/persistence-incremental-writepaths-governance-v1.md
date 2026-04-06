# 持久化增量写路径治理（v1）

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 目标

1. 将核心交易写路径从“全表删写”收敛到“主键增量同步（差异删除 + upsert）”。
2. 降低并发场景下全量重灌导致的写放大和误覆盖风险。
3. 通过静态门禁防止回退。

## 2. 受治理表（当前范围）

1. `p_sessions`
2. `p_orders`
3. `c_redeem_records`
4. `c_sign_ins`
5. `c_activity_completions`
6. `c_learning_records`
7. `c_point_transactions`
8. `p_track_events`
9. `p_audit_logs`
10. `c_customers`
11. `b_agents`
12. `p_products`
13. `p_activities`
14. `p_learning_materials`
15. `p_metric_uv_daily`
16. `p_metric_counter_daily`
17. `p_metric_counter_hourly`
18. `p_event_definitions`
19. `p_metric_rules`

## 3. 约束规则

1. 禁止对上述表使用 `truncateAndInsert(client, '<table>', ...)`。
2. 禁止上述表出现在 `clearOrder` 全量清理列表中。
3. 必须通过 `syncTableByPrimaryKeys(client, '<table>', keyCols, allCols, rows)` 进行同步。

## 4. 门禁

1. 本地/CI执行：`npm run lint:persistence:incremental-writepaths`
2. 已接入：`npm run ci:gate:core`
3. 校验脚本：`scripts/check_persistence_incremental_writepaths.mjs`

## 5. 可观测性

1. 每次 Postgres 持久化成功后，会更新：
   - `docs/reports/persist-sync-stats-latest.json`
2. 快照字段包含：
   - `generatedAt`
   - `fkDropStats`
   - `incrementalSyncStats`（每张受治理表的 `inserted/updatedByKey/deleted`）
3. `release:preflight` 会尝试附带本次执行窗口内生成的该快照到 `release-preflight-*.json` 的 `persistSyncStats` 字段。

## 6. 后续计划

1. V2：将剩余全量删写表（如 `c_policies/p_order_*` 等低频管理表）评估迁移为增量仓储层。
2. V2：将 `syncTableByPrimaryKeys` 下沉到 repository 层，替代 `state.mjs` 内部直接 SQL。
3. V2：为增量同步增加变更统计（insert/update/delete 计数）并输出到 preflight 报告。
