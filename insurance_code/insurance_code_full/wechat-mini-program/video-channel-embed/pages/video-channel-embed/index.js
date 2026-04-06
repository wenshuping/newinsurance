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
