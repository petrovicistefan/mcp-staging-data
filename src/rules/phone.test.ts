import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakePhone } from './phone.ts';

const ctx = { key: 'test-key', table: 'users', column: 'phone', rowKey: '1' };
const other = { ...ctx, key: 'other-key' };

test('fake_phone output differs from input and looks like E.164', () => {
  const input = '+1-555-0100';
  const out = String(fakePhone(input, ctx));
  assert.notEqual(out, input);
  assert.match(out, /^\+1[2-9]\d{9}$/);
});

test('fake_phone is stable for same key and differs for another key', () => {
  const input = '+1-555-0100';
  assert.equal(fakePhone(input, ctx), fakePhone(input, ctx));
  assert.notEqual(fakePhone(input, ctx), fakePhone(input, other));
});

test('fake_phone preserves uniqueness over 10_000 distinct inputs', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) {
    const out = String(fakePhone(`+1555${String(i).padStart(7, '0')}`, ctx));
    assert.equal(seen.has(out), false, `collision at ${i}`);
    seen.add(out);
  }
  assert.equal(seen.size, 10_000);
});

test('fake_phone preserves null', () => {
  assert.equal(fakePhone(null, ctx), null);
});
