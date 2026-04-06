import { describe, expect, it, vi } from 'vitest';
import { canAccessTemplate, canDeliverTemplateToActor, hasRole } from '../server/skeleton-c-v1/common/template-visibility.mjs';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(async ({ execute }) => ({ hit: false, value: await execute() })),
}));

import { toUpdatePActivityCommand } from '../server/skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeUpdatePActivity } from '../server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs';

describe('executeUpdatePActivity platform override', () => {
  it('creates a tenant override for company admin even when persisted creatorRole is missing', async () => {
    const source = {
      id: 51,
      tenantId: 1,
      title: '平台活动',
      category: 'task',
      rewardPoints: 20,
      sortOrder: 1,
      status: 'published',
      content: '原始活动',
      media: [],
      createdBy: 9001,
      creatorRole: '',
      templateScope: 'tenant',
    };
    const state = {
      activities: [source],
      pActivities: [source],
      roles: [
        { id: 1, key: 'platform_admin' },
        { id: 2, key: 'company_admin' },
        { id: 3, key: 'agent' },
      ],
      userRoles: [
        { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
        { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
      ],
    };
    let persistCount = 0;
    const actor = { actorType: 'employee', actorId: 8002, tenantId: 2 };
    const deps = {
      getState: () => state,
      nextId: (list: Array<{ id?: number }>) =>
        list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1,
      persistState: () => {
        persistCount += 1;
      },
      canAccessTemplate: (runtimeState, runtimeActor, item) => canAccessTemplate(runtimeState, runtimeActor, item),
      hasRole: (runtimeState, runtimeActor, roleKey) =>
        hasRole(
          runtimeState,
          {
            tenantId: runtimeActor.tenantId,
            userType: runtimeActor.actorType,
            userId: runtimeActor.actorId,
          },
          roleKey
        ),
    };
    const command = toUpdatePActivityCommand({
      params: { id: 51 },
      body: {
        title: '平台活动',
        status: 'online',
        content: '租户活动内容',
      },
      actor,
      tenantContext: { tenantId: 2 },
      deps,
    });

    const payload = await executeUpdatePActivity(command);
    const agentActor = { actorType: 'agent', actorId: 201, tenantId: 2 };
    const override = state.activities.find((item) => Number(item.id) !== 51);

    expect(payload).toMatchObject({
      ok: true,
      activity: {
        id: 52,
        tenantId: 2,
        sourceTemplateId: 51,
        creatorRole: 'company_admin',
        templateScope: 'tenant',
        platformTemplate: true,
        status: 'online',
        createdBy: 8002,
      },
    });
    expect(state.activities).toHaveLength(2);
    expect(state.pActivities).toHaveLength(2);
    expect(state.activities[0]).toMatchObject({
      id: 51,
      tenantId: 1,
      status: 'published',
      content: '原始活动',
      creatorRole: '',
    });
    expect(override).toBeTruthy();
    expect(canDeliverTemplateToActor(state, agentActor, override)).toBe(true);
    expect(persistCount).toBe(1);
  });
});
