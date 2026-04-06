# Week16 Activity Service User 侧风险清单

更新时间：2026-03-09  
负责人：B 号（user-service 视角）

| 风险项 | 等级 | 当前状态 | 影响 | 建议 |
| --- | --- | --- | --- | --- |
| `c_activity_completions` 当前不带 `tenantId / ownerUserId / orgId / teamId` | P1 | 现存设计缺口 | 后续 activity-service 做审计、灰度、跨租户核对时缺少用户域归属证据 | 后续阶段补 completion 归属字段或等价索引 |
| B / P 两套活动配置入口仍共用 `state.activities` | P2 | 现状如此 | 不是 user 越权，但 ownership 漂移会影响 owner / tenant 审计 | 扩面前继续收口 owned write path |
| `tenantContext` / `canDeliverTemplateToActor` 后续被绕过 | P2 | 当前 guard / smoke 已覆盖 | 不会直接打穿 user 主写边界，但会让客户可见性判断漂移 | 提交前常态执行 Week16 user 侧 guard / smoke |

## 结论

1. 当前没有发现 activity-service 直接主写 `app_users / c_customers / p_sessions`
2. 当前没有发现 activity-service 接管 `auth / me`
3. Week16 的 user 侧剩余风险已经降到非阻塞，主要集中在归属审计证据和 ownership 漂移
