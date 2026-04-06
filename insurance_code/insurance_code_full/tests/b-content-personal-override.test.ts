import { describe, expect, it, vi } from 'vitest';
import { canAccessTemplate, hasRole } from '../server/skeleton-c-v1/common/template-visibility.mjs';
import { preferBusinessActorTemplateRows } from '../server/skeleton-c-v1/routes/b-admin.shared.mjs';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
}));

import { toUpdateBContentItemCommand } from '../server/skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeUpdateBContentItem } from '../server/skeleton-c-v1/usecases/b-content-write.usecase.mjs';

describe('executeUpdateBContentItem personal override', () => {
  it('creates a personal override when team lead edits a company template', async () => {
    const source = {
      id: 116,
      tenantId: 2,
      title: '视频测试',
      category: '通用培训',
      points: 50,
      rewardPoints: 50,
      contentType: 'video',
      status: 'published',
      level: '中级',
      content: '公司模板内容',
      media: [],
      createdBy: 8002,
      creatorRole: 'company_admin',
      templateScope: 'tenant',
      sourceTemplateId: 115,
      platformTemplate: true,
      createdAt: '2026-03-20T09:24:20.144Z',
      updatedAt: '2026-03-20T09:24:20.144Z',
    };
    const state = {
      learningCourses: [source],
      pLearningMaterials: [
        {
          id: 900,
          sourceCourseId: 116,
          tenantId: 2,
          title: '视频测试',
          body: '公司模板内容',
          rewardPoints: 50,
          coverUrl: '',
          sortOrder: 1,
          media: [],
          createdBy: 8002,
          creatorRole: 'company_admin',
          templateScope: 'tenant',
          status: 'published',
          createdAt: '2026-03-20T09:24:20.144Z',
          updatedAt: '2026-03-20T09:24:20.144Z',
        },
      ],
      roles: [
        { id: 1, key: 'company_admin' },
        { id: 2, key: 'team_lead' },
        { id: 3, key: 'agent' },
      ],
      userRoles: [
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8003, roleId: 2 },
        { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
      ],
    };
    let persistCount = 0;
    const actor = { actorType: 'employee', actorId: 8003, tenantId: 2 };
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
            userType: runtimeActor.userType || runtimeActor.actorType,
            userId: runtimeActor.userId || runtimeActor.actorId,
          },
          roleKey
        ),
    };
    const command = toUpdateBContentItemCommand({
      params: { id: 116 },
      body: {
        title: '视频测试',
        status: 'published',
        body: '主管个人版本',
        rewardPoints: 60,
      },
      actor,
      tenantContext: { tenantId: 2 },
      deps,
    });

    const payload = await executeUpdateBContentItem(command);
    const override = state.learningCourses.find((item) => Number(item.id) !== 116);
    const shadow = state.pLearningMaterials.find((item) => Number(item.sourceCourseId || 0) === Number(payload.item?.id || 0));

    expect(payload).toMatchObject({
      ok: true,
      item: {
        id: 117,
        tenantId: 2,
        title: '视频测试',
        status: 'published',
        rewardPoints: 60,
        sourceTemplateId: 116,
        createdBy: 8003,
        creatorRole: 'team_lead',
        templateScope: 'tenant',
      },
    });
    expect(state.learningCourses[0]).toMatchObject({
      id: 116,
      status: 'published',
      rewardPoints: 50,
      content: '公司模板内容',
      createdBy: 8002,
      creatorRole: 'company_admin',
    });
    expect(override).toBeTruthy();
    expect(shadow).toMatchObject({
      tenantId: 2,
      sourceCourseId: 117,
      title: '视频测试',
      body: '主管个人版本',
      rewardPoints: 60,
      createdBy: 8003,
      creatorRole: 'team_lead',
      templateScope: 'tenant',
      status: 'published',
    });
    expect(persistCount).toBe(1);
  });

  it('prefers the actor personal override over the company template source row', () => {
    const state = {
      roles: [
        { id: 1, key: 'company_admin' },
        { id: 2, key: 'team_lead' },
      ],
      userRoles: [
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8003, roleId: 2 },
      ],
    };
    const actor = { actorType: 'employee', actorId: 8003, tenantId: 2 };
    const rows = [
      { id: 116, tenantId: 2, title: '视频测试', createdBy: 8002, creatorRole: 'company_admin', status: 'published' },
      { id: 117, tenantId: 2, title: '视频测试', createdBy: 8003, creatorRole: 'team_lead', sourceTemplateId: 116, status: 'published' },
    ];

    const list = preferBusinessActorTemplateRows(state, actor, rows);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 117,
      createdBy: 8003,
      sourceTemplateId: 116,
      creatorRole: 'team_lead',
      status: 'published',
    });
  });

  it('keeps platform-derived company rows visible even when the actor has a personal override', () => {
    const state = {
      roles: [
        { id: 1, key: 'platform_admin' },
        { id: 2, key: 'company_admin' },
        { id: 3, key: 'team_lead' },
      ],
      userRoles: [
        { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
        { tenantId: 2, userType: 'employee', userId: 8003, roleId: 3 },
      ],
    };
    const actor = { actorType: 'employee', actorId: 8003, tenantId: 2 };
    const rows = [
      {
        id: 116,
        tenantId: 2,
        title: '视频测试',
        createdBy: 8002,
        creatorRole: 'company_admin',
        sourceTemplateId: 115,
        platformTemplate: true,
        status: 'published',
      },
      {
        id: 121,
        tenantId: 2,
        title: '视频测试',
        createdBy: 8003,
        creatorRole: 'team_lead',
        sourceTemplateId: 116,
        platformTemplate: true,
        status: 'published',
      },
    ];
    const sourceRows = [
      {
        id: 115,
        tenantId: 1,
        title: '视频测试',
        createdBy: 9001,
        creatorRole: 'platform_admin',
        templateScope: 'platform',
        status: 'published',
      },
      ...rows,
    ];

    const list = preferBusinessActorTemplateRows(state, actor, rows, undefined, sourceRows);

    expect(list.map((item) => item.id)).toEqual([116, 121]);
  });
});
