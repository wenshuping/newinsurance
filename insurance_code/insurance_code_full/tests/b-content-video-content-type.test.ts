import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
}));

import { executeCreateBContentItem, executeUpdateBContentItem } from '../server/skeleton-c-v1/usecases/b-content-write.usecase.mjs';

function createDeps(state: any) {
  return {
    getState: () => state,
    nextId: (list: Array<{ id?: number }>) =>
      list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1,
    persistState: vi.fn(),
    hasRole: vi.fn((_runtimeState, runtimeActor, roleKey) => roleKey === 'company_admin' && Number(runtimeActor?.userId || 0) === 8003),
    canAccessTemplate: vi.fn(() => true),
  };
}

describe('B content video inference', () => {
  it('stores uploaded video learning content as video when contentType is omitted', async () => {
    const state = {
      learningCourses: [],
      pLearningMaterials: [],
    };
    const deps = createDeps(state);

    const payload = await executeCreateBContentItem({
      title: '2024年人寿保险最新理赔指南',
      body: '课程正文',
      rewardPoints: 50,
      media: [
        {
          name: 'claim-guide.mp4',
          type: 'video/mp4',
          preview: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
          url: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
          path: '/uploads/tenant_2/claim-guide.mp4',
        },
      ],
      actor: { actorType: 'employee', actorId: 8003 },
      tenantContext: { tenantId: 2 },
      ...deps,
    } as any);

    expect(payload.item).toMatchObject({
      title: '2024年人寿保险最新理赔指南',
      contentType: 'video',
    });
    expect(state.learningCourses[0]).toMatchObject({
      title: '2024年人寿保险最新理赔指南',
      contentType: 'video',
    });
    expect(state.pLearningMaterials[0]).toMatchObject({
      title: '2024年人寿保险最新理赔指南',
    });
  });

  it('upgrades existing article content to video when video media is saved', async () => {
    const state = {
      learningCourses: [
        {
          id: 124,
          tenantId: 2,
          title: '2024年人寿保险最新理赔指南',
          contentType: 'article',
          status: 'published',
          content: '课程正文',
          media: [],
          createdBy: 8003,
          creatorRole: 'company_admin',
          templateScope: 'tenant',
          createdAt: '2026-03-30T12:52:35.339Z',
          updatedAt: '2026-03-30T12:52:35.339Z',
        },
      ],
      pLearningMaterials: [
        {
          id: 1,
          sourceCourseId: 124,
          tenantId: 2,
          title: '2024年人寿保险最新理赔指南',
          body: '课程正文',
          rewardPoints: 50,
          coverUrl: '',
          sortOrder: 1,
          media: [],
          createdBy: 8003,
          creatorRole: 'company_admin',
          templateScope: 'tenant',
          status: 'published',
          createdAt: '2026-03-30T12:52:35.339Z',
          updatedAt: '2026-03-30T12:52:35.339Z',
        },
      ],
    };
    const deps = createDeps(state);

    const payload = await executeUpdateBContentItem({
      id: 124,
      title: '2024年人寿保险最新理赔指南',
      media: [
        {
          name: 'claim-guide.mp4',
          type: 'video/mp4',
          preview: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
          url: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
          path: '/uploads/tenant_2/claim-guide.mp4',
        },
      ],
      actor: { actorType: 'employee', actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      ...deps,
    } as any);

    expect(payload.item).toMatchObject({
      id: 124,
      contentType: 'video',
    });
    expect(state.learningCourses[0]).toMatchObject({
      id: 124,
      contentType: 'video',
    });
  });
});
