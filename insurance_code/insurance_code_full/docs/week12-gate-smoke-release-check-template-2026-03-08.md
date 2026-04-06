# 新服务拆分 Gate / Smoke / Release-Check 模板（Week12）

更新时间：2026-03-08  
负责人：A 号  
用途：供 `activity-service` / `learning-service` 在 Week13+ 统一复用

## 1. 目标

任何新服务试点都必须先有模板化的三层门禁：

1. `gate`
2. `smoke`
3. `release-check`

不允许先改业务代码，再事后补脚本。

## 2. gate 模板

### 2.1 静态边界检查

必须有：

1. owned routes 漂移检查
2. 主写表越权检查
3. 跨服务直接 import 检查
4. 契约文档存在性检查

### 2.2 命名模板

1. `scripts/check_<service>_boundary_guard.mjs`
2. `scripts/check_<service>_frontend_bridge.mjs`（如果涉及前端桥接）
3. `scripts/gate_<service>_trial.mjs`

### 2.3 最低通过条件

1. 不改已冻结协议
2. 不改别的服务主写边界
3. 所有新增 owned routes 都有文档来源

## 3. smoke 模板

### 3.1 服务级 smoke

至少包含：

1. `/health`
2. `/ready`
3. 一条读路径
4. 一条写路径
5. 一条幂等路径

### 3.2 链路级 smoke

至少包含：

1. `gateway -> new-service`
2. `new-service -> upstream/downstream`
3. 回退后旧路径可用

### 3.3 命名模板

1. `scripts/smoke_<service>_trial.mjs`
2. `scripts/smoke_<service>_contract.mjs`

## 4. release-check 模板

### 4.1 演练场景

至少包含：

1. 默认旧路径
2. 灰度租户走新路径
3. 指定路径走新路径
4. 指定路径强制回旧路径
5. 上游异常 fallback 或回退动作

### 4.2 结果落盘

必须输出：

1. `docs/reports/<service>-trial-latest.json`
2. `docs/reports/<service>-trial-latest.md`

### 4.3 命名模板

1. `scripts/smoke_<service>_release_drill.mjs`
2. `npm run release-check:<service>`

## 5. package 入口模板

建议统一模式：

```json
{
  "scripts": {
    "test:smoke:<service>": "node scripts/smoke_<service>_trial.mjs",
    "release-check:<service>": "node scripts/smoke_<service>_release_drill.mjs",
    "gate:<service>": "node scripts/gate_<service>_trial.mjs"
  }
}
```

## 6. 文档模板

每个新服务最少要有：

1. 设计包
2. 边界评审输入
3. gate/runbook
4. release-check 演练记录
5. 风险清单

## 7. 进入 Week13 的前置条件

1. 设计包已评审
2. owned routes 有来源
3. 主写表归属已入总表
4. gate / smoke / release-check 模板已落盘
5. 明确只做试点，不做全量切换
