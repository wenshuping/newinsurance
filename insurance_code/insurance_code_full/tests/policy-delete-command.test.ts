import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
}));

import {
  toCreateInsurancePolicyCommand,
  toDeleteInsurancePolicyCommand,
  toUpdateInsurancePolicyCommand,
} from '../server/skeleton-c-v1/dto/write-commands.dto.mjs';

describe('toDeleteInsurancePolicyCommand', () => {
  it('passes through persistPoliciesByIds for fast policy creates', () => {
    const persistPoliciesByIds = vi.fn();
    const command = toCreateInsurancePolicyCommand({
      body: {
        customerId: 9,
        company: '新华保险',
        name: '测试保单',
        date: '2024-01-01',
      },
      user: {
        id: 8202,
        actorType: 'agent',
        tenantId: 2,
      },
      deps: {
        getState: vi.fn(),
        nextId: vi.fn(),
        persistPoliciesByIds,
        persistState: vi.fn(),
        inferPolicyType: vi.fn(),
        nextPaymentDate: vi.fn(),
        calcPeriodEnd: vi.fn(),
        defaultResponsibilities: vi.fn(),
        refreshInsuranceSummaryFromState: vi.fn(),
      },
    });

    expect(command.persistPoliciesByIds).toBe(persistPoliciesByIds);
  });

  it('passes through persistPoliciesByIds for fast policy updates', () => {
    const persistPoliciesByIds = vi.fn();
    const command = toUpdateInsurancePolicyCommand({
      params: { id: 11 },
      body: {
        customerId: 9,
        company: '新华保险',
        name: '测试保单',
        date: '2024-01-01',
      },
      user: {
        id: 8202,
        actorType: 'agent',
        tenantId: 2,
      },
      deps: {
        getState: vi.fn(),
        persistPoliciesByIds,
        persistState: vi.fn(),
        inferPolicyType: vi.fn(),
        nextPaymentDate: vi.fn(),
        calcPeriodEnd: vi.fn(),
        defaultResponsibilities: vi.fn(),
        refreshInsuranceSummaryFromState: vi.fn(),
      },
    });

    expect(command.persistPoliciesByIds).toBe(persistPoliciesByIds);
  });

  it('passes through persistPoliciesByIds for fast policy deletes', () => {
    const persistPoliciesByIds = vi.fn();
    const persistState = vi.fn();
    const getState = vi.fn();
    const refreshInsuranceSummaryFromState = vi.fn();

    const command = toDeleteInsurancePolicyCommand({
      params: { id: 11 },
      deps: {
        getState,
        persistPoliciesByIds,
        persistState,
        refreshInsuranceSummaryFromState,
      },
    });

    expect(command.policyId).toBe(11);
    expect(command.getState).toBe(getState);
    expect(command.persistPoliciesByIds).toBe(persistPoliciesByIds);
    expect(command.persistState).toBe(persistState);
    expect(command.refreshInsuranceSummaryFromState).toBe(refreshInsuranceSummaryFromState);
  });
});
