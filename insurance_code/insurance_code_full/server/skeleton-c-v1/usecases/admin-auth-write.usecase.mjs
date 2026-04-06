import { findAgentByAccount } from '../repositories/admin-auth-write.repository.mjs';

const toRoleAndActorType = (userRoleRaw) => {
  const userRole = String(userRoleRaw || '').toLowerCase();
  const isManager = userRole === 'manager';
  const isTeamLead = userRole === 'support' || userRole === 'team_lead';
  return {
    role: isManager ? 'company_admin' : isTeamLead ? 'team_lead' : 'agent',
    actorType: isManager || isTeamLead ? 'employee' : 'agent',
  };
};

const buildSession = ({ token, csrfToken, sessionRow, session }) => ({
  ...session,
  token,
  csrfToken: sessionRow?.csrfToken || csrfToken,
});

export const executeBAdminLogin = async (command) =>
  (async () => {
    const state = command.getState();
    const accountRaw = String(command.account || '').trim();
    const account = accountRaw.toLowerCase();
    const password = String(command.password || '').trim();
    if (!account || !password) throw new Error('LOGIN_PARAMS_REQUIRED');

    const demoAccounts = [];
    const demoSession = demoAccounts.find(
      (x) => (x.account === account || x.mobile === accountRaw) && x.password === password
    );
    if (demoSession) {
      const token = command.createActorSession({
        actorType: String(demoSession.actorType || 'employee'),
        actorId: Number(demoSession.actorId || 0),
        tenantId: Number(demoSession.tenantId || 0),
        orgId: Number(demoSession.orgId || 0),
        teamId: Number(demoSession.teamId || 0),
      });
      const sessionRow = command.resolveSessionFromBearer(`Bearer ${token}`);
      const csrfToken = command.upsertActorCsrfToken({
        tenantId: Number(demoSession.tenantId || 1),
        actorType: String(demoSession.actorType || 'employee'),
        actorId: Number(demoSession.actorId || 0),
      });
      await (command.persistSessionsByTokens ? command.persistSessionsByTokens([token]) : command.persistState());
      return {
        ok: true,
        session: buildSession({
          token,
          sessionRow,
          csrfToken,
          session: {
            account: demoSession.account,
            name: demoSession.name,
            role: demoSession.role,
            actorType: demoSession.actorType,
            actorId: demoSession.actorId,
            tenantId: demoSession.tenantId,
            orgId: demoSession.orgId,
            teamId: demoSession.teamId,
          },
        }),
      };
    }

    const user = findAgentByAccount({ state, accountLower: account, accountRaw });
    if (!user || String(user.password || user.initialPassword || '') !== password) {
      throw new Error('LOGIN_FAILED');
    }
    const { role, actorType } = toRoleAndActorType(user.role);
    const token = command.createActorSession({
      actorType,
      actorId: Number(user.id),
      tenantId: Number(user.tenantId || 0),
      orgId: Number(user.orgId || 0),
      teamId: Number(user.teamId || 0),
    });
    const sessionRow = command.resolveSessionFromBearer(`Bearer ${token}`);
    const csrfToken = command.upsertActorCsrfToken({
      tenantId: Number(user.tenantId || 1),
      actorType,
      actorId: Number(user.id),
    });
    await (command.persistSessionsByTokens ? command.persistSessionsByTokens([token]) : command.persistState());
    return {
      ok: true,
      session: buildSession({
        token,
        sessionRow,
        csrfToken,
        session: {
          account: String(user.email || user.account || ''),
          name: String(user.name || '员工'),
          mobile: String(user.mobile || ''),
          role,
          actorType,
          actorId: Number(user.id),
          tenantId: Number(user.tenantId || 1),
          orgId: Number(user.orgId || 1),
          teamId: Number(user.teamId || 1),
        },
      }),
    };
  })();

export const executePAdminLogin = async (command) =>
  (async () => {
    const state = command.getState();
    const account = String(command.account || '').trim();
    const accountLower = account.toLowerCase();
    const password = String(command.password || '').trim();
    if (!account || !password) throw new Error('LOGIN_PARAMS_REQUIRED');

    const demoAccounts = [
      {
        account: 'platform001',
        password: '123456',
        name: '平台管理员',
        role: 'platform_admin',
        actorType: 'employee',
        actorId: 9001,
        tenantId: 1,
        orgId: 1,
        teamId: 1,
      },
    ];

    let safeSession = null;
    const demo = demoAccounts.find((x) => x.account === account && x.password === password);
    if (demo) {
      safeSession = {
        account: demo.account,
        name: demo.name,
        role: demo.role,
        actorType: demo.actorType,
        actorId: demo.actorId,
        tenantId: demo.tenantId,
        orgId: demo.orgId,
        teamId: demo.teamId,
      };
    } else {
      const user = findAgentByAccount({ state, accountLower, accountRaw: account });
      if (!user || String(user.password || user.initialPassword || '') !== password) {
        throw new Error('LOGIN_FAILED');
      }
      const { role, actorType } = toRoleAndActorType(user.role);
      safeSession = {
        account: String(user.email || user.mobile || user.account || account),
        name: String(user.name || '员工'),
        mobile: String(user.mobile || ''),
        role,
        actorType,
        actorId: Number(user.id),
        tenantId: Number(user.tenantId || 1),
        orgId: Number(user.orgId || 1),
        teamId: Number(user.teamId || 1),
      };
    }

    const token = command.createActorSession({
      actorType: String(safeSession.actorType || 'employee'),
      actorId: Number(safeSession.actorId || 0),
      tenantId: Number(safeSession.tenantId || 0),
      orgId: Number(safeSession.orgId || 0),
      teamId: Number(safeSession.teamId || 0),
    });
    const sessionRow = command.resolveSessionFromBearer(`Bearer ${token}`);
    const csrfToken = command.upsertActorCsrfToken({
      tenantId: Number(safeSession.tenantId || 1),
      actorType: String(safeSession.actorType || 'employee'),
      actorId: Number(safeSession.actorId || 0),
    });
    await (command.persistSessionsByTokens ? command.persistSessionsByTokens([token]) : command.persistState());
    return { ok: true, session: buildSession({ token, sessionRow, csrfToken, session: safeSession }) };
  })();
