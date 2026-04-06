# 指标与事件口径版本化（v1）

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 目标

1. 将指标规则与事件字典从“纯文本口径”升级为“可追踪版本口径”。
2. 确保配置修改后可识别版本递增，支持回归排查与审计。

## 2. 当前版本号（代码常量）

1. 指标规则本版本：`2026-03-06.v1`
   - 常量：`METRIC_RULEBOOK_VERSION`
   - 位置：`server/skeleton-c-v1/routes/p-admin-metrics.shared.mjs`
2. 事件字典本版本：`2026-03-06.v1`
   - 常量：`EVENT_DICTIONARY_VERSION`
   - 位置：`server/skeleton-c-v1/routes/p-admin-events.shared.mjs`

## 3. 数据库字段

1. `p_metric_rules.rule_version`（`INT NOT NULL DEFAULT 1`）
2. `p_event_definitions.definition_version`（`INT NOT NULL DEFAULT 1`）

## 4. API 返回口径

1. `GET /api/p/metrics/config`
   - 顶层：`rulebookVersion`
   - 每条规则：`ruleVersion`
2. `GET /api/p/events/definitions`
   - 顶层：`dictionaryVersion`
   - 每条定义：`definitionVersion`

## 5. 升版规则

1. 指标规则升版（`ruleVersion + 1`）
   - 当以下任一字段变化：`end`、`name`、`formula`、`period`、`source`
   - 仅状态/备注变化不升版（保留原版本）。
2. 事件定义升版（`definitionVersion + 1`）
   - 当以下任一字段变化：`eventId`、`eventName`、`eventType`、`description`、`collectMethod`、`schema`
   - 仅状态变化不升版。
3. 新建记录：版本号初始化为 `1`。

## 6. 校验与门禁

1. 冒烟：`npm run test:smoke:metric-event-versioning`
   - 覆盖：新建版本=1、更新版本+1、读接口版本字段存在。
2. 核心门禁：`npm run ci:gate:core`
   - 已纳入上述 smoke。

## 7. 变更原则

1. 改口径（分子/分母/时间窗口）必须升业务版本并更新本文档。
2. 改展示文案但不改计算逻辑，可不升版本。
3. 每次版本变更必须同时更新：
   - 代码常量
   - 本文档第 2 节
   - 对应发布说明（若影响线上指标解释）
