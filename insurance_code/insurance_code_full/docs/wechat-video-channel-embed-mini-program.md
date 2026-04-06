# 视频号内嵌小程序承接页

> 2026-03-21 更新：当前主推荐方案已经切回“视频号跳转承接”，推荐小程序路径为 `pages/video-channel/index?finderUserName=<sph...>&feedId=<feedId>&nonceId=<nonceId>`。本文保留为旧的 `feed-token + channel-video` 内嵌兼容文档，仅供历史数据排查使用。

当前 `video_channel` 课程已经统一使用这条小程序路径：

```txt
pages/video-channel-embed/index?feedToken=<urlencoded-feed-token>
```

适用场景：

- H5 课程详情页点击“进入小程序观看”
- 小程序承接页内使用 `<channel-video />` 播放 `feed-token`

## 1. app.json

把页面注册进你们的小程序：

```json
{
  "pages": [
    "pages/video-channel-embed/index"
  ]
}
```

如果你们已有 `pages` 列表，只需要把这一项补进去。

## 2. pages/video-channel-embed/index.js

```js
Page({
  data: {
    feedToken: '',
    errorText: '',
  },

  onLoad(query) {
    const feedToken = decodeURIComponent(String(query.feedToken || '')).trim();
    this.setData({
      feedToken,
      errorText: feedToken ? '' : '缺少 feed-token，无法播放视频号内容',
    });
  },

  handleRetry() {
    const feedToken = String(this.data.feedToken || '').trim();
    if (!feedToken) {
      this.setData({ errorText: '缺少 feed-token，无法播放视频号内容' });
      return;
    }
    this.setData({ errorText: '' });
  },
});
```

## 3. pages/video-channel-embed/index.wxml

```xml
<view class="page">
  <view class="hero">
    <view class="eyebrow">WECHAT CHANNELS</view>
    <view class="title">视频号课程</view>
    <view class="desc">当前内容通过小程序内嵌组件播放，不在 H5 页面内直接播放。</view>
  </view>

  <view wx:if="{{feedToken}}" class="player-card">
    <channel-video
      feed-token="{{feedToken}}"
    />
  </view>

  <view wx:else class="empty-card">
    <view class="empty-title">无法加载视频号内容</view>
    <view class="empty-desc">{{errorText}}</view>
    <button class="retry-btn" bindtap="handleRetry">重新检查参数</button>
  </view>
</view>
```

## 4. pages/video-channel-embed/index.wxss

```css
.page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 36%),
    linear-gradient(180deg, #f3fbf7 0%, #e8fff5 100%);
  padding: 32rpx 24rpx 48rpx;
  box-sizing: border-box;
}

.hero {
  background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  color: #ffffff;
  box-shadow: 0 24rpx 60rpx rgba(6, 95, 70, 0.18);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.title {
  margin-top: 20rpx;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.2;
}

.desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

.player-card,
.empty-card {
  margin-top: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(16, 185, 129, 0.18);
  border-radius: 32rpx;
  padding: 24rpx;
  box-shadow: 0 20rpx 48rpx rgba(15, 23, 42, 0.08);
}

.empty-card {
  padding: 48rpx 32rpx;
  text-align: center;
}

.empty-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #0f172a;
}

.empty-desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #475569;
}

.retry-btn {
  margin-top: 28rpx;
  border-radius: 999rpx;
  background: #10b981;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
}
```

## 5. 和当前课程的对应关系

当前已经创建的课程：

- 标题：`视频号测试`
- 课程 ID：`123`
- 小程序路径：`pages/video-channel-embed/index?feedToken=...`

也就是说，小程序仓只要把这个页面按上面的文件名放进去，当前课程就能直接对上。

## 6. 上线前检查

- 小程序基础库满足 `channel-video` 组件要求
- 小程序主体与视频号内嵌能力条件满足微信官方限制
- `feed-token` 是从视频号助手“复制视频ID”得到的 `export/...`
- H5 所在公众号已经配置 `JS接口安全域名`
