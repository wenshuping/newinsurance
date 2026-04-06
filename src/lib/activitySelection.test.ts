import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneActivitySelection, toggleActivitySelection, togglePageActivitySelection } from './activitySelection';

test('toggleActivitySelection adds and removes a single row id', () => {
  assert.deepEqual(toggleActivitySelection([], 'ACT-0003'), ['ACT-0003']);
  assert.deepEqual(toggleActivitySelection(['ACT-0003', 'ACT-0005'], 'ACT-0003'), ['ACT-0005']);
});

test('togglePageActivitySelection selects the full page when partially selected', () => {
  assert.deepEqual(togglePageActivitySelection(['ACT-0002'], ['ACT-0002', 'ACT-0004']), ['ACT-0002', 'ACT-0004']);
});

test('togglePageActivitySelection clears the full page when all page ids are already selected', () => {
  assert.deepEqual(togglePageActivitySelection(['ACT-0002', 'ACT-0004', 'ACT-0009'], ['ACT-0002', 'ACT-0004']), ['ACT-0009']);
});

test('pruneActivitySelection drops row ids that no longer exist', () => {
  assert.deepEqual(pruneActivitySelection(['ACT-0001', 'ACT-0002'], ['ACT-0002', 'ACT-0003']), ['ACT-0002']);
});
