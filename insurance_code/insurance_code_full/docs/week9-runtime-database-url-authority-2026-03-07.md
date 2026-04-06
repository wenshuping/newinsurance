# Week9 Runtime Split `DATABASE_URL` 权威口径

更新时间：2026-03-07

## 1. 结论

从 Week9 开始，`DATABASE_URL` 统一按以下规则解释：

1. 统一使用 `postgresql://`
2. 不允许继续使用 `postgres://`
3. 不允许把 `sslmode` 拼进 `DATABASE_URL`
4. `SSL` 一律通过 `PGSSL` 控制
5. `STORAGE_BACKEND=postgres` 时，所有服务都必须遵循同一口径

## 2. 权威模板

### 2.1 dev

```env
DATABASE_URL=postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev
PGSSL=disable
```

### 2.2 staging

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@<staging-db-host>:5432/insurance_runtime_staging
PGSSL=require
```

### 2.3 prod

```env
DATABASE_URL=postgresql://<db_user>:<db_password>@<prod-db-host>:5432/insurance_runtime_prod
PGSSL=require
```

## 3. 约束

1. `DATABASE_URL` 只表达：
   1. 协议
   2. 用户名/密码
   3. 主机
   4. 端口
   5. 数据库名
2. `SSL` 不放在 URL query 里
3. 所有公共模板、compose、runbook 必须以本文件为准
4. 旧文档若有历史示例，以本文件覆盖为准

## 4. 公共入口

当前与本口径绑定的公共文件：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/.env.example`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.dev.env.example`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.staging.env.example`
4. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/deploy/env/runtime-split.prod.env.example`
5. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docker-compose.dev.yml`
6. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docker-compose.runtime-split.yml`

## 5. 校验入口

统一校验命令：

```bash
npm run lint:env:database-url-authority
```

如果这里失败，说明公共模板和权威口径已经漂移。
