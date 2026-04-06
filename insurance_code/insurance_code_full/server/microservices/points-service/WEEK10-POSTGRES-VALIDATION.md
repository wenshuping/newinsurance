# Week10 Points Service Postgres 实库验证

更新时间：2026-03-07  
负责人：C 号（points-service）

## 1. 目标

Week10 只定义并执行 `points-service` 的实库验证口径，不改业务语义。

重点对象：

- `c_point_accounts`
- `c_point_transactions`
- `p_products`
- `p_orders`
- `c_redeem_records`
- `c_sign_ins`

本文件不是建表设计文档，而是上线前、切流前、故障后用于验库的操作手册。

## 2. 先讲清楚当前口径

### 2.1 `c_point_accounts` 是逻辑主写边界，不是当前 bootstrap 的物理权威表

当前 `points-service` 在 Postgres 模式下会读取：

- `c_point_transactions`
- `p_products`
- `c_redeem_records`
- `p_orders`
- `c_sign_ins`

然后根据 `c_point_transactions.balance_after` 反推出内存里的 `pointAccounts` 快照。

结论：

1. 现在的运行时权威余额来源是 `c_point_transactions`
2. `c_point_accounts` 在 Week10 验库里只能当“逻辑账户口径”或外部对账对象
3. 如果线上环境单独存在 `c_point_accounts` 物理表，必须和 `c_point_transactions` 推导余额做对账，不能直接假定它就是运行时 source of truth

### 2.2 `c_redeem_records` 当前物理表没有 `order_id`

当前 Postgres 写入 `c_redeem_records` 的字段是：

- `id`
- `tenant_id`
- `customer_id`
- `product_id`
- `points_cost`
- `writeoff_token`
- `status`
- `expires_at`
- `written_off_at`
- `created_by`
- `created_at`
- `updated_at`
- `is_deleted`

没有 `order_id`。

结论：

1. 订单与兑换记录的数据库级直连 join 不是当前 schema 的标准能力
2. 应用内存模型里存在 `redemption.orderId`，但这不是当前实库验收可直接依赖的物理列
3. Week10 验库要把“订单一致性”和“兑换记录存在性”拆开验证，不要写成单条 SQL 一步 join 结论

## 3. 验证前置条件

执行实库验证前先确认：

1. `STORAGE_BACKEND=postgres`
2. `DATABASE_URL` 指向目标环境
3. `/ready` 返回 `200`
4. 本次验证的 tenant 范围明确
5. 当前窗口没有人工批量补数据操作

## 4. 表级验证清单

### 4.1 `c_point_transactions`

用途：

- 当前积分账户余额的权威来源
- 签到奖励、兑换扣点、退款返还都依赖这张表

必须验证：

1. 无重复 `idempotency_key`
2. 无负数 `balance_after`
3. `direction` 只出现 `in` / `out`
4. 同一 `customer_id` 的最新 `balance_after` 与应用展示余额一致

建议 SQL：

```sql
SELECT COUNT(*) AS duplicated_idempotency_keys
FROM (
  SELECT idempotency_key
  FROM c_point_transactions
  WHERE is_deleted = FALSE
  GROUP BY idempotency_key
  HAVING COUNT(*) > 1
) t;
```

```sql
SELECT id, tenant_id, customer_id, amount, balance_after, source_type, source_id
FROM c_point_transactions
WHERE is_deleted = FALSE
  AND balance_after < 0
ORDER BY id DESC
LIMIT 50;
```

```sql
SELECT direction, COUNT(*)
FROM c_point_transactions
WHERE is_deleted = FALSE
GROUP BY direction;
```

```sql
SELECT customer_id, balance_after, created_at
FROM (
  SELECT customer_id, balance_after, created_at,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY id DESC) AS rn
  FROM c_point_transactions
  WHERE is_deleted = FALSE
) t
WHERE rn = 1
ORDER BY customer_id
LIMIT 100;
```

### 4.2 `c_point_accounts`

用途：

- 逻辑主写边界账户口径
- 当前 Week10 用于对账，不作为当前 runtime 唯一权威来源

验证方式：

1. 如果目标库没有物理 `c_point_accounts`，记录为“按交易流水推导账户余额”
2. 如果目标库有物理 `c_point_accounts`，按 `customer_id` 对比最新 `balance_after`

建议 SQL：

```sql
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'c_point_accounts'
) AS has_c_point_accounts;
```

如果存在物理表，再跑：

```sql
WITH latest_tx AS (
  SELECT customer_id, balance_after,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY id DESC) AS rn
  FROM c_point_transactions
  WHERE is_deleted = FALSE
)
SELECT a.customer_id,
       a.balance AS account_balance,
       tx.balance_after AS tx_balance
FROM c_point_accounts a
LEFT JOIN latest_tx tx
  ON tx.customer_id = a.customer_id
 AND tx.rn = 1
WHERE COALESCE(a.balance, -1) <> COALESCE(tx.balance_after, -1)
LIMIT 100;
```

### 4.3 `p_products`

用途：

- 兑换商品基表

必须验证：

1. `stock >= 0`
2. `points_cost > 0`
3. `shelf_status` 只出现 `on` / `off`

建议 SQL：

```sql
SELECT id, tenant_id, name, stock, points_cost, shelf_status
FROM p_products
WHERE is_deleted = FALSE
  AND (stock < 0 OR points_cost <= 0 OR shelf_status NOT IN ('on', 'off'))
ORDER BY id DESC
LIMIT 50;
```

### 4.4 `p_orders`

用途：

- 订单主表
- 当前订单状态、支付状态、履约状态都看这张表

必须验证：

1. `order_no` 不为空且唯一
2. `points_amount >= 0`
3. 状态组合可解释
4. 最近成功兑换产生的订单能查到

建议 SQL：

```sql
SELECT order_no, COUNT(*)
FROM p_orders
GROUP BY order_no
HAVING COUNT(*) > 1;
```

```sql
SELECT id, order_no, status, payment_status, fulfillment_status, refund_status, points_amount
FROM p_orders
WHERE points_amount < 0
   OR order_no IS NULL
   OR order_no = ''
ORDER BY id DESC
LIMIT 50;
```

```sql
SELECT status, payment_status, fulfillment_status, refund_status, COUNT(*)
FROM p_orders
GROUP BY status, payment_status, fulfillment_status, refund_status
ORDER BY COUNT(*) DESC;
```

重点人工判读：

1. `status=paid` 但 `payment_status!=paid` 属于异常
2. `fulfillment_status=written_off` 但 `status` 仍停在 `created` 属于异常
3. `refund_status=refunded` 但没有退款积分流水，需要继续查 `c_point_transactions`

### 4.5 `c_redeem_records`

用途：

- 兑换记录与核销凭证表

必须验证：

1. `writeoff_token` 唯一
2. `status` 只出现 `pending / written_off / expired / cancelled`
3. `written_off_at` 与 `status` 自洽

建议 SQL：

```sql
SELECT writeoff_token, COUNT(*)
FROM c_redeem_records
WHERE is_deleted = FALSE
GROUP BY writeoff_token
HAVING COUNT(*) > 1;
```

```sql
SELECT id, tenant_id, customer_id, status, writeoff_token, expires_at, written_off_at
FROM c_redeem_records
WHERE is_deleted = FALSE
  AND (
    status NOT IN ('pending', 'written_off', 'expired', 'cancelled')
    OR (status = 'written_off' AND written_off_at IS NULL)
    OR (status <> 'written_off' AND written_off_at IS NOT NULL)
  )
ORDER BY id DESC
LIMIT 50;
```

因为没有 `order_id` 物理列，建议额外人工核对：

1. 指定用户最近一笔兑换后，是否同时存在：
   - 一条 `p_orders`
   - 一条 `c_redeem_records`
   - 一条 `c_point_transactions(direction='out')`
2. 三者时间窗口是否一致
3. `points_amount` 与 `points_cost` 是否一致

### 4.6 `c_sign_ins`

用途：

- 每日签到记录

必须验证：

1. 同一用户同一天最多一条签到
2. `sign_date` 不为空
3. 签到奖励与积分流水能对上

建议 SQL：

```sql
SELECT tenant_id, customer_id, sign_date, COUNT(*)
FROM c_sign_ins
GROUP BY tenant_id, customer_id, sign_date
HAVING COUNT(*) > 1;
```

```sql
SELECT s.id, s.customer_id, s.sign_date, tx.id AS tx_id, tx.amount, tx.created_at
FROM c_sign_ins s
LEFT JOIN c_point_transactions tx
  ON tx.customer_id = s.customer_id
 AND tx.source_type = 'sign_in'
 AND tx.is_deleted = FALSE
 AND DATE(tx.created_at) = s.sign_date
WHERE tx.id IS NULL
ORDER BY s.id DESC
LIMIT 50;
```

## 5. 交易闭环对账

除了单表校验，Week10 必须做 3 条闭环核对。

### 5.1 签到闭环

要求：

1. `c_sign_ins` 有记录
2. `c_point_transactions` 有对应 `sign_in` 入账
3. 应用 `GET /api/points/summary` 余额包含该奖励

### 5.2 兑换闭环

要求：

1. `p_orders` 有订单
2. `c_point_transactions` 有 `direction='out'` 的扣点流水
3. `c_redeem_records` 有可核销记录

### 5.3 核销闭环

要求：

1. `c_redeem_records.status='written_off'`
2. `p_orders.fulfillment_status='written_off'`
3. 如果存在 `b_write_off_records`，应有对应成功记录

## 6. 通过标准

Week10 实库验证通过，至少满足：

1. 6 个重点对象都有清晰口径
2. `c_point_transactions` 无关键重复和负余额异常
3. `p_products`、`p_orders`、`c_redeem_records`、`c_sign_ins` 无明显脏数据
4. 签到、兑换、核销各抽样一条能闭环
5. 已明确记录 `c_point_accounts` 与 `c_redeem_records` 的当前物理口径限制

## 7. 遇到异常时怎么处理

1. 先冻结切流，不要带问题扩大流量
2. 先保存 SQL 结果和样本 `customer_id / order_no / writeoff_token`
3. 再判断是：
   - schema 口径问题
   - 数据脏写问题
   - 应用读写映射问题
4. Week10 不在库里临时补字段，不在上线窗口改接口语义
