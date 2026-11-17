import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPiiColumns } from './detect.ts';

test('flags common PII column names', () => {
  const flags = detectPiiColumns([
    { table: 'users', name: 'id', dataType: 'integer' },
    { table: 'users', name: 'email', dataType: 'text' },
    { table: 'users', name: 'full_name', dataType: 'text' },
    { table: 'users', name: 'phone', dataType: 'text' },
    { table: 'users', name: 'created_at', dataType: 'timestamp' },
  ]);
  const cols = flags.map(f => f.column).sort();
  assert.deepEqual(cols, ['email', 'full_name', 'phone']);
});

test('flags free-text columns even without a PII-ish name', () => {
  const flags = detectPiiColumns([{ table: 'notes', name: 'body', dataType: 'text', udtName: 'text' }]);
  assert.equal(flags.length, 1);
  assert.equal(flags[0]?.column, 'body');
});

test('flags ssn/cnp style national ids (regression: missed PII is a bug)', () => {
  const flags = detectPiiColumns([
    { table: 'users', name: 'ssn', dataType: 'text' },
    { table: 'users', name: 'cnp', dataType: 'text' },
  ]);
  assert.deepEqual(flags.map(f => f.column).sort(), ['cnp', 'ssn']);
});

test('does not flag ordinary non-PII columns', () => {
  const flags = detectPiiColumns([
    { table: 'orders', name: 'id', dataType: 'bigint' },
    { table: 'orders', name: 'status', dataType: 'text', udtName: 'varchar' },
    { table: 'orders', name: 'total_cents', dataType: 'integer' },
  ]);
  assert.deepEqual(flags, []);
});
