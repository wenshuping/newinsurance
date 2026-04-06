export const findAgentByAccount = ({ state, accountLower, accountRaw }) =>
  (state.agents || []).find((x) => {
    const email = String(x.email || '').toLowerCase();
    const accountField = String(x.account || '').toLowerCase();
    const mobile = String(x.mobile || '').trim();
    const name = String(x.name || '').trim();
    return (
      email === accountLower ||
      accountField === accountLower ||
      (mobile && mobile === accountRaw) ||
      (name && name === accountRaw)
    );
  }) || null;
