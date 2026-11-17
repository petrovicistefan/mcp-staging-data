import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from './hash.ts';

const ctx = { key: 'test-key', table: 'users', column: 'ssn', rowKey: '1' };
const other = { ...ctx, key: 'other-key' };

test('hash output differs from input', () => {
  const input = '123-45-6789';
  const out = hash(input, ctx);
  assert.notEqual(out, input);
  assert.match(String(out), /^[0-9a-f]{64}$/);
});

test('hash is stable for same key and differs for another key', () => {
  const input = '123-45-6789';
  assert.equal(hash(input, ctx), hash(input, ctx));
  assert.notEqual(hash(input, ctx), hash(input, other));
});

test('hash preserves null', () => {
  assert.equal(hash(null, ctx), null);
});
