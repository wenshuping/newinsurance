import { getState, nextId } from '../common/state.mjs';
import { buildActivityWriteoffToken } from '../common/activity-writeoff.mjs';

function isActivityDomain(activity = {}) {
  const domain = String(activity.sourceDomain || activity.source_domain || 'activity').trim().toLowerCase();
  return domain === 'activity' || domain === '';
}

export const findCompletableActivityById = ({ activityId }) => {
  const state = getState();
  const source = Array.isArray(state.activities) ? state.activities : [];
  const activity = source.find((row) => Number(row.id) === Number(activityId) && isActivityDomain(row));
  return { state, activity };
};

export const findTodayActivityCompletion = ({ userId, activityId, today }) => {
  const state = getState();
  return (state.activityCompletions || []).find(
    (row) => Number(row.userId) === Number(userId) && Number(row.activityId) === Number(activityId) && String(row.completedDate) === String(today)
  );
};

export const findAnyActivityCompletion = ({ userId, activityId }) => {
  const state = getState();
  return (state.activityCompletions || []).find(
    (row) => Number(row.userId) === Number(userId) && Number(row.activityId) === Number(activityId)
  );
};

export const createActivityCompletion = ({ tenantId, userId, activityId, today, pointsAwarded, completedAt }) => {
  const state = getState();
  if (!Array.isArray(state.activityCompletions)) state.activityCompletions = [];
  const completedAtValue = completedAt || new Date().toISOString();
  const completionId = nextId(state.activityCompletions);

  const row = {
    id: completionId,
    tenantId: Number(tenantId || 1),
    userId: Number(userId),
    activityId: Number(activityId),
    completedDate: String(today),
    pointsAwarded: Number(pointsAwarded || 0),
    completedAt: completedAtValue,
    createdAt: completedAtValue,
    writeoffToken: buildActivityWriteoffToken({
      id: completionId,
      tenantId: Number(tenantId || 1),
      userId: Number(userId),
      activityId: Number(activityId),
    }),
    writtenOffAt: null,
  };
  state.activityCompletions.push(row);
  return row;
};
