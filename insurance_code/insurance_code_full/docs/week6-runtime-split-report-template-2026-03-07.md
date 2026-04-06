# Week6 Runtime Split Final Report Template

Date:
Owner:
Branch:
Commit:

## 1. Run Entry

- Local command:
- CI command:
- Storage backend:

## 2. Scope

- `gateway-service`
- `user-service`
- `points-service`

## 3. Boundary Gate Result

### 3.1 Route ownership

- `gateway -> user-service`:
- `gateway -> points-service`:
- route overlap:

### 3.2 Cross-service import check

- `user-service -> points-service`:
- `points-service -> user-service`:

## 4. Smoke Result

### 4.1 Service smoke

- `user-service`:
- `points-service`:
- `gateway`:

### 4.2 Full-chain smoke

- login:
- `GET /api/me`:
- sign-in:
- points summary:
- points detail:
- mall items:
- mall activities:
- redeem:
- orders list:
- order detail:
- pay:
- cancel:
- refund:
- writeoff:
- repeated sign-in idempotency:
- repeated writeoff idempotency:

### 4.3 Cutover / fallback

- V2 default:
- forced V1:
- back to V2:
- read-path fallback:

## 5. Pass Items

1.
2.
3.

## 6. Not Passed

1.
2.

## 7. Risks

1.
2.
3.

## 8. Conclusion

- Ready for next stage:
- Blocking issue owner:
- Required follow-up:
