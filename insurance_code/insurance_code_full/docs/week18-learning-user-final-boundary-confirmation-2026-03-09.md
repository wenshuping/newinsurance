# Week18 Learning / User 最终边界确认

更新时间：2026-03-09  
负责人：B 号

## 1. 最终结论

1. `learning-service` 已正式拆出
2. `user-service` 边界未被打穿
3. `tenant / owner / session / csrf` 口径保持不变

## 2. 确认项

1. `activity-service` 与本结论无关，本次只针对 `learning-service`
2. `auth / me` 仍归 `user-service`
3. `learning-service` 不主写 `app_users / c_customers / p_sessions`
4. `learning-service` 只消费共享身份上下文
5. monolith 仅保留最小读 fallback 与 bridge，不再构成 user 边界阻塞

## 3. 结论口径

1. 现在可以把 learning 域视为正式拆出
2. 从 user 侧看，不再存在 learning 残留主写路径导致的阻塞项
