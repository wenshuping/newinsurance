# B 端分享类型治理（v1）

更新时间：2026-03-05  
适用范围：`insurance_code_B`

## 1. 目标

将 B 端获客工具分享链路中的页面内类型定义收敛到 `shared-contracts`，避免跨端埋点路径口径漂移。

## 2. 本次改动

共享契约新增：

- `shared-contracts/b-share.ts`
  - `BToolKind`
  - `BSharePath`
  - `B_SHARE_TRACK_EVENTS`
  - `bToolKindShareLabel`
  - `bToolKindDetailTitle`
  - `bToolKindShareButtonLabel`
  - `bToolKindDetailSharePath`

并在：

- `shared-contracts/index.ts` 导出 `b-share`

B 端接入：

- `insurance_code_B/src/lib/shareTypes.ts` 作为桥接层导出共享类型
- `insurance_code_B/src/lib/shareTypes.ts` 作为桥接层导出共享类型与 `bToolKindShareLabel`
- `insurance_code_B/src/lib/shareTypes.ts` 作为桥接层导出 `B_SHARE_TRACK_EVENTS`
- `insurance_code_B/src/App.tsx` 中 `ToolsView` 移除本地：
  - `type ToolKind`
  - `type SharePath`
- 改为使用桥接类型：
  - `BToolKind`
  - `BSharePath`
- 分享标题分类文案改为 `bToolKindShareLabel(kind)`，不再使用页面内三元表达式
- 详情弹窗标题改为 `bToolKindDetailTitle(kind)`
- 详情弹窗分享路径改为 `bToolKindDetailSharePath(kind)`
- 详情弹窗分享按钮文案改为 `bToolKindShareButtonLabel(kind)`
- 分享埋点事件名改为 `B_SHARE_TRACK_EVENTS.*`，不再硬编码字符串

## 3. 防回退校验

脚本：`scripts/check_b_share_types_bridge.mjs`

校验项：

- `shared-contracts/b-share.ts` 已定义并导出 `BToolKind/BSharePath`
- `shared-contracts/index.ts` 已导出 `b-share`
- B 端桥接层已导出该类型
- B 端页面使用桥接类型与共享 `bToolKindShareLabel`
- B 端页面使用桥接类型与共享 `bToolKindShareLabel/bToolKindDetailTitle/bToolKindShareButtonLabel/bToolKindDetailSharePath`
- B 端页面使用桥接常量 `B_SHARE_TRACK_EVENTS`
- 禁止回退为页面内 `type ToolKind/type SharePath`、本地详情/分享三元表达式、硬编码埋点事件名

执行：

```bash
npm run test:smoke:share-governance
npm run lint:b-frontend:share-types-bridge
npm run test:smoke:b-share-contracts
```

推荐一键执行（前端治理聚合）：

```bash
npm run test:smoke:frontend-governance
```

语义 smoke（新增）：

- `scripts/smoke_b_share_contracts.ts`
- 校验 `b-share` 中映射函数和 `B_SHARE_TRACK_EVENTS` 的行为输出，避免仅靠静态字符串检查

## 4. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:b-frontend:share-types-bridge`
- `npm run test:smoke:b-share-contracts`
