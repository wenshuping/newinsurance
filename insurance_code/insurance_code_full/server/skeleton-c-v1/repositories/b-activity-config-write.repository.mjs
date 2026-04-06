const ensureArrays = (state) => {
  if (!Array.isArray(state.activities)) state.activities = [];
  if (!Array.isArray(state.pActivities)) state.pActivities = [];
};

export const findActivityConfigById = ({ state, id }) => {
  ensureArrays(state);
  return state.activities.find((row) => Number(row.id) === Number(id)) || null;
};

export const insertActivityConfig = ({ state, row }) => {
  ensureArrays(state);
  state.activities.push(row);
  if (state.pActivities !== state.activities) {
    state.pActivities.push({ ...row });
  }
  return row;
};

export const updateActivityConfigAndShadow = ({ state, id, patch }) => {
  ensureArrays(state);
  const target = state.activities.find((row) => Number(row.id) === Number(id));
  if (!target) return null;
  Object.assign(target, patch);

  if (state.pActivities === state.activities) return target;

  for (const activity of state.pActivities) {
    if (Number(activity.id || 0) !== Number(id)) continue;
    Object.assign(activity, patch);
  }
  return target;
};
