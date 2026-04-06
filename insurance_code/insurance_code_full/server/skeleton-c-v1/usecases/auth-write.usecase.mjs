import { resolveTenantPointsRuleConfig, runInStateTransaction } from '../common/state.mjs';
import { isPublicPoolTenant } from '../common/public-pool-tenant.mjs';
import {
  bindUserWechatIdentity,
  countSmsSentToday,
  findLatestUnusedSmsCode,
  findUserById,
  findUserByMobile,
  findUserByWechatOpenId,
  findUserByWechatUnionId,
  insertSmsCode,
  insertUser,
  resolveDefaultOrgAndTeam,
} from '../repositories/auth-write.repository.mjs';

function clampText(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeWechatIdentity(value) {
  return String(value || '').trim();
}

function normalizeWechatAppType(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return text || '';
}

function resolveWechatIdentityMatch({ state, unionId, openId, appType }) {
  const normalizedUnionId = normalizeWechatIdentity(unionId);
  if (normalizedUnionId) {
    const user = findUserByWechatUnionId({ state, unionId: normalizedUnionId });
    if (user) return { user, matchType: 'unionid' };
  }
  const normalizedOpenId = normalizeWechatIdentity(openId);
  const normalizedAppType = normalizeWechatAppType(appType);
  if (normalizedOpenId && normalizedAppType) {
    const user = findUserByWechatOpenId({ state, openId: normalizedOpenId, appType: normalizedAppType });
    if (user) return { user, matchType: 'openid' };
  }
  return { user: null, matchType: '' };
}

function assertWechatIdentityNotBoundToOthers({ state, customerId, unionId, openId, appType }) {
  const normalizedUnionId = normalizeWechatIdentity(unionId);
  if (normalizedUnionId) {
    const existing = findUserByWechatUnionId({ state, unionId: normalizedUnionId });
    if (existing && Number(existing.id) !== Number(customerId)) throw new Error('WECHAT_IDENTITY_CONFLICT');
  }
  const normalizedOpenId = normalizeWechatIdentity(openId);
  const normalizedAppType = normalizeWechatAppType(appType);
  if (normalizedOpenId) {
    if (!normalizedAppType) throw new Error('WECHAT_APP_TYPE_REQUIRED');
    const existing = findUserByWechatOpenId({ state, openId: normalizedOpenId, appType: normalizedAppType });
    if (existing && Number(existing.id) !== Number(customerId)) throw new Error('WECHAT_IDENTITY_CONFLICT');
  }
}

function scheduleAuthPersistence(task, label) {
  Promise.resolve()
    .then(task)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[auth] ${label} persist failed:`, err?.message || err);
    });
}

function findVerifiedUserByMobileAcrossTenants({ state, mobile }) {
  const normalizedMobile = String(mobile || '').trim();
  if (!normalizedMobile) return null;
  return (
    (state.users || []).find(
      (user) => String(user?.mobile || '').trim() === normalizedMobile && Boolean(user?.isVerifiedBasic)
    ) || null
  );
}

function resolveAuthUserByMobile({ state, mobile, tenant }) {
  const tenantScopedUser = findUserByMobile({ state, mobile, tenantId: tenant?.id });
  if (tenantScopedUser) return tenantScopedUser;
  if (!isPublicPoolTenant(tenant)) return null;
  return findVerifiedUserByMobileAcrossTenants({ state, mobile });
}

function awardNewCustomerVerifyPoints({ command, state, tenantId, userId, pointTransactionIds }) {
  if (typeof command.recordPoints !== 'function') return;
  const effectiveTenantId = Number(tenantId || 0);
  const effectiveUserId = Number(userId || 0);
  if (effectiveTenantId <= 0 || effectiveUserId <= 0) return;
  const rewardConfig = resolveTenantPointsRuleConfig(effectiveTenantId, state);
  const rewardPoints = Number(rewardConfig.newCustomerVerifyPoints || 0);
  if (rewardPoints <= 0) return;
  const pointsResult = command.recordPoints({
    tenantId: effectiveTenantId,
    userId: effectiveUserId,
    direction: 'in',
    amount: rewardPoints,
    sourceType: 'onboard',
    sourceId: String(effectiveUserId),
    idempotencyKey: `onboard:${effectiveUserId}`,
    description: '新用户基础积分',
  });
  if (!pointsResult?.duplicated && Number(pointsResult?.transaction?.id || 0) > 0) {
    pointTransactionIds.push(Number(pointsResult.transaction.id));
  }
  const nextBalance = Number(pointsResult?.balance);
  return Number.isFinite(nextBalance) ? nextBalance : undefined;
}

export const executeSendAuthCode = async (command) =>
  runInStateTransaction(
    async () => {
    const state = command.getState();
    const mobile = String(command.mobile || '').trim();
    const lookupOnly = Boolean(command.lookupOnly);
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !lookupOnly) {
      const sentToday = countSmsSentToday({ state, mobile, dateOnly: command.dateOnly });
      if (sentToday >= 5) throw new Error('SMS_LIMIT_REACHED');
    }
    const user = resolveAuthUserByMobile({ state, mobile, tenant: command.tenant });
    const isVerifiedBasic = Boolean(user?.isVerifiedBasic);
    const verifiedName = isVerifiedBasic ? String(user?.name || '').trim() : '';

    let code = '';
    if (!lookupOnly) {
      code = process.env.DEV_SMS_CODE || '123456';
      const smsRow = insertSmsCode({
        state,
        row: {
          id: command.nextId(state.smsCodes || []),
          mobile,
          code,
          tenantId: command.tenant?.id ? Number(command.tenant.id) : null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          used: false,
          createdAt: new Date().toISOString(),
        },
      });
      if (typeof command.persistSmsCodesByIds === 'function') {
        scheduleAuthPersistence(() => command.persistSmsCodesByIds([smsRow.id]), 'send-code');
      } else {
        scheduleAuthPersistence(() => command.persistState(), 'send-code');
      }
    }

    const body = { ok: true, message: lookupOnly ? '手机号实名识别完成' : '验证码已发送' };
    body.isVerifiedBasic = isVerifiedBasic;
    body.verifiedName = verifiedName;
    if (!lookupOnly && process.env.NODE_ENV !== 'production') body.dev_code = code;
    return body;
    },
    { persistMode: 'manual', reloadMode: 'none', snapshotMode: 'auth_write' }
  );

export const executeResolveWechatIdentity = async (command) => {
  const state = command.getState();
  const { user, matchType } = resolveWechatIdentityMatch({
    state,
    unionId: command.unionId,
    openId: command.openId,
    appType: command.appType,
  });
  if (!user) {
    return {
      matched: false,
      customerId: null,
      isVerifiedBasic: false,
      skipVerify: false,
      matchType: '',
    };
  }
  return {
    matched: true,
    customerId: Number(user.id),
    isVerifiedBasic: Boolean(user.isVerifiedBasic),
    skipVerify: Boolean(user.isVerifiedBasic),
    matchType,
  };
};

export const executeResolveWechatH5Session = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const identity = command.code
      ? await command.resolveWechatH5IdentityByCode({ code: command.code })
      : {
          openId: normalizeWechatIdentity(command.openId),
          unionId: normalizeWechatIdentity(command.unionId),
          appType: normalizeWechatAppType(command.appType) || 'h5',
        };
    const { user, matchType } = resolveWechatIdentityMatch({
      state,
      unionId: identity.unionId,
      openId: identity.openId,
      appType: identity.appType,
    });

    if (!user) {
      return {
        ok: true,
        matched: false,
        customerId: null,
        isVerifiedBasic: false,
        skipVerify: false,
        matchType: '',
        identity,
      };
    }

    if (!user.isVerifiedBasic) {
      return {
        ok: true,
        matched: true,
        customerId: Number(user.id),
        isVerifiedBasic: false,
        skipVerify: false,
        matchType,
        identity,
      };
    }

    const token = command.createSession(user.id);
    command.persistState();
    const session = (state.sessions || []).find((s) => String(s.token) === String(token));

    return {
      ok: true,
      matched: true,
      customerId: Number(user.id),
      isVerifiedBasic: true,
      skipVerify: true,
      matchType,
      token,
      csrfToken: session?.csrfToken || '',
      user: command.formatUser(user),
      identity,
    };
  });

export const executeBindWechatIdentity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const customerId = Number(command.customerId || 0);
    const actorCustomerId = Number(command.actorCustomerId || 0);
    if (!customerId) throw new Error('CUSTOMER_ID_REQUIRED');
    if (actorCustomerId && actorCustomerId !== customerId) throw new Error('WECHAT_BIND_FORBIDDEN');
    const user = findUserById({ state, userId: customerId });
    if (!user) throw new Error('CUSTOMER_NOT_FOUND');
    assertWechatIdentityNotBoundToOthers({
      state,
      customerId,
      unionId: command.unionId,
      openId: command.openId,
      appType: command.appType,
    });
    const boundAt = user.wechatBoundAt || new Date().toISOString();
    bindUserWechatIdentity({
      state,
      user,
      unionId: command.unionId,
      openId: command.openId,
      appType: command.appType,
      boundAt,
    });
    command.persistState();
    return {
      ok: true,
      customerId: Number(user.id),
      binding: {
        openId: user.openId || '',
        unionId: user.unionId || '',
        appType: user.wechatAppType || '',
        boundAt: user.wechatBoundAt || boundAt,
      },
    };
  });

export const executeVerifyBasic = async (command) =>
  runInStateTransaction(
    async () => {
    const state = command.getState();
    const inputName = String(command.name || '').trim();
    const mobile = String(command.mobile || '').trim();
    const code = String(command.code || '').trim();
    const isProd = process.env.NODE_ENV === 'production';
    const devBypassCode = process.env.DEV_SMS_CODE || '123456';
    const isDevBypass = !isProd && code === devBypassCode;
    const sms = findLatestUnusedSmsCode({ state, mobile, code });
    const tenant =
      command.tenant ||
      ((sms?.tenantId ? (state.tenants || []).find((t) => Number(t.id) === Number(sms.tenantId)) : null) || null);
    if (!sms && !isDevBypass) throw new Error('CODE_NOT_FOUND');
    if (sms && isProd && new Date(sms.expiresAt).getTime() < Date.now()) throw new Error('CODE_EXPIRED');
    if (sms) sms.used = true;

    let user = resolveAuthUserByMobile({ state, mobile, tenant });
    let isNewlyVerified = false;
    const pointTransactionIds = [];
    let verifiedBalance;
    if (!user) {
      const name = inputName;
      if (!name) throw new Error('NAME_REQUIRED');
      if (!tenant) throw new Error('TENANT_REQUIRED');
      const userId = command.nextId(state.users || []);
      const { orgId, teamId } = resolveDefaultOrgAndTeam({ state, tenantId: Number(tenant.id) });
      user = insertUser({
        state,
        row: {
          id: userId,
          tenantId: Number(tenant.id),
          orgId,
          teamId,
          ownerUserId: 0,
          referrerCustomerId: null,
          referrerShareCode: null,
          referredAt: null,
          name,
          mobile,
          openId: '',
          unionId: '',
          wechatAppType: '',
          wechatBoundAt: null,
          nickName: name,
          avatarUrl: '',
          memberLevel: 1,
          growthValue: 0,
          lastActiveAt: new Date().toISOString(),
          deviceInfo: clampText(command.userAgent, 255),
          isVerifiedBasic: true,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      });
      isNewlyVerified = true;
    } else {
      const wasVerifiedBasic = Boolean(user.isVerifiedBasic);
      const existingName = String(user.name || '').trim();
      const name = inputName || existingName;
      if (!name) throw new Error('NAME_REQUIRED');
      if (user.isVerifiedBasic && existingName && inputName && existingName !== inputName) {
        throw new Error('CUSTOMER_REALNAME_MISMATCH');
      }
      user.name = name;
      user.nickName = user.nickName || name;
      user.isVerifiedBasic = true;
      user.verifiedAt = new Date().toISOString();
      user.lastActiveAt = new Date().toISOString();
      user.deviceInfo = user.deviceInfo || clampText(command.userAgent, 255);
      if (!Number.isFinite(Number(user.tenantId)) && tenant) {
        const { orgId, teamId } = resolveDefaultOrgAndTeam({ state, tenantId: Number(tenant.id) });
        user.tenantId = Number(tenant.id);
        user.orgId = orgId;
        user.teamId = teamId;
      } else {
        user.tenantId = Number.isFinite(Number(user.tenantId)) ? Number(user.tenantId) : null;
        user.orgId = Number.isFinite(Number(user.orgId)) ? Number(user.orgId) : null;
        user.teamId = Number.isFinite(Number(user.teamId)) ? Number(user.teamId) : null;
      }
      user.ownerUserId = Number(user.ownerUserId ?? 0);
      isNewlyVerified = !wasVerifiedBasic;
    }

    if (isNewlyVerified) {
      const rewardTenantId = Number(user?.tenantId || tenant?.id || 0);
      verifiedBalance = awardNewCustomerVerifyPoints({
        command,
        state,
        tenantId: rewardTenantId,
        userId: Number(user?.id || 0),
        pointTransactionIds,
      });
    }

    if (normalizeWechatIdentity(command.unionId) || normalizeWechatIdentity(command.openId)) {
      assertWechatIdentityNotBoundToOthers({
        state,
        customerId: Number(user.id),
        unionId: command.unionId,
        openId: command.openId,
        appType: command.appType,
      });
      bindUserWechatIdentity({
        state,
        user,
        unionId: command.unionId,
        openId: command.openId,
        appType: command.appType,
        boundAt: user.wechatBoundAt || new Date().toISOString(),
      });
    }

    const token = command.createSession(user.id);
    const canPersistCustomerIncrementally = typeof command.persistCustomersByIds === 'function';

    if (canPersistCustomerIncrementally) {
      await command.persistCustomersByIds([user.id]);
      const criticalTasks = [];
      if (token && typeof command.persistSessionsByTokens === 'function') {
        criticalTasks.push(command.persistSessionsByTokens([token]));
      }
      if (pointTransactionIds.length && typeof command.persistPointTransactionsByIds === 'function') {
        criticalTasks.push(command.persistPointTransactionsByIds(pointTransactionIds));
      }
      if (criticalTasks.length) {
        await Promise.all(criticalTasks);
      }
      scheduleAuthPersistence(async () => {
        if (sms?.id && typeof command.persistSmsCodesByIds === 'function') {
          await command.persistSmsCodesByIds([sms.id]);
          return;
        }
        if (typeof command.persistState === 'function') {
          await command.persistState();
        }
      }, 'verify-basic');
    } else {
      scheduleAuthPersistence(() => command.persistState(), 'verify-basic');
    }
    const session = (state.sessions || []).find((s) => String(s.token) === String(token));
    return {
      token,
      csrfToken: session?.csrfToken || '',
      user: command.formatUser(user),
      isNewlyVerified,
      balance: verifiedBalance,
    };
    },
    { persistMode: 'manual', reloadMode: 'none', snapshotMode: 'auth_write' }
  );
