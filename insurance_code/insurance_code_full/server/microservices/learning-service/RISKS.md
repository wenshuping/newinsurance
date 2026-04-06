# Learning Service 风险清单

更新时间：2026-03-08  
负责人：B 号（Week12 设计输入）

Week14 注记：

1. `executeLearningComplete() -> appendPoints()` 这条 P0 风险已关闭
2. 当前风险焦点已转成 `points-service` 上游可用性、双写入口遗留、管理面读取回归

## 1. 风险总览

| 风险 | 等级 | 当前表现 | 不处理后果 | 建议 |
|---|---|---|---|---|
| 学习奖励上游不可用 | P1 | `complete` 通过内部 HTTP 调 `points-service` 结算奖励 | points 上游异常会让完成链路返回 502 | 保持 idempotency + 监控上游成功率 |
| 学习内容双写入口 | P1 | `p-admin` 与 `b-admin` 都可写 learning 内容 | ownership 漂移，后续难 gate | 先收口主写入口，再保留桥接 |
| 运行态模型重复 | P1 | `learningCourses` / `pLearningMaterials` / `p_learning_materials` 并存 | 设计和落地口径不一致 | 评审时先定唯一 owned table |
| games/tools 无稳定主表 | P2 | 只有列表能力，没稳定 schema 线索 | 第一阶段拆分范围失控 | 先列为 phase_2_optional |
| 报表/画像依赖学习数据 | P1 | `b-admin-customers`、`p-admin-metrics` 读取学习数据 | 拆分后管理面回归风险高 | 先定义查询桥接或兼容层 |
| 权限逻辑与学习内容模板耦合 | P2 | `canAccessTemplate`、`permissionRequired` 依赖共享状态 | 拆分后权限判断可能漂移 | 先复用共享中间件，后续再专题治理 |

## 2. 风险细化

## 2.1 学习奖励上游可用性

现状：

1. 学习完成动作仍会写课程完成记录
2. 奖励结算当前通过 `learning-service -> points-service` 内部 HTTP 契约执行

风险判断：

1. 直写 points 主写表的越界风险已经关闭
2. 当前主要风险变成 `points-service` 上游不可用时，`complete` 会返回契约错误

建议：

1. 保持“完成课程”与“奖励结算”在当前事务窗口内一致回滚
2. 对 `LEARNING_POINTS_UPSTREAM_UNAVAILABLE` 和 `LEARNING_POINTS_CONTRACT_REJECTED` 保持可观测
3. 后续再决定是否从同步 HTTP 升级为事件化

## 2.2 学习内容双写入口

现状：

1. `p-admin-learning` 在写 `learningCourses`
2. `b-admin-content` 也在写 `learningCourses`
3. 且 `b-admin-content` 还会同步写 `pLearningMaterials`

风险判断：

1. 如果未来 `learning-service` 只接一组入口，另一组入口会继续绕过它
2. 这会直接让 write boundary gate 失效

建议：

1. 先认定 `/api/p/learning/courses*` 是 learning 域主写入口
2. `b-admin` 改为桥接，不再保留底层直写资格

## 2.3 模型重复

现状：

1. 运行态使用 `learningCourses`
2. 部分管理逻辑使用 `pLearningMaterials`
3. 实库主表是 `p_learning_materials`

风险判断：

1. 如果文档、代码、gate 三套命名不统一，评审结论无法落地

建议：

1. 设计文档一律以 `p_learning_materials`、`c_learning_records` 为主
2. 其余都标记为兼容层或投影视图

## 2.4 管理面读取回归

现状：

1. 客户画像、指标报表会直接读取学习记录
2. 这些读取目前还在单体内共享状态里完成

风险判断：

1. learning-service 拆出后，最容易先坏的是报表，不是 C 端主流程

建议：

1. 先枚举依赖 learning 数据的管理页
2. 再决定是保留直读只读库、走查询 API，还是经 gateway 聚合

## 2.5 权限耦合

现状：

1. 学习内容模板可见性依赖共享角色/权限状态
2. 这不是纯 learning 域内部规则

风险判断：

1. 如果 Week12 把学习拆分和权限治理一起做，范围会失控

建议：

1. Week12 先冻结权限来源
2. learning-service 只复用共享中间件，不改权限模型

## 3. B 号结论

1. `learning-service` 设计可以继续
2. 但第一优先级不是加路由，而是先切断直写积分和双写入口
3. 如果这两个问题不先处理，后面再多的 gate 也只能拦住一部分回归
