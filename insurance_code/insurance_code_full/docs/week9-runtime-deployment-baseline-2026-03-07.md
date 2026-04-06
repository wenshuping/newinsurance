# Week9 Runtime Split 部署基线

更新时间：2026-03-07

## 1. 目标

Week9 只做部署基线，不扩业务功能。

当前交付：

1. 三服务 + `v1-monolith` + Postgres 的 compose 编排
2. `dev / staging / prod` 环境变量模板
3. 部署后 postcheck 脚本
4. 统一公共入口挂载到 `package.json`
5. `DATABASE_URL` 权威口径

## 2. 部署编排文件

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docker-compose.runtime-split.yml`

包含：

1. `postgres`
2. `v1-monolith`
3. `user-service`
4. `points-service`
5. `gateway`

## 3. 环境变量模板

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.dev.env.example`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.staging.env.example`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.prod.env.example`
4. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/week9-runtime-database-url-authority-2026-03-07.md`

## 4. 执行入口

拉起：

```bash
docker compose -f docker-compose.runtime-split.yml up --build
```

部署后检查：

```bash
npm run postcheck:week9-runtime-split
```

## 5. postcheck 覆盖

1. `gateway /health`
2. `gateway /ready`
3. `gateway /internal/gateway/metrics`
4. `gateway /internal/ops/overview`
5. `user-service /ready`
6. `user-service /metrics`
7. `points-service /ready`
8. `points-service /metrics`
9. `v1-monolith /api/health`

## 6. 当前限制

1. 这是准生产部署基线，不是最终生产编排
2. 目前仍使用 `Dockerfile.dev` 作为统一镜像基线
3. 真正的生产镜像裁剪、密钥管理、外部告警接入，放到后续 Week9-Week11 继续收口
4. `DATABASE_URL` 一律以 `./week9-runtime-database-url-authority-2026-03-07.md` 为准
