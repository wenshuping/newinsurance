import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBatchDeleteResultMessage, resolveBatchDeleteAction } from './batchDeleteFlow';

test('resolveBatchDeleteAction enters selection mode before any item is selected', () => {
  assert.equal(resolveBatchDeleteAction({ isSelecting: false, selectedCount: 0 }), 'enter-select');
});

test('resolveBatchDeleteAction confirms deletion when items are selected', () => {
  assert.equal(resolveBatchDeleteAction({ isSelecting: true, selectedCount: 2 }), 'confirm-delete');
});

test('buildBatchDeleteResultMessage returns success copy', () => {
  assert.equal(buildBatchDeleteResultMessage({ deletedCount: 3, failedCount: 0, unit: '条资料' }), '已删除 3 条资料。');
});

test('buildBatchDeleteResultMessage returns partial failure copy', () => {
  assert.equal(
    buildBatchDeleteResultMessage({ deletedCount: 2, failedCount: 1, unit: '个活动' }),
    '已删除 2 个活动，另有 1 个活动删除失败，请重试。'
  );
});
