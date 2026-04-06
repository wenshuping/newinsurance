import { describe, expect, it } from 'vitest';
import * as bAdminShared from '../server/skeleton-c-v1/routes/b-admin.shared.mjs';
import {
  canAccessBusinessMallTemplate,
  getBusinessMallTemplateOriginSource,
  getBusinessMallTemplateOriginTag,
  getBusinessTemplateSource,
  getBusinessTemplateOriginSource,
  getBusinessTemplateOriginTag,
  getBusinessTemplateTag,
  toBusinessMallTemplateStatus,
  toBusinessTemplateStatus,
} from '../server/skeleton-c-v1/routes/b-admin.shared.mjs';

const baseState = {
  roles: [
    { id: 0, key: 'platform_admin' },
    { id: 1, key: 'company_admin' },
    { id: 2, key: 'team_lead' },
    { id: 3, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 1, userType: 'employee', userId: 9001, roleId: 0 },
    { tenantId: 2, userType: 'employee', userId: 101, roleId: 1 },
    { tenantId: 2, userType: 'employee', userId: 102, roleId: 2 },
    { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
  ],
};

describe('b admin template view', () => {
  it('shows company templates as inactive for agents and marks them as company templates', () => {
    const actor = { actorType: 'agent', actorId: 201, tenantId: 2 };
    const companyTemplate = {
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      status: 'published',
    };

    expect(getBusinessTemplateSource(baseState, companyTemplate)).toBe('company');
    expect(getBusinessTemplateTag(baseState, companyTemplate)).toBe('公司模板');
    expect(toBusinessTemplateStatus(baseState, actor, companyTemplate)).toBe('inactive');
  });

  it('keeps company template source rows active for company admins', () => {
    const actor = { actorType: 'employee', actorId: 101, tenantId: 2 };
    const companyTemplate = {
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      status: 'published',
    };

    expect(getBusinessTemplateSource(baseState, companyTemplate)).toBe('company');
    expect(toBusinessTemplateStatus(baseState, actor, companyTemplate)).toBe('published');
  });

  it('marks agent-created templates as personal templates and keeps their real status', () => {
    const actor = { actorType: 'agent', actorId: 201, tenantId: 2 };
    const personalTemplate = {
      tenantId: 2,
      createdBy: 201,
      creatorRole: 'agent',
      status: 'published',
    };

    expect(getBusinessTemplateSource(baseState, personalTemplate)).toBe('personal');
    expect(getBusinessTemplateTag(baseState, personalTemplate)).toBe('个人模板');
    expect(toBusinessTemplateStatus(baseState, actor, personalTemplate)).toBe('published');
  });

  it('keeps company origin tag for personal overrides derived from company templates', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const companyTemplate = {
      id: 301,
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      status: 'published',
    };
    const personalOverride = {
      id: 302,
      tenantId: 2,
      createdBy: 102,
      creatorRole: 'team_lead',
      sourceTemplateId: 301,
      status: 'published',
    };

    expect(getBusinessTemplateSource(baseState, personalOverride)).toBe('personal');
    expect(getBusinessTemplateOriginSource(baseState, personalOverride, [companyTemplate, personalOverride])).toBe('company');
    expect(getBusinessTemplateOriginTag(baseState, personalOverride, [companyTemplate, personalOverride])).toBe('公司模板');
    expect(toBusinessTemplateStatus(baseState, actor, personalOverride)).toBe('published');
  });

  it('sorts knowledge templates by effective time descending', () => {
    expect(typeof bAdminShared.sortBusinessRowsByEffectiveTimeDesc).toBe('function');

    const rows = [
      { id: 101, createdAt: '2026-03-18T08:00:00.000Z', updatedAt: '2026-03-18T08:00:00.000Z' },
      { id: 102, createdAt: '2026-03-18T08:00:00.000Z', updatedAt: '2026-03-20T08:00:00.000Z' },
      { id: 103, createdAt: '2026-03-18T08:00:00.000Z', effectiveAt: '2026-03-21T08:00:00.000Z' },
    ];

    const sorted = bAdminShared.sortBusinessRowsByEffectiveTimeDesc(rows);

    expect(sorted.map((row) => row.id)).toEqual([103, 102, 101]);
  });

  it('allows business mall view to inherit platform templates for team leads', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const platformTemplate = {
      id: 401,
      tenantId: 1,
      createdBy: 9001,
      creatorRole: 'platform_admin',
      status: 'published',
    };

    expect(canAccessBusinessMallTemplate(baseState, actor, platformTemplate)).toBe(true);
    expect(getBusinessMallTemplateOriginSource(baseState, platformTemplate, [platformTemplate])).toBe('platform');
    expect(getBusinessMallTemplateOriginTag(baseState, platformTemplate, [platformTemplate])).toBe('平台模板');
    expect(toBusinessMallTemplateStatus(baseState, actor, platformTemplate, [platformTemplate])).toBe('inactive');
  });

  it('keeps platform origin tags for mall rows derived from platform templates', () => {
    const actor = { actorType: 'employee', actorId: 101, tenantId: 2 };
    const platformTemplate = {
      id: 501,
      tenantId: 1,
      createdBy: 9001,
      creatorRole: 'platform_admin',
      status: 'published',
    };
    const tenantOverride = {
      id: 502,
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      sourceTemplateId: 501,
      status: 'published',
    };

    expect(getBusinessMallTemplateOriginSource(baseState, tenantOverride, [platformTemplate, tenantOverride])).toBe('platform');
    expect(getBusinessMallTemplateOriginTag(baseState, tenantOverride, [platformTemplate, tenantOverride])).toBe('平台模板');
    expect(toBusinessMallTemplateStatus(baseState, actor, tenantOverride, [platformTemplate, tenantOverride])).toBe('inactive');
  });

  it('keeps inactive company mall templates visible to team leads as read-only entries', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const companyTemplate = {
      id: 601,
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      status: 'inactive',
    };

    expect(canAccessBusinessMallTemplate(baseState, actor, companyTemplate)).toBe(true);
    expect(getBusinessMallTemplateOriginSource(baseState, companyTemplate, [companyTemplate])).toBe('company');
    expect(toBusinessMallTemplateStatus(baseState, actor, companyTemplate, [companyTemplate])).toBe('inactive');
  });

  it('keeps platform-derived company learning templates published for team leads', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const platformTemplate = {
      id: 701,
      tenantId: 1,
      createdBy: 9001,
      creatorRole: 'platform_admin',
      status: 'published',
      templateScope: 'platform',
    };
    const companyOverride = {
      id: 702,
      tenantId: 2,
      createdBy: 101,
      creatorRole: 'company_admin',
      status: 'published',
      sourceTemplateId: 701,
      platformTemplate: true,
    };

    expect(getBusinessMallTemplateOriginSource(baseState, companyOverride, [platformTemplate, companyOverride])).toBe('platform');
    expect(toBusinessTemplateStatus(baseState, actor, companyOverride, [platformTemplate, companyOverride])).toBe('published');
  });
});
