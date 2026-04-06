import type { AdvisorProfile } from './api';
import { resolveRuntimeAssetUrl } from './runtime-asset-url';

export const DEFAULT_ADVISOR_AVATAR = '/advisor-fangyuqing.jpeg';

export function resolveAdvisorAvatarUrl(profile?: Pick<AdvisorProfile, 'avatarUrl'> | null) {
  const runtimeAvatar = resolveRuntimeAssetUrl(String(profile?.avatarUrl || '').trim());
  return runtimeAvatar || DEFAULT_ADVISOR_AVATAR;
}
