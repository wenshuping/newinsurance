import { describe, expect, it, vi } from 'vitest';
import { canAccessTemplate, canDeliverTemplateToActor, hasRole } from '../server/skeleton-c-v1/common/template-visibility.mjs';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(async ({ execute }) => ({ hit: false, value: await execute() })),
}));

import { toUpdatePLearningCourseCommand } from '../server/skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeUpdatePLearningCourse } from '../server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';

describe('executeUpdatePLearningCourse platform override', () => {
  it('creates a tenant override for company admin even when persisted creatorRole is missing', async () => {
    const source = {
      id: 115,
      tenantId: 1,
      title: '视频测试',
      category: '通用培训',
      points: 50,
      rewardPoints: 50,
      contentType: 'video',
      status: 'published',
      level: '中级',
      content: '原始内容',
      media: [],
      createdBy: 9001,
      creatorRole: '',
      templateScope: 'tenant',
    };
    const state = {
      learningCourses: [source],
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
    const command = toUpdatePLearningCourseCommand({
      params: { id: 115 },
      body: {
        title: '视频测试',
        status: 'published',
        content: '租户发布内容',
      },
      actor,
      tenantContext: { tenantId: 2 },
      deps,
    });

    const payload = await executeUpdatePLearningCourse(command);
    const agentActor = { actorType: 'agent', actorId: 201, tenantId: 2 };
    const override = state.learningCourses.find((item) => Number(item.id) !== 115);

    expect(payload).toMatchObject({
      ok: true,
      course: {
        id: 116,
        tenantId: 2,
        sourceTemplateId: 115,
        creatorRole: 'company_admin',
        templateScope: 'tenant',
        platformTemplate: true,
        status: 'published',
        createdBy: 8002,
      },
    });
    expect(state.learningCourses).toHaveLength(2);
    expect(state.learningCourses[0]).toMatchObject({
      id: 115,
      tenantId: 1,
      status: 'published',
      content: '原始内容',
      creatorRole: '',
    });
    expect(override).toBeTruthy();
    expect(canDeliverTemplateToActor(state, agentActor, override)).toBe(true);
    expect(persistCount).toBe(1);
  });
});
