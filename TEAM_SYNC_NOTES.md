# Team Sync Notes

Last updated: 2026-02-25
Workspace: /Users/wenshuping/Documents/New project

## Repositories
- C端主仓: /Users/wenshuping/Documents/New project/insurance_code
- B端前端: /Users/wenshuping/Documents/New project/insurance_code_B
- P端前端: /Users/wenshuping/Documents/New project/insurance_code_P

## Current Branch Ownership
- C端同学分支: codex/signin-points-fix-20260224
- 我（Codex）P端分支: codex/p-tenant-ui-20260225
- 我（Codex）B端分支: codex/b-ui-isolation-20260225

## Collaboration Rules
- C端改动只在 insurance_code（不改 P/B 仓库）
- P端改动只在 insurance_code_P
- B端改动只在 insurance_code_B
- 提交时按仓库分别提交，禁止跨仓混提
- 合并顺序建议：先各仓库自测通过，再逐仓合并

## Runtime (provided earlier)
- 前端（C端）: http://localhost:3003/
- 后端: http://127.0.0.1:4000
- 健康检查: GET /api/health -> {"ok":true,"service":"insurance-api"}

## Next Action Queue
- [x] P端：确认“租户列表/创建租户”菜单与页面路由一致（2026-02-25，已在 insurance_code_P 实现并 build 通过）
- [ ] B端：继续业务员端页面联调
- [ ] C端：等待同学修复完成后做联调验收
