const ensurePTagRuleJobs = (state) => {
  if (!Array.isArray(state.pTagRuleJobs)) state.pTagRuleJobs = [];
};

const ensurePTagRuleJobLogs = (state) => {
  if (!Array.isArray(state.pTagRuleJobLogs)) state.pTagRuleJobLogs = [];
};

export const insertPTagRuleJob = ({ state, row }) => {
  ensurePTagRuleJobs(state);
  state.pTagRuleJobs.push(row);
  return row;
};

export const appendPTagRuleJobLogs = ({ state, logs }) => {
  ensurePTagRuleJobLogs(state);
  state.pTagRuleJobLogs.push(...logs);
};
