## 变更摘要

- 

## 风险与回滚

- 风险点：
- 回滚方式：

## 发布前自检（必填）

- [ ] 已在本地执行 `npm run release:preflight` 且通过
- [ ] 已在本地执行 `npm run lint:branch-protection:required-checks` 且通过
- [ ] 本次修改若涉及 `.github/workflows/quality-gates.yml` job 名，已同步更新 `docs/release-branch-protection-v1.md`
- [ ] 本次修改若涉及 quality gate 名称，已同步更新 GitHub Branch protection required checks

## 报告与证据

- release preflight 报告：`docs/reports/release-preflight-YYYYMMDD-HHMMSS.json`
- release preflight Markdown：`docs/reports/release-preflight-YYYYMMDD-HHMMSS.md`
- perf baseline 报告（如有）：`docs/reports/perf-baseline-YYYYMMDD-HHMMSS.json`

## 回归范围

- [ ] C 端关键路径（登录/积分/活动/商城）
- [ ] B 端关键路径（客户/内容/活动/商城）
- [ ] P 端关键路径（租户/指标/策略/模板）
