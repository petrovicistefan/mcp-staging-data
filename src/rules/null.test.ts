import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nullRule } from './null.ts';

const ctx = { key: 'test-key', table: 'users', column: 'notes', rowKey: '1' };

test('null rule output differs from non-null input', () => {
  assert.notEqual(nullRule('secret note', ctx), 'secret note');
  assert.equal(nullRule('secret note', ctx), null);
});

test('null rule is stable', () => {
  assert.equal(nullRule('a', ctx), nullRule('b', ctx));
});
