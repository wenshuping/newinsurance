import { getState } from '../common/state.mjs';
import { findOrderById, markOrderWrittenOff, markRedemptionWrittenOff } from './commerce.repository.mjs';

export const findRedemptionForUser = ({ redemptionId, userId }) => {
  const state = getState();
  const redemption = (state.redemptions || []).find(
    (item) => String(item.id) === String(redemptionId) && Number(item.userId) === Number(userId)
  );
  return { state, redemption };
};

export const findWrittenOffByToken = ({ token }) => {
  const state = getState();
  return (state.redemptions || []).find((item) => String(item.writeoffToken) === String(token) && item.status === 'written_off');
};

export const writeoffRedemptionAndOrder = ({ redemption }) => {
  const state = getState();
  markRedemptionWrittenOff(redemption);
  const order = (state.orders || []).find((item) => Number(item.id) === Number(redemption.orderId));
  if (order) markOrderWrittenOff(order);
  return { redemption, order };
};

export const findOrderForRedemption = ({ orderId }) => {
  const state = getState();
  return findOrderById(state, orderId);
};
