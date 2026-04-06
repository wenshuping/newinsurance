const LEARNING_TITLE_REQUIRED = '请输入资料标题';
const LEARNING_FILE_REQUIRED = '请至少上传一个文件';
const VIDEO_CHANNEL_JUMP_META_REQUIRED = '请填写视频号ID 和 feedId';
const VIDEO_CHANNEL_PROFILE_META_REQUIRED = '请填写视频号ID';
const VIDEO_CHANNEL_MINI_PROGRAM_APP_ID_REQUIRED = '请输入小程序AppID';
const VIDEO_CHANNEL_MINI_PROGRAM_PATH_REQUIRED = '请输入小程序路径';

export function validateLearningMaterialSubmit({
  mode,
  title,
  uploadsCount,
  sourceType = 'native',
  finderUserName = '',
  feedToken = '',
  feedId = '',
  nonceId = '',
  launchTarget = 'activity',
  miniProgramAppId = '',
  miniProgramPath = '',
}: {
  mode: 'create' | 'edit';
  title: string;
  uploadsCount: number;
  sourceType?: string;
  finderUserName?: string;
  feedToken?: string;
  feedId?: string;
  nonceId?: string;
  launchTarget?: 'activity' | 'profile';
  miniProgramAppId?: string;
  miniProgramPath?: string;
}): string {
  if (!String(title || '').trim()) return LEARNING_TITLE_REQUIRED;
  if (String(sourceType || '') === 'video_channel') {
    const hasFinderUserName = Boolean(String(finderUserName || '').trim());
    const hasJumpLaunchMeta =
      String(launchTarget || 'activity') === 'activity'
      && hasFinderUserName
      && Boolean(String(feedId || '').trim());
    const hasProfileLaunchMeta =
      String(launchTarget || 'activity') === 'profile'
      && hasFinderUserName;
    const hasEmbedCompatMeta = Boolean(String(feedToken || '').trim());
    if (!hasJumpLaunchMeta && !hasProfileLaunchMeta && !hasEmbedCompatMeta) {
      return String(launchTarget || 'activity') === 'profile'
        ? VIDEO_CHANNEL_PROFILE_META_REQUIRED
        : VIDEO_CHANNEL_JUMP_META_REQUIRED;
    }
    if (!String(miniProgramAppId || '').trim()) return VIDEO_CHANNEL_MINI_PROGRAM_APP_ID_REQUIRED;
    if (!String(miniProgramPath || '').trim()) return VIDEO_CHANNEL_MINI_PROGRAM_PATH_REQUIRED;
    return '';
  }
  if (mode === 'create' && Number(uploadsCount || 0) <= 0) return LEARNING_FILE_REQUIRED;
  return '';
}
