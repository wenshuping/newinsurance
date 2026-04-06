# Week9 Seed / Runtime Snapshot 拆分说明

更新时间：2026-03-07

## 1. 结论

从本次调整开始，文件存储模式统一拆成两类输入：

1. `server/data/db.json`
   - 只作为干净 seed
   - 可以提交到仓库
   - 只允许保留可复用的基础样本数据
2. `server/data/runtime-snapshot.json`
   - 只作为运行态快照
   - 不提交到仓库
   - 由 file 模式运行时自动写入

## 2. 运行规则

### 2.1 file 模式

1. 优先读取 `runtime-snapshot.json`
2. 如果快照不存在，再回退读取 `db.json`
3. 所有运行态写入都只写到 `runtime-snapshot.json`
4. 不允许把运行态直接回写到 `db.json`

### 2.2 postgres 模式

1. 空库初始化只允许读取 `db.json`
2. 不允许拿 `runtime-snapshot.json` 作为 Postgres 种子基线
3. Postgres 验证结论必须基于干净 seed，而不是运行快照

## 3. 环境变量

```env
STATE_SEED_PATH=server/data/db.json
STATE_RUNTIME_SNAPSHOT_PATH=server/data/runtime-snapshot.json
```

默认值就是上面两条，只有在本地特殊调试时才需要覆盖。

## 4. 为什么这样拆

之前 `db.json` 同时承担了：

1. 种子输入
2. file 模式运行态持久化

这会直接造成：

1. 运行态数据污染种子
2. `db.json` 变成不可审计的混合快照
3. Postgres 空库初始化输入不稳定
4. 外键与样本一致性问题被运行态噪音掩盖

## 5. 最小治理要求

如果以后要把某份运行数据升为新 seed，必须先做最小清洗：

1. 去掉运行态集合
   - `sessions`
   - `smsCodes`
   - `auditLogs`
   - `domainEvents`
   - `outboxEvents`
   - `idempotencyRecords`
   - `metricDailyUv`
   - `metricDailyCounters`
   - `metricHourlyCounters`
   - `trackEvents`
   - `actorCsrfTokens`
2. 修复租户/组织/团队/主数据外键一致性
3. 清掉临时联调噪音
4. 单独提交为一次明确的 seed refresh

## 6. 校验入口

统一校验命令：

```bash
npm run lint:state:seed-snapshot
```

该检查会确认：

1. `db.json` 不再带运行态集合
2. `runtime-snapshot.json` 已从 Git 忽略
