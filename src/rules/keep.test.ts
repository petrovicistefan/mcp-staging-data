import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keep } from './keep.ts';

const ctx = { key: 'test-key', table: 'orders', column: 'status', rowKey: '1' };

test('keep returns the input unchanged', () => {
  assert.equal(keep('paid', ctx), 'paid');
  assert.equal(keep(null, ctx), null);
  assert.equal(keep(42, ctx), 42);
});
