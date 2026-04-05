# shared-contracts

共享契约目录（P/B/C 前端 + Node/Java 后端共用）。

## 目标

1. 统一 DTO/枚举/错误码，减少联调字段漂移。
2. 为 v1 契约冻结提供单一引用源。
3. 为 Java 迁移阶段提供兼容类型层。

## 当前内容

1. `common.ts`
- 会话契约与统一响应信封。

2. `c-endpoint.ts`
- C 端核心用户/活动/积分类型。

3. `error-codes.ts`
- C 端与通用鉴权错误码基线。

4. `index.ts`
- 导出入口。

## 使用方式

在 `insurance_code/tsconfig.json` 已配置：
- `@contracts/* -> ../shared-contracts/*`

示例：

```ts
import type { CUserContract, VerifyBasicResponseContract } from '@contracts/index';
```

## 变更规则（冻结期）

1. v1 冻结期间：只允许新增可选字段，不允许删除/重命名已有字段。
2. 错误码仅允许追加，不允许修改语义。
3. 任何契约改动必须同步更新：
- OpenAPI
- 冻结清单
- 回归测试用例
