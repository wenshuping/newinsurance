import { describe, expect, it } from 'vitest';
import {
  canAccessTemplate,
  canDeliverTemplateToActor,
  effectiveTemplateStatusForActor,
} from '../server/skeleton-c-v1/common/template-visibility.mjs';

const baseState = {
  roles: [
    { id: 1, key: 'company_admin' },
    { id: 2, key: 'team_lead' },
    { id: 3, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 2, userType: 'employee', userId: 101, roleId: 1 },
    { tenantId: 2, userType: 'employee', userId: 102, roleId: 2 },
    { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
    { tenantId: 2, userType: 'agent', userId: 202, roleId: 3 },
  ],
  agents: [
    { id: 201, tenantId: 2, role: 'salesperson' },
    { id: 202, tenantId: 2, role: 'salesperson' },
  ],
  users: [{ id: 501, ownerUserId: 201, tenantId: 2 }],
};

describe('template visibility', () => {
  it('customer only sees owner agent templates', () => {
    const actor = { actorType: 'customer', actorId: 501, tenantId: 2 };
    const ownedItem = { tenantId: 2, createdBy: 201, creatorRole: 'agent' };
    const otherItem = { tenantId: 2, createdBy: 999, creatorRole: 'agent' };

    expect(canAccessTemplate(baseState, actor, ownedItem)).toBe(true);
    expect(canAccessTemplate(baseState, actor, otherItem)).toBe(false);
  });

  it('agent only sees inherited templates and self-created agent templates', () => {
    const actor = { actorType: 'agent', actorId: 201, tenantId: 2 };
    const ownItem = { tenantId: 2, createdBy: 201, creatorRole: 'agent' };
    const otherAgentItem = { tenantId: 2, createdBy: 202, creatorRole: 'agent' };
    const teamLeadItem = { tenantId: 2, createdBy: 102, creatorRole: 'team_lead', status: 'online' };
    const companyItem = { tenantId: 2, createdBy: 101, creatorRole: 'company_admin', status: 'published' };

    expect(canAccessTemplate(baseState, actor, ownItem)).toBe(true);
    expect(canAccessTemplate(baseState, actor, otherAgentItem)).toBe(false);
    expect(canAccessTemplate(baseState, actor, teamLeadItem)).toBe(true);
    expect(canAccessTemplate(baseState, actor, companyItem)).toBe(true);
    expect(effectiveTemplateStatusForActor(baseState, actor, companyItem, { inheritedStatus: 'inactive' })).toBe('published');
    expect(canDeliverTemplateToActor(baseState, actor, companyItem)).toBe(true);
  });

  it('team lead can see same-tenant agent templates', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const sameTenant = { tenantId: 2, createdBy: 201, creatorRole: 'agent' };
    const otherTenant = { tenantId: 3, createdBy: 201, creatorRole: 'agent' };

    expect(canAccessTemplate(baseState, actor, sameTenant)).toBe(true);
    expect(canAccessTemplate(baseState, actor, otherTenant)).toBe(false);
  });

  it('customer still does not receive inherited company templates as deliverable content', () => {
    const actor = { actorType: 'customer', actorId: 501, tenantId: 2 };
    const companyItem = { tenantId: 2, createdBy: 101, creatorRole: 'company_admin', status: 'published' };

    expect(canAccessTemplate(baseState, actor, companyItem)).toBe(true);
    expect(effectiveTemplateStatusForActor(baseState, actor, companyItem, { inheritedStatus: 'inactive' })).toBe('inactive');
    expect(canDeliverTemplateToActor(baseState, actor, companyItem)).toBe(false);
  });
});
