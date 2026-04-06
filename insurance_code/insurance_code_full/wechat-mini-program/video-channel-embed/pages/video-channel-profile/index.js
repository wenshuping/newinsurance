Page({
  data: {
    finderUserName: '',
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
    this.setData({
      finderUserName,
      errorText: finderUserName ? '' : '缺少视频号ID，当前无法打开视频号主页。',
    });
  },

  handleOpenProfile() {
    const { finderUserName, pending } = this.data;
    if (pending) return;
    if (!finderUserName) {
      this.setData({ errorText: '缺少视频号ID，当前无法打开视频号主页。' });
      return;
    }
    if (!wx.openChannelsUserProfile) {
      this.setData({ errorText: '当前微信版本不支持打开视频号主页，请升级微信后重试。' });
      return;
    }
    this.setData({ pending: true, errorText: '' });
    wx.openChannelsUserProfile({
      finderUserName,
      success: () => {
        this.setData({ pending: false, errorText: '' });
      },
      fail: (error) => {
        this.setData({
          pending: false,
          errorText: String(error?.errMsg || '打开视频号主页失败，请检查视频号ID或当前账号权限。'),
        });
      },
    });
  },
});
