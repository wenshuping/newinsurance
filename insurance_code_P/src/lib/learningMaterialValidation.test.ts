import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLearningMaterialSubmit } from './learningMaterialValidation.ts';

test('create mode still requires at least one uploaded media file', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'create',
      title: '平台新增课程',
      uploadsCount: 0,
    }),
    '请至少上传一个文件'
  );
});

test('edit mode allows saving status changes without re-uploading media', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'edit',
      title: '平台新增课程',
      uploadsCount: 0,
    }),
    ''
  );
});

test('video channel course requires explicit mini program launch metadata instead of uploaded files', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'create',
      title: '视频号课程',
      uploadsCount: 0,
      sourceType: 'video_channel',
      finderUserName: '',
      feedToken: '',
      feedId: '',
      nonceId: '',
      miniProgramAppId: '',
      miniProgramPath: '',
    }),
    '请填写视频号ID 和 feedId'
  );
});

test('video channel course can be created without uploaded files when jump metadata is complete', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'create',
      title: '视频号课程',
      uploadsCount: 0,
      sourceType: 'video_channel',
      finderUserName: 'sphabc123',
      feedId: 'feed-1',
      miniProgramAppId: 'wx1234567890',
      miniProgramPath: 'pages/video-channel/index?finderUserName=sphabc123&feedId=feed-1',
    }),
    ''
  );
});

test('video channel course can use profile fallback with only video channel id', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'create',
      title: '视频号主页课程',
      uploadsCount: 0,
      sourceType: 'video_channel',
      finderUserName: 'sphabc123',
      launchTarget: 'profile',
      miniProgramAppId: 'wx1234567890',
      miniProgramPath: 'pages/video-channel-profile/index?finderUserName=sphabc123',
    }),
    ''
  );
});

test('video channel course still accepts legacy embed metadata while old records are being migrated', () => {
  assert.equal(
    validateLearningMaterialSubmit({
      mode: 'edit',
      title: '视频号课程',
      uploadsCount: 0,
      sourceType: 'video_channel',
      feedToken: 'export/UzFfAgtgekIEAQAAAAAA',
      miniProgramAppId: 'wx1234567890',
      miniProgramPath: 'pages/video-channel-embed/index?feedToken=export%2FUzFfAgtgekIEAQAAAAAA',
    }),
    ''
  );
});
