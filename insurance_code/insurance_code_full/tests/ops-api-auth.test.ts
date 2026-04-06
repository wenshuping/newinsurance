import { afterEach, describe, expect, it } from 'vitest';
import { resolveOpsApiAuth } from '../server/skeleton-c-v1/common/ops-api-auth.mjs';

const originalOpsApiKey = process.env.P_OPS_API_KEY;
const originalLegacyLearningApiKey = process.env.P_LEARNING_OPS_API_KEY;

afterEach(() => {
  if (typeof originalOpsApiKey === 'undefined') delete process.env.P_OPS_API_KEY;
  else process.env.P_OPS_API_KEY = originalOpsApiKey;

  if (typeof originalLegacyLearningApiKey === 'undefined') delete process.env.P_LEARNING_OPS_API_KEY;
  else process.env.P_LEARNING_OPS_API_KEY = originalLegacyLearningApiKey;
});

describe('resolveOpsApiAuth', () => {
  it('accepts a valid ops api key for activity creation', () => {
    process.env.P_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'POST',
      path: '/api/p/activities',
      headers: {
        'x-ops-api-key': 'ops-secret',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('granted');
    expect(result.context).toMatchObject({
      actorType: 'employee',
      actorId: 9001,
      tenantId: 1,
      role: 'platform_admin',
    });
  });

  it('accepts a valid ops api key for learning course creation', () => {
    process.env.P_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'POST',
      path: '/api/p/learning/courses',
      headers: {
        'x-ops-api-key': 'ops-secret',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('granted');
    expect(result.context).toMatchObject({
      actorType: 'employee',
      actorId: 9001,
      tenantId: 1,
      role: 'platform_admin',
    });
  });

  it('accepts a valid ops api key for learning course batch creation', () => {
    process.env.P_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'POST',
      path: '/api/p/learning/courses/batch',
      headers: {
        'x-ops-api-key': 'ops-secret',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('granted');
    expect(result.context).toMatchObject({
      actorType: 'employee',
      actorId: 9001,
      tenantId: 1,
      role: 'platform_admin',
    });
  });

  it('rejects an invalid ops api key on the allowed route', () => {
    process.env.P_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'POST',
      path: '/api/p/learning/courses',
      headers: {
        'x-ops-api-key': 'wrong-key',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('invalid');
    expect(result.code).toBe('OPS_API_KEY_INVALID');
  });

  it('falls back to the legacy learning env var for compatibility', () => {
    delete process.env.P_OPS_API_KEY;
    process.env.P_LEARNING_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'POST',
      path: '/api/p/activities',
      headers: {
        'x-ops-api-key': 'ops-secret',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('granted');
  });

  it('does not treat other routes as ops api routes', () => {
    process.env.P_OPS_API_KEY = 'ops-secret';
    const req = {
      method: 'DELETE',
      path: '/api/p/learning/courses/1',
      headers: {
        'x-ops-api-key': 'ops-secret',
      },
    };

    const result = resolveOpsApiAuth(req);

    expect(result.status).toBe('not_applicable');
    expect(result.context).toBeNull();
  });
});
