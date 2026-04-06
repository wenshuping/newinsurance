import { getBalance, resolveTenantPointsRuleConfig, runInStateTransaction } from '../common/state.mjs';
import { createSignInWithReward, getTodaySignIn } from '../repositories/signin-write.repository.mjs';
import { appendPointsAuditLog, appendPointsDomainEvent, setPointsRequestContext } from '../../microservices/points-service/observability.mjs';

export const executeSignIn = async (command) => {
  setPointsRequestContext({
    user_id: Number(command?.userId || 0),
  });
  if (!command?.isVerifiedBasic) throw new Error('NEED_BASIC_VERIFY');
  if (!Number.isFinite(Number(command?.userId)) || Number(command.userId) <= 0) throw new Error('UNAUTHORIZED');

  return runInStateTransaction(async () => {
    const { signIn } = getTodaySignIn({ userId: command.userId });
    if (signIn) throw new Error('ALREADY_SIGNED');

    const tenantId = Number(command?.tenantId || command?.actor?.tenantId || 1);
    const ruleConfig = resolveTenantPointsRuleConfig(tenantId);
    const result = createSignInWithReward({
      tenantId,
      userId: command.userId,
      rewardPoints: Number(ruleConfig.signInPoints),
    });
    appendPointsDomainEvent(
      'sign_in.completed',
      {
        userId: Number(command.userId),
        rewardPoints: Number(result.reward || 0),
      },
      { tenantId }
    );
    appendPointsAuditLog({
      tenantId,
      actorType: command?.actor?.actorType || 'customer',
      actorId: Number(command?.actor?.actorId || command.userId),
      action: 'sign_in.complete',
      resourceType: 'sign_in',
      resourceId: String(result.today || ''),
      result: 'success',
      userId: Number(command.userId),
    });
    return {
      ok: true,
      reward: Number(result.reward || 0),
      balance: Number(result.balance ?? getBalance(command.userId)),
    };
  });
};
