# Learning Service Smoke / Gate

更新时间：2026-03-09  
状态：`WEEK18_FORMAL_SPLIT`

## 1. 最小检查集合

1. `node scripts/check_learning_service_boundary_guard.mjs`
2. `node scripts/review_learning_user_legacy_routes.mjs`
3. `node scripts/check_week18_learning_formal_split.mjs`
4. `node scripts/smoke_week18_learning_formal_split.mjs`
5. `node scripts/gate_week18_learning_formal_split.mjs`

## 2. smoke 现在必须覆盖的事实

1. `learning-service /ready` 输出 `formalSplitReady=true`
2. gateway 默认状态下，`courses / games / tools` 仍可走 `v1-monolith` 读 fallback
3. 开启 learning-service 灰度后，`courses / games / tools / detail / complete` 可切到 `learning-service`
4. monolith `complete` 只允许保留 bridge，不再保留本地完成写逻辑
5. monolith `/api/b/content/items*` 是 bridge，不是本地 logic/write path
6. `complete` 通过 `learning-service -> points-service` 仍保持奖励结算与幂等
7. user 边界与 `Bearer + x-csrf-token` 不变

## 3. gate 通过标准

1. `formalSplitReady = true`
2. `legacyReviewRequired = false`
3. monolith learning 最小兼容层可观测
4. 不再存在 monolith 本地 learning 主写链路
