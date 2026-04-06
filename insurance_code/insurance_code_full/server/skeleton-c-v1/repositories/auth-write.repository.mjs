const ensureSmsCodes = (state) => {
  if (!Array.isArray(state.smsCodes)) state.smsCodes = [];
};

const ensureUsers = (state) => {
  if (!Array.isArray(state.users)) state.users = [];
};

const normalizeWechatIdentity = (value) => String(value || '').trim();
const normalizeWechatAppType = (value) => {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return text || '';
};

export const countSmsSentToday = ({ state, mobile, dateOnly }) => {
  ensureSmsCodes(state);
  const today = dateOnly(new Date());
  return state.smsCodes.filter((s) => s.mobile === mobile && String(s.createdAt || '').startsWith(today)).length;
};

export const insertSmsCode = ({ state, row }) => {
  ensureSmsCodes(state);
  state.smsCodes.push(row);
  return row;
};

export const findLatestUnusedSmsCode = ({ state, mobile, code }) => {
  ensureSmsCodes(state);
  return (
    [...state.smsCodes]
      .reverse()
      .find((s) => s.mobile === mobile && s.code === code && !s.used) || null
  );
};

export const findUserByMobile = ({ state, mobile, tenantId }) => {
  ensureUsers(state);
  const normalizedMobile = String(mobile || '').trim();
  const normalizedTenantId = Number(tenantId || 0);
  if (normalizedTenantId > 0) {
    return (
      state.users.find(
        (u) => String(u.mobile || '').trim() === normalizedMobile && Number(u.tenantId || 0) === normalizedTenantId
      ) ||
      state.users.find(
        (u) => String(u.mobile || '').trim() === normalizedMobile && !Number.isFinite(Number(u.tenantId || 0))
      ) ||
      null
    );
  }
  return state.users.find((u) => String(u.mobile || '').trim() === normalizedMobile) || null;
};

export const findUserById = ({ state, userId }) => {
  ensureUsers(state);
  return state.users.find((u) => Number(u.id || 0) === Number(userId || 0)) || null;
};

export const findUserByWechatUnionId = ({ state, unionId }) => {
  ensureUsers(state);
  const normalized = normalizeWechatIdentity(unionId);
  if (!normalized) return null;
  return state.users.find((u) => normalizeWechatIdentity(u.unionId) === normalized) || null;
};

export const findUserByWechatOpenId = ({ state, openId, appType }) => {
  ensureUsers(state);
  const normalizedOpenId = normalizeWechatIdentity(openId);
  const normalizedAppType = normalizeWechatAppType(appType);
  if (!normalizedOpenId || !normalizedAppType) return null;
  return (
    state.users.find(
      (u) =>
        normalizeWechatIdentity(u.openId) === normalizedOpenId &&
        normalizeWechatAppType(u.wechatAppType) === normalizedAppType
    ) || null
  );
};

export const insertUser = ({ state, row }) => {
  ensureUsers(state);
  state.users.push(row);
  return row;
};

export const bindUserWechatIdentity = ({ state, user, openId, unionId, appType, boundAt }) => {
  ensureUsers(state);
  if (!user) return null;
  const normalizedOpenId = normalizeWechatIdentity(openId);
  const normalizedUnionId = normalizeWechatIdentity(unionId);
  const normalizedAppType = normalizeWechatAppType(appType);
  if (normalizedOpenId) user.openId = normalizedOpenId;
  if (normalizedUnionId) user.unionId = normalizedUnionId;
  if (normalizedAppType) user.wechatAppType = normalizedAppType;
  if (!user.wechatBoundAt) user.wechatBoundAt = boundAt;
  return user;
};

export const resolveDefaultOrgAndTeam = ({ state, tenantId }) => {
  const tenantOrg = (state.orgUnits || [])
    .filter((x) => Number(x.tenantId) === Number(tenantId))
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
  const tenantTeam = (state.teams || [])
    .filter((x) => Number(x.tenantId) === Number(tenantId))
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
  return {
    orgId: tenantOrg ? Number(tenantOrg.id) : null,
    teamId: tenantTeam ? Number(tenantTeam.id) : null,
  };
};
