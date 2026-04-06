import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApiUrl } from './apiUrl';

describe('buildApiUrl', () => {
  it('keeps existing api paths unchanged when base is empty', () => {
    assert.equal(buildApiUrl('', '/api/auth/send-code'), '/api/auth/send-code');
  });

  it('avoids duplicating a relative /api prefix', () => {
    assert.equal(buildApiUrl('/api', '/api/auth/send-code'), '/api/auth/send-code');
  });

  it('joins absolute runtime bases with api paths', () => {
    assert.equal(buildApiUrl('http://127.0.0.1:4000', '/api/auth/send-code'), 'http://127.0.0.1:4000/api/auth/send-code');
  });
});
