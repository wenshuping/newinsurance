# 本地联调启动与防串环境手册（v1）

更新时间：2026-03-02

## 目标

避免出现“代码已改但页面没变”的串环境问题（常见原因：浏览器连到了旧服务或 SSH 隧道）。

## 标准启动方式（唯一入口）

在项目根目录执行：

```bash
cd "$(git rev-parse --show-toplevel)"
npm run dev:stack:restart
```

该命令会先停后起，统一启动 4 个服务：

- C 端：`http://localhost:3003`
- B 端：`http://localhost:3004`
- P 端：`http://localhost:3005`
- API：`http://localhost:4000`

并且在 API 启动前自动执行：

- `npm run db:mall:backfill-source-product-id`（修复 `mallItems.tenantId/sourceProductId`）
- `npm run db:fk:precheck`（外键预检查）

## 状态检查

```bash
npm run dev:stack:status
```

预期每个服务都是 `managed=up`，并且端口持有者是 `node` 进程，不是 `ssh`。

## 串环境快速排查

### 1) 检查是否被 SSH 隧道占口

```bash
lsof -nP -iTCP:3003 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

如果 `COMMAND` 是 `ssh`，说明前端/API 流量走到了隧道，不是本地新代码。

### 2) 检查前端当前加载的包

```bash
curl -s http://127.0.0.1:3003 | grep -E -n "index-.*\\.js|<title>"
```

如发现是旧 bundle，执行标准启动方式重新拉起。

## 浏览器侧会话清理（排除旧 token 影响）

在 DevTools Console 执行：

```js
localStorage.removeItem('insurance_token');
sessionStorage.clear();
location.reload();
```

然后重新登录目标客户账号再测。

## 常见现象与处理

- 现象：`/api/points/summary` 返回 `401`
  - 原因：未登录或 token 失效
  - 处理：清理会话并重新登录
- 现象：页面和接口口径不一致
  - 原因：串到了旧前端/旧 API
  - 处理：执行 `npm run dev:stack:restart`，再用 `status + lsof` 复核

## 审计留痕（建议）

联调完成后，建议保留一份门禁与发布前检查报告：

```bash
npm run ci:gate:core:report
npm run test:perf:baseline
npm run release:preflight
```

报告目录：`docs/reports/`  
治理规范：`docs/reports-governance-v1.md`
