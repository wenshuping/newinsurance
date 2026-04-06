const ensureApprovals = (state) => {
  if (!Array.isArray(state.approvals)) state.approvals = [];
};

export const insertApproval = ({ state, approval }) => {
  ensureApprovals(state);
  state.approvals.push(approval);
  return approval;
};

export const findApprovalById = ({ state, id }) => {
  ensureApprovals(state);
  return state.approvals.find((row) => Number(row.id) === Number(id)) || null;
};
