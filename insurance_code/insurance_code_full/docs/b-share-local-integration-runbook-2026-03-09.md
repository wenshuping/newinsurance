# B 端分享本地联调与手机测试 Runbook

## 1. 目标

验证以下链路在本地可用：

1. B 端生成分享链接
2. 分享链接指向 C 端 H5，而不是 B 端页面
3. H5 打开后可正确展示分享内容
4. 点击 CTA 后可跳转到 C 端目标页
5. `share_h5_view` / `share_h5_click_cta` 可进入 B 端分享效果统计

## 2. 本地端口基线

默认本地口径：

1. C 端：`http://localhost:3000`
2. B 端：`http://localhost:3004`
3. gateway：`http://127.0.0.1:4100`
4. v1 monolith：`http://127.0.0.1:4000`

## 3. 必要环境变量

### 3.1 B 端

建议在：

`/Users/wenshuping/Documents/New project/insurance_code_B/.env.local`

写入：

```env
VITE_API_BASE_URL=http://127.0.0.1:4100
VITE_C_SHARE_BASE_URL=http://localhost:3000
```

### 3.2 C 端

如果只在电脑浏览器联调，C 端默认 `3000 + 4100` 即可。

如果要真机测试，需要把 C 端 API 也改成电脑局域网 IP：

```env
VITE_API_BASE=http://<LAN_IP>:4100
```

## 4. 桌面联调步骤

### 4.1 B 端生成分享

在 B 端活动详情里点击分享，确认：

1. 不再出现“分享失败，请重试”
2. 弹层中 `Share URL` 以 `http://localhost:3000/share/` 开头
3. `C Path` 指向正确业务页，例如：
   - `/activities?...`
   - `/learning?...`
   - `/mall?...`

### 4.2 H5 预览

点击“预览 H5”，确认：

1. 能打开 `/share/:shareCode`
2. 标题、封面、文案渲染正确
3. CTA 文案正确

### 4.3 跳转目标页

在 H5 页点击 CTA，确认：

1. 活动分享进入活动页
2. 课程分享进入学习页
3. 商品分享进入商城商品详情

## 5. 手机测试路径

## 5.1 同一 Wi-Fi 局域网测试

1. 电脑和手机连接同一 Wi-Fi
2. 获取电脑局域网 IP，例如 `192.168.1.23`
3. C 端使用 `0.0.0.0` 启动，确保手机可访问
4. B 端环境变量改为：

```env
VITE_C_SHARE_BASE_URL=http://192.168.1.23:3000
```

5. C 端环境变量改为：

```env
VITE_API_BASE=http://192.168.1.23:4100
```

6. 重新启动前端
7. 从 B 端生成分享链接
8. 用手机扫码或直接打开该链接

### 5.2 公网预览测试

如果客户不在同一局域网，必须提供公网地址。可选：

1. staging 域名
2. preview 域名
3. 临时 tunnel

原则：

1. `VITE_C_SHARE_BASE_URL` 必须改成公网可访问地址
2. C 端 API base 也必须是公网可访问地址

## 6. B 端分享效果验证

分享创建后，B 端工具页顶部会出现：

1. 生成链接数
2. H5 打开数
3. CTA 点击数
4. 点击转化率
5. 最近分享记录

验证方法：

1. 创建一条分享
2. 打开一次 H5
3. 点击一次 CTA
4. 回到 B 端刷新“分享记录与效果”
5. 期望看到：
   - `totalLinks = 1`
   - `totalViews = 1`
   - `totalClicks = 1`

## 7. 常见问题

### 7.1 分享链接还是 B 端地址

检查：

1. B 端是否设置了 `VITE_C_SHARE_BASE_URL`
2. 返回的 `shareUrl` 是否仍是 `3004`
3. 当前后端是否已包含本地管理端 `origin -> 3000` 兜底逻辑

### 7.2 点击分享报 404

如果 `POST /api/b/shares` 返回：

`Cannot POST /api/b/shares`

说明本地 `4000` 跑的是旧进程，需重启当前工作区 API。

### 7.3 手机能打开 H5，但数据加载失败

高概率是：

1. C 端 `VITE_API_BASE` 仍指向 `127.0.0.1`
2. 手机无法访问电脑本机回环地址

必须改成电脑局域网 IP 或公网域名。

## 8. 本次联调结论

本次已在本机验证：

1. `POST /api/b/shares` 可成功返回
2. 本地 `Origin: http://localhost:3004` 时，`shareUrl` 会返回 C 端 `http://localhost:3000/share/...`
3. `GET /api/b/shares` 可返回最近分享记录与效果统计
4. `share_h5_view` / `share_h5_click_cta` 可被聚合到分享效果统计

未实际执行：

1. 真机扫码打开
2. 公网分享链路

这两项需要按第 5 节的网络口径执行。
