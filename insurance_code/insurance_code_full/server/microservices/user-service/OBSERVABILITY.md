# user-service observability

## Runtime metrics

1. Login success rate
   1. source route: `POST /api/auth/verify-basic`
   2. counters: `attempts`, `success`, `failure`
   3. derived metrics: `successRate`, `failureRate`
2. `/api/me` status distribution
   1. source route: `GET /api/me`
   2. counters: `requests`, `clientError4xx`, `serverError5xx`
3. Token anomaly counters
   1. scope: `GET /api/me`
   2. counters:
      1. `missingBearer`
      2. `invalidBearer`
      3. `sessionNotFound`
      4. `userNotFound`

## Log fields

Required fields:

1. `trace_id`
2. `user_id`
3. `tenant_id`
4. `route`
5. `result`

Current structured log payload also includes:

1. `timestamp`
2. `service`
3. `status`
4. `code`
5. `duration_ms`
6. `method`

## Error classification

| code | category | http status | route |
|---|---|---:|---|
| `INVALID_PARAMS` | `input_validation` | 400 | `send-code`, `verify-basic` |
| `SMS_LIMIT_REACHED` | `rate_limit` | 429 | `send-code` |
| `SEND_CODE_FAILED` | `runtime` | 400 | `send-code` |
| `CODE_NOT_FOUND` | `verification` | 400 | `verify-basic` |
| `CODE_EXPIRED` | `verification` | 400 | `verify-basic` |
| `TENANT_REQUIRED` | `tenant_context` | 400 | `verify-basic` |
| `VERIFY_BASIC_FAILED` | `runtime` | 400 | `verify-basic` |
| `UNAUTHORIZED` | `token_auth` | 401 | `GET /api/me` |
| `TOKEN_MISSING` | `token_anomaly` | 401 | `GET /api/me` |
| `TOKEN_INVALID` | `token_anomaly` | 401 | `GET /api/me` |
| `SESSION_NOT_FOUND` | `token_anomaly` | 401 | `GET /api/me` |
| `USER_NOT_FOUND` | `token_anomaly` | 401 | `GET /api/me` |
| `ME_TOUCH_FAILED` | `runtime` | 200 | `GET /api/me` degraded success |

## Internal endpoint

1. `GET /internal/user-service/observability`

Returns:

1. metrics snapshot
2. log field spec
3. error catalog
4. error stats
5. recent structured logs

## Week7 smoke

```bash
node scripts/smoke_user_service_week7_observability.mjs
```
