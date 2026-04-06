Page({
  data: {
    finderUserName: '',
    feedId: '',
    nonceId: '',
    errorText: '',
    pending: false,
  },

  normalizeQueryValue(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  },

  onLoad(query) {
    const finderUserName = this.normalizeQueryValue(query.finderUserName);
    const feedId = this.normalizeQueryValue(query.feedId);
    const nonceId = this.normalizeQueryValue(query.nonceId);
    this.setData({
      finderUserName,
      feedId,
      nonceId,
      errorText:
        finderUserName && feedId
          ? ''
          : '缺少 finderUserName 或 feedId，当前无法跳转视频号内容。',
    });
  },

  handleOpen() {
    const { finderUserName, feedId, nonceId, pending } = this.data;
    if (pending) return;
    if (!finderUserName || !feedId) {
      this.setData({ errorText: '缺少 finderUserName 或 feedId，当前无法跳转视频号内容。' });
      return;
    }
    if (!wx.openChannelsActivity) {
      this.setData({ errorText: '当前微信版本不支持打开视频号内容，请升级微信后重试。' });
      return;
    }
    this.setData({ pending: true, errorText: '' });
    const payload = {
      finderUserName,
      feedId,
      ...(nonceId ? { nonceId } : {}),
      success: () => {
        this.setData({ pending: false, errorText: '' });
      },
      fail: (error) => {
        this.setData({
          pending: false,
          errorText: String(
            error?.errMsg || (
              nonceId
                ? '打开视频号内容失败，请检查参数或视频号权限。'
                : '未填写 nonceId 的兼容试跳失败，请补齐 nonceId 后重试。'
            )
          ),
        });
      },
    };
    wx.openChannelsActivity(payload);
  },
});
