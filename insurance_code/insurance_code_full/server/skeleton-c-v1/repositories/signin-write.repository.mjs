import { dateOnly, getBalance, getState, nextId } from '../common/state.mjs';
import { recordPoints } from '../services/points.service.mjs';

export const getTodaySignIn = ({ userId }) => {
  const state = getState();
  const today = dateOnly(new Date());
  const signIn = (state.signIns || []).find((row) => Number(row.userId) === Number(userId) && String(row.signDate) === today);
  return { signIn, today };
};

export const createSignInWithReward = ({ tenantId = 1, userId, rewardPoints = 10 }) => {
  const state = getState();
  if (!Array.isArray(state.signIns)) state.signIns = [];

  const { signIn, today } = getTodaySignIn({ userId });
  if (signIn) return { duplicated: true, reward: Number(signIn.pointsAwarded || rewardPoints), today };

  state.signIns.push({
    id: nextId(state.signIns),
    tenantId: Number(tenantId || 1),
    userId: Number(userId),
    signDate: today,
    pointsAwarded: Number(rewardPoints),
    createdAt: new Date().toISOString(),
  });

  const normalizedRewardPoints = Number(rewardPoints || 0);
  const pointsResult =
    normalizedRewardPoints > 0
      ? recordPoints({
          tenantId: Number(tenantId || 1),
          userId: Number(userId),
          direction: 'in',
          amount: normalizedRewardPoints,
          sourceType: 'daily_sign_in',
          sourceId: today,
          idempotencyKey: `sign-in:${userId}:${today}`,
          description: '每日签到奖励',
        })
      : {
          duplicated: false,
          balance: Number(getBalance(userId)),
        };

  return {
    duplicated: false,
    reward: normalizedRewardPoints,
    today,
    balance: Number(pointsResult.balance || 0),
  };
};
