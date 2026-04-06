# 前端契约桥接治理（C/B/P）（v1）

更新时间：2026-03-04  
适用范围：`insurance_code_full`、`insurance_code_B`、`insurance_code_P`

## 1. 目标

保证三端前端对状态文案与错误文案的口径一致，避免页面直接散落引用契约层造成分叉。

## 2. 强制约束

每个前端工程必须保留桥接文件：

- `src/lib/templateStatus.ts`（唯一桥接 `@contracts/template-status`）
- `src/lib/ui-error.ts`（唯一 UI 错误桥接 `@contracts/error-ui`）
- `src/lib/api.ts`（允许直接使用 `@contracts/error-ui`，用于请求层统一错误处理）

并限制：

- 禁止在桥接层之外直接引入 `@contracts/template-status`
- 禁止在 `src/lib/ui-error.ts` 与 `src/lib/api.ts` 之外直接引入 `@contracts/error-ui`

## 3. 自动校验

脚本：`scripts/check_frontend_contract_bridge.mjs`

执行命令：

```bash
npm run lint:frontend:contract-bridge
```

校验输出：

- 若 B/P 工程目录缺失，会标记为 `skipped: workspace_not_found`（不阻断）
- 若工程存在但违反约束，直接失败并给出具体文件列表

## 4. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:frontend:contract-bridge`

这样可以在改动 `shared-contracts` 或三端前端时，第一时间发现桥接层回退。
