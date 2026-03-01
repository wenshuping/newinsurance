# API v1 Contract Freeze Checklist (Review Draft)

Version: `v1.0.0`  
Frozen at: `2026-03-01`

## 1. Frozen files

1. `shared-contracts/index.ts`
2. `shared-contracts/common.ts`
3. `shared-contracts/c-endpoint.ts`
4. `shared-contracts/error-codes.ts`
5. `shared-contracts/v1-freeze-manifest.json`

## 2. Frozen C-end endpoints

1. `GET /api/health`
2. `POST /api/auth/send-code`
3. `POST /api/auth/verify-basic`
4. `GET /api/me`
5. `GET /api/activities`
6. `POST /api/sign-in`
7. `GET /api/points/summary`
8. `GET /api/points/transactions`
9. `GET /api/mall/items`
10. `POST /api/mall/redeem`
11. `GET /api/redemptions`
12. `POST /api/redemptions/:id/writeoff`

## 3. Backward compatibility rules

1. Do not remove fields from existing response payloads.
2. New fields must be optional for v1 clients.
3. Any breaking change requires a new version manifest.

## 4. Validation command

Run:

```bash
npm run contracts:freeze:check
```

