import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneLearningSelection, toggleLearningSelection, togglePageLearningSelection } from './learningSelection';

test('toggleLearningSelection adds and removes a single id', () => {
  assert.deepEqual(toggleLearningSelection([], 3), [3]);
  assert.deepEqual(toggleLearningSelection([3, 5], 3), [5]);
});

test('togglePageLearningSelection selects the full page when partially selected', () => {
  assert.deepEqual(togglePageLearningSelection([2], [2, 4, 6]), [2, 4, 6]);
});

test('togglePageLearningSelection clears the full page when all page ids are already selected', () => {
  assert.deepEqual(togglePageLearningSelection([2, 4, 6, 9], [2, 4, 6]), [9]);
});

test('pruneLearningSelection drops ids that no longer exist in the list', () => {
  assert.deepEqual(pruneLearningSelection([1, 2, 3], [2, 3, 4]), [2, 3]);
});
