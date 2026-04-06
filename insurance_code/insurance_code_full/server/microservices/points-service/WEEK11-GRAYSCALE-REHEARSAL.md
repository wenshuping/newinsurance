# Week11 Points 域灰度演练观测结论

更新时间：2026-03-08  
负责人：C 号（points-service）  
范围：`points-service`

## 1. 结论

从 C 号负责的 `points-service` 视角看，Week11 灰度演练已经完成当前阶段所需的 points 域观测确认。

本次正式结论是：

1. points 域已确认租户级灰度和路径级灰度对 `points-service` 生效
2. points 读路径 fallback 已被故意打出并被 gateway 指标正确记录
3. 当前演练窗口内，`/api/points/summary` 走 `V2` 正常
4. 当前演练窗口内，`/api/mall/items` 的 `force-v1` 和读路径 fallback 均正常
5. 本轮最终判定：`continue`

说明：

1. 本次 `continue` 只代表当前 Week11 灰度阶段可以继续维持或推进“租户级 + 低风险路径级”灰度
2. 不代表 `redeem / writeoff` 这类更高风险写路径已经单独完成放量验证

## 2. 本次核对输入

本次结论基于以下已落盘产物：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/week11-grayscale-drill-latest.json`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/week11-grayscale-drill-latest.md`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/week11-runtime-grayscale-drill-report-2026-03-08.md`
4. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`

## 3. 演练窗口与灰度范围

### 3.1 演练窗口

本次统一演练快照时间：

1. `2026-03-08T03:54:29.457Z`
2. 对应本地时区约为 `2026-03-08 11:54`（Asia/Shanghai）
3. 本次属于单次 `release-check:week11-runtime-split` 演练窗口

### 3.2 灰度租户

本次演练明确使用了两个租户样本：

1. `tenant-alpha`
   - 作为 `V2` allowlist 租户样本
2. `tenant-beta`
   - 作为未放量对照租户样本

补充说明：

1. 演练请求头中统一带了 `x-tenant-id=1`
2. 租户区分主要依赖 `x-tenant-code`

### 3.3 灰度路径

本次与 points 域直接相关的灰度路径有：

1. `force-v2`：
   - `/api/points/summary`
2. `force-v1`：
   - `/api/mall/items`
3. `read fallback` 验证路径：
   - `/api/mall/items`

本次演练未直接覆盖的 points 写路径：

1. `POST /api/sign-in`
2. `POST /api/mall/redeem`
3. `POST /api/redemptions/:id/writeoff`

## 4. fallback 计数

本次统一灰度演练的 gateway 指标快照为：

1. `requestTotal = 8`
2. `errorTotal = 0`
3. `errorRate = 0`
4. `fallbackTotal = 1`

其中与 points 域直接相关的 fallback 样本是：

1. 请求：`GET /api/mall/items`
2. `trace_id = week11-read-fallback-mall-items`
3. 结果：`mode=v1`
4. 目标：`v1-monolith`

判读：

1. 这 1 次 fallback 是演练中故意把 `GATEWAY_POINTS_SERVICE_URL` 指向不可用地址后打出的读路径验证样本
2. 这个计数用于证明 fallback 可见、指标可见，不作为“自然流量异常”处理
3. 因此本次结论不能机械把 `fallbackTotal=1` 直接判成灰度失败

## 5. points 域实际结果

### 5.1 读路径灰度结果

已实际验证通过：

1. `path.force-v2.points-summary`
   - `PASS`
   - `status=200`
   - `mode=v2`
   - `target=points-service`
   - `trace_id=week11-force-v2-points-summary`
2. `path.force-v1.mall-items`
   - `PASS`
   - `status=200`
   - `mode=v1`
   - `target=v1-monolith`
   - `trace_id=week11-force-v1-mall-items`
3. `fallback.read.mall-items`
   - `PASS`
   - `status=200`
   - `mode=v1`
   - `target=v1-monolith`
   - `trace_id=week11-read-fallback-mall-items`

### 5.2 `signIn / redeem / writeoff` 实际结果

这 3 个 points 交易指标在本次灰度演练窗口内没有被直接触发，因此当前正式记录如下：

1. `signIn.successRate`
   - 演练窗口内：`no_sample`
   - 结论：本次窗口未直接覆盖 `POST /api/sign-in`，未观察到新的负向信号
2. `redeem.successRate`
   - 演练窗口内：`no_sample`
   - 结论：本次窗口未直接覆盖 `POST /api/mall/redeem`，未观察到新的负向信号
3. `writeoff.successRate`
   - 演练窗口内：`no_sample`
   - 结论：本次窗口未直接覆盖 `POST /api/redemptions/:id/writeoff`，未观察到新的负向信号

补充说明：

1. 这不是指标缺失，而是本次演练刻意只先验证租户级切流、路径级切流和读路径 fallback
2. `signIn / redeem / writeoff` 的灰度阈值仍以 `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md` 为准
3. 若进入更高风险交易路径放量阶段，必须再按该文档单独核对

## 6. C 号观测判断

### 6.1 当前已确认

1. `points-service` 读路径已实际进入 `V2`
2. points 读路径 `force-v1` 正常
3. points 读路径 fallback 正常，且指标可见
4. 本轮未出现 points 域 `4xx/5xx` 异常抬升信号
5. 当前没有证据表明 points 域需要 `pause` 或 `rollback`

### 6.2 当前仍保留的边界

1. 本次没有直接验证 `redeem / writeoff` 的放量窗口
2. 本次没有把高风险写路径纳入自动 fallback 放开范围
3. 因此当前 `continue` 结论只对本轮灰度阶段成立，不等于高风险交易路径已经全量放开

## 7. 最终判定

最终判定：`continue`

判定理由：

1. 本次演练窗口内，points 读路径 `V2` / `force-v1` / `fallback` 三种治理动作都已验证通过
2. `fallbackTotal=1` 来自故意制造的读路径上游异常验证，不是自然故障抬升
3. points 域本轮没有观察到要求立即 `pause` 或 `rollback` 的信号
4. 当前可继续推进 Week11 既定灰度阶段，但仍需保持 `redeem / writeoff` 等高风险写路径的保守放量策略

## 8. 给 A 号的代挂索引路径

如果由 A 号统一维护公共索引，请挂这份文档：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-REHEARSAL.md`
