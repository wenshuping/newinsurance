# Week15 Activity Service 用户域风险清单

更新时间：2026-03-09
负责人：B 号（user-service 视角）

| 风险项 | 等级 | 当前状态 | 影响 | 建议 |
| --- | --- | --- | --- | --- |
| `c_activity_completions` 当前不带 `tenantId / ownerUserId / orgId / teamId` | P1 | 现存设计缺口 | 后续 activity-service 做审计、灰度、跨租户核对时缺少用户域归属证据 | Phase 2 设计里补 completion 归属字段或等价索引 |
| B / P 两套活动配置入口仍共用 `state.activities` | P2 | 现状如此 | 不是 user 越权，但 ownership 漂移会影响后续 owner/tenant 审计 | 进入 activity-service 扩面前先收口 owned write path |
| activity tenant / owner 守卫如果后续被人绕过 | P2 | 当前 guard 已覆盖 | 不会立刻打穿 user 主写边界，但会让客户可见性判断漂移 | 保持 `check_activity_user_boundary_guard.mjs` 常态执行 |

## 结论

1. 当前没有发现 activity 直接主写 `app_users / c_customers / p_sessions`
2. `complete` 的 `tenantContext` 缺失问题已收口
3. 当前主要 user 侧剩余风险是“completion 归属证据不足”和“活动配置 ownership 漂移”
