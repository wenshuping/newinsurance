import { describe, expect, it } from 'vitest';

import {
  resolveCurrentBAdvisorProfile,
  resolveCustomerAdvisorProfile,
  updateCurrentAdvisorProfile,
} from '../server/skeleton-c-v1/routes/advisor.routes.mjs';

function createState() {
  return {
    agents: [
      {
        id: 8003,
        tenantId: 2,
        orgId: 2,
        teamId: 2,
        name: '方雨晴',
        mobile: '18616135589',
        title: '资深保险顾问',
        bio: '原始简介',
        avatarUrl: '/uploads/agents/fang.png',
      },
    ],
  };
}

describe('advisor routes helpers', () => {
  it('resolves the current customer advisor from ownerUserId', () => {
    const advisor = resolveCustomerAdvisorProfile({
      state: createState(),
      user: {
        id: 901,
        tenantId: 2,
        ownerUserId: 8003,
      },
    });

    expect(advisor).toMatchObject({
      id: 8003,
      name: '方雨晴',
      mobile: '18616135589',
      bio: '原始简介',
    });
  });

  it('returns null when the customer has no assigned advisor', () => {
    const advisor = resolveCustomerAdvisorProfile({
      state: createState(),
      user: {
        id: 901,
        tenantId: 2,
        ownerUserId: 0,
      },
    });

    expect(advisor).toBeNull();
  });

  it('allows the current b-end employee to read their own advisor profile', () => {
    const advisor = resolveCurrentBAdvisorProfile({
      state: createState(),
      actor: { actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      user: { id: 8003, tenantId: 2 },
    });

    expect(advisor).toMatchObject({
      id: 8003,
      title: '资深保险顾问',
    });
  });

  it('updates the current advisor bio in place', () => {
    const state = createState();

    const advisor = updateCurrentAdvisorProfile({
      state,
      actor: { actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      user: { id: 8003, tenantId: 2 },
      body: { bio: '3年保险从业经验，擅长健康险与家庭保单配置。' },
    });

    expect(advisor).toMatchObject({
      id: 8003,
      bio: '3年保险从业经验，擅长健康险与家庭保单配置。',
    });
    expect(state.agents[0]?.bio).toBe('3年保险从业经验，擅长健康险与家庭保单配置。');
  });

  it('rejects bios longer than 200 characters', () => {
    const state = createState();

    expect(() =>
      updateCurrentAdvisorProfile({
        state,
        actor: { actorId: 8003, tenantId: 2 },
        tenantContext: { tenantId: 2 },
        user: { id: 8003, tenantId: 2 },
        body: { bio: '超长'.repeat(120) },
      })
    ).toThrowError('ADVISOR_BIO_TOO_LONG');
  });
});
