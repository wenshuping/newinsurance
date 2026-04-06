# WeChat Mini Program Video Channel Stub

This is a minimal Mini Program scaffold for `video_channel` courses.

Recommended route:

- `pages/video-channel/index`
- Uses `finderUserName + feedId + nonceId`
- Calls `wx.openChannelsActivity` to hand off to WeChat's native video-channel view

Legacy compatibility route:

- `pages/video-channel-embed/index`
- Uses `feed-token`
- Keeps older `channel-video` based experiments available while historical data is being migrated

Current course mapping:

- Course title: `视频号测试`
- Recommended Mini Program page: `pages/video-channel/index?finderUserName=<sph...>&feedId=<feedId>&nonceId=<nonceId>`

Import this directory into WeChat DevTools as a standalone Mini Program
project, then publish or copy the files into your actual Mini Program repo.

Files:

- `project.config.json`
- `app.json`
- `app.js`
- `app.wxss`
- `pages/video-channel/index.js`
- `pages/video-channel/index.wxml`
- `pages/video-channel/index.wxss`
- `pages/video-channel-embed/index.js`
- `pages/video-channel-embed/index.wxml`
- `pages/video-channel-embed/index.wxss`
