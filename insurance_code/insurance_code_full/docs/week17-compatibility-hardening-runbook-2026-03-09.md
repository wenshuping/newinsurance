# Week17 兼容层硬化 Runbook

更新时间：2026-03-09  
负责人：A 号

## 1. 范围

Week17 只做：

1. compatibility 残留扫描
2. route ownership 漂移扫描
3. 写路径 fallback 误用扫描
4. 既有 learning / activity complete 链路复验

不做：

1. 新服务拆分
2. gateway 新业务能力扩展
3. `user-service / points-service` 主写边界调整
4. skeleton 大规模迁移删除

## 2. 统一入口

1. Week17 smoke：`npm run test:smoke:week17-compatibility-hardening`
2. Week17 release-check：`npm run release-check:week17-compatibility-hardening`
3. Week17 gate：`npm run gate:week17-compatibility-hardening`

## 3. 各检查项说明

### 3.1 compatibility residual scan

命令：

```bash
node scripts/check_week17_compatibility_residuals.mjs
```

检查目标：

1. skeleton mounted route files 是否都存在
2. compatibility-only route file 集合是否漂移
3. must-keep route file 集合是否漂移
4. bridge-only file 集合是否仍在控制范围内
5. 4 个拆分服务 owned routes 是否仍在 skeleton 兼容层可追溯

### 3.2 route ownership drift scan

命令：

```bash
node scripts/check_week17_route_ownership_drift.mjs
```

检查目标：

1. gateway registry 是否仍只有 5 个服务
2. `user / points / learning / activity` owned routes 是否与 gateway route-map 一致
3. 是否出现路由 overlap
4. `learning / activity` 是否仍默认关闭

### 3.3 write fallback misuse scan

命令：

```bash
node scripts/check_week17_write_fallback_misuse.mjs
```

检查目标：

1. gateway 自动 fallback 是否仍只允许 `GET/HEAD`
2. `GATEWAY_FORCE_V1_PATHS` 是否仍存在
3. learning complete 的“写不自动 fallback / 手工回退”演练是否仍在脚本里
4. activity complete 的“写不自动 fallback / 手工回退”演练是否仍在脚本里

### 3.4 learning / activity complete 复验

Week17 不新增业务联调，而是复验两条已经纳入 runtime split 的关键写链路：

1. `npm run release-check:week14-learning-complete`
2. `npm run release-check:week16-activity-complete`

## 4. 失败时处理顺序

1. 先跑单项扫描，看是兼容残留、route ownership 还是 fallback 规则漂移
2. 如果是 compatibility residual drift，先确认是不是：
   - 新增了 skeleton 路由
   - learning / activity 把未拆路径偷偷挂回 compatibility-only 文件
3. 如果是 route ownership drift，先看：
   - `server/microservices/gateway/route-map.mjs`
   - 各服务 `boundary.mjs / CONTRACT.md`
4. 如果是 write fallback misuse，先看：
   - `server/microservices/gateway/app.mjs`
   - `scripts/smoke_week14_learning_complete.mjs`
   - `scripts/smoke_week16_activity_complete.mjs`

## 5. 通过标准

Week17 gate 通过，至少意味着：

1. compatibility-only / must-keep / bridge-only 口径没有漂移
2. 5 服务 route ownership 没有漂移
3. 写路径 fallback 仍是“读自动、写手工”
4. learning complete / activity complete 既有链路没有被 Week17 兼容层收缩打坏
