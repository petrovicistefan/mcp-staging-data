import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeEmail } from './email.ts';

const ctx = { key: 'test-key', table: 'users', column: 'email', rowKey: '1' };
const other = { ...ctx, key: 'other-key' };

test('fake_email output differs from input and is a valid email', () => {
  const input = 'alice@corp.example';
  const out = String(fakeEmail(input, ctx));
  assert.notEqual(out, input);
  assert.match(out, /^[0-9a-f]{32}@example\.test$/);
  assert.ok(out.length <= 320);
});

test('fake_email is stable for same key and differs for another key', () => {
  const input = 'alice@corp.example';
  assert.equal(fakeEmail(input, ctx), fakeEmail(input, ctx));
  assert.notEqual(fakeEmail(input, ctx), fakeEmail(input, other));
});

test('fake_email preserves uniqueness over 10_000 distinct inputs', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) {
    const out = String(fakeEmail(`user${i}@corp.example`, ctx));
    assert.equal(seen.has(out), false, `collision at ${i}`);
    seen.add(out);
  }
  assert.equal(seen.size, 10_000);
});

test('fake_email preserves null', () => {
  assert.equal(fakeEmail(null, ctx), null);
});
