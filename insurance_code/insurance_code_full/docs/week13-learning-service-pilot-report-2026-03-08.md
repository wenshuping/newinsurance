# Week13 Learning Service 最小试点总结报告

更新时间：2026-03-08  
负责人：A 号（整合与验收）

## 1. 结论

Week13 `learning-service` 最小试点已经转绿。

当前结论：

1. `learning-service` 已接入 runtime split 总编排
2. Week13 总 gate / smoke / release-check 已建立并通过
3. `user-service` / `points-service` 既有 gate 未被打坏
4. `Phase 1` 已通过范围明确为：`查询 + 管理端 CRUD`
5. `complete` 奖励链路仍保留在 `v1-monolith`，只证明本周边界未越界，不计入已通过范围

## 2. 本轮实际接入范围

### 2.1 已进入 learning-service 的路由

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `GET /api/p/learning/courses`
4. `POST /api/p/learning/courses`
5. `PUT /api/p/learning/courses/:id`
6. `DELETE /api/p/learning/courses/:id`

### 2.2 明确保留在 v1-monolith 的路由

1. `POST /api/learning/courses/:id/complete`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`

## 3. 已验证场景

### 3.1 切流与回退

1. learning 默认关闭时，`/api/learning/courses` 走 `v1-monolith`
2. 打开 learning pilot 后，`/api/learning/courses` 走 `learning-service`
3. 非 allowlist 租户仍走 `v1-monolith`
4. 强制 `force-v1` 时，learning 路径全部回退到 `v1-monolith`
5. 清空 `force-v1` 后，learning 路径恢复到 `learning-service`
6. 当 `learning-service` 上游异常时，读路径 fallback 到 `v1-monolith`

### 3.2 业务语义

1. P 端学习资料列表 / 新增 / 编辑 / 删除，通过 gateway 命中 `learning-service`
2. C 端课程列表 / 详情，通过 gateway 命中 `learning-service`
3. `POST /api/learning/courses/:id/complete` 通过 gateway 仍命中 `v1-monolith`
4. 第 3 条只用于证明 `complete` 还没有被错误纳入 learning-service 验收范围
5. `internal/ops/overview` 可看到 `learning-service` 健康检查结果

## 4. 已通过入口

### 4.1 统一入口

```bash
npm run test:smoke:learning-service
npm run release-check:week13-learning-pilot
npm run gate:week13-learning-pilot
```

### 4.2 当前结果

1. `test:smoke:learning-service`: `PASS`
2. `release-check:week13-learning-pilot`: `PASS`
3. `gate:week13-learning-pilot`: `PASS`

对应通过范围：

1. C 端课程查询
2. P 端课程管理 CRUD
3. learning 路径的切流、强制回退、读路径 fallback

不计入通过范围：

1. `POST /api/learning/courses/:id/complete`
2. 学习完成后的积分奖励落账
3. `games / tools`

最新演练结果文件：

1. `./reports/week13-learning-pilot-latest.md`
2. `./reports/week13-learning-pilot-latest.json`

## 5. 交叉边界结论

### 5.1 B 号 user-service 输入

见：

1. `./week13-learning-service-user-boundary-confirmation-2026-03-08.md`

采纳结论：

1. `learning-service` 不接 `auth / me`
2. 不主写 user 主档和 session
3. 继续复用现有鉴权上下文

### 5.2 C 号 points-service 输入

见：

1. `../server/microservices/points-service/WEEK13-LEARNING-POINTS-REVIEW.md`

采纳结论：

1. 学习完成奖励链路当前不满足 points 契约化落账目标
2. 因此 `complete` 不进入 Week13 learning-service 试点
3. 该项遗留到后续阶段，不在本周解决

## 6. 风险与限制

当前仍保留的明确限制：

1. `learning-service` 试点只覆盖学习内容查询和管理端 CRUD
2. 不覆盖“学习完成 -> 积分奖励”完整闭环
3. 不新增 gateway 业务能力，只做编排与验收
4. 不改 user / points 的冻结边界
5. 当前 gateway route-map 未把 `POST /api/learning/courses/:id/complete` 视为 `learning-service` owned route
6. 因此本周对 `complete` 的验证只属于边界保护检查，不属于试点通过项

## 7. 是否允许进入下一阶段

结论：`允许`。

前提：

1. 下一阶段如果要把 `complete` 正式收进 `learning-service`
2. 必须先把奖励落账改成 `points-service` 契约或等价受控调用
3. 并先补文档、再补 gate、最后再改代码

## 8. 归档

Week13 当前归档文档：

1. `./week13-learning-service-pilot-runbook-2026-03-08.md`
2. `./week13-learning-service-pilot-report-2026-03-08.md`
3. `./week13-learning-service-user-boundary-confirmation-2026-03-08.md`
4. `../server/microservices/points-service/WEEK13-LEARNING-POINTS-REVIEW.md`
5. `./reports/week13-learning-pilot-latest.md`
