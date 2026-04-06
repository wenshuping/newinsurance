import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRuntimeBase } from './runtimeBase';

describe('resolveRuntimeBase', () => {
  it('keeps relative api paths relative for same-origin proxying', () => {
    assert.equal(resolveRuntimeBase('/api', 'http://10.53.1.245:3003/home'), '/api');
  });

  it('replaces loopback api hosts with the current LAN host on mobile access', () => {
    assert.equal(resolveRuntimeBase('http://127.0.0.1:4000', 'http://10.53.1.245:3003/home'), 'http://10.53.1.245:4000');
    assert.equal(resolveRuntimeBase('http://localhost:4100', 'http://10.53.1.245:3003/home'), 'http://10.53.1.245:4100');
  });
});
