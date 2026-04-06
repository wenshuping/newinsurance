import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBActivityConfigIdempotencyKey,
  rotateBActivityConfigIdempotencyKey,
} from './activity-config-idempotency';

test('creates B activity config idempotency keys with a stable prefix', () => {
  const key = createBActivityConfigIdempotencyKey(() => 'fixed-seed');
  assert.equal(key, 'b-activity-config-create:fixed-seed');
});

test('rotates to a new key after a successful create', () => {
  const next = rotateBActivityConfigIdempotencyKey(
    'b-activity-config-create:first',
    (() => {
      const values = ['first', 'second'];
      let idx = 0;
      return () => values[idx++] || `generated-${idx}`;
    })(),
  );

  assert.equal(next, 'b-activity-config-create:second');
});
