import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeName } from './name.ts';

const ctx = { key: 'test-key', table: 'users', column: 'full_name', rowKey: '1' };
const other = { ...ctx, key: 'other-key' };

test('fake_name output differs from input', () => {
  const input = 'Alice Example';
  const out = String(fakeName(input, ctx));
  assert.notEqual(out, input);
  assert.match(out, /^[A-Za-z]+ [A-Za-z]+$/);
  assert.ok(out.length <= 63);
});

test('fake_name is stable for same key and differs for another key', () => {
  const input = 'Alice Example';
  assert.equal(fakeName(input, ctx), fakeName(input, ctx));
  assert.notEqual(fakeName(input, ctx), fakeName(input, other));
});

test('fake_name preserves null', () => {
  assert.equal(fakeName(null, ctx), null);
});
