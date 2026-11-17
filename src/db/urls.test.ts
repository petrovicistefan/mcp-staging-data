import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSourceTargetDistinct, parseEndpoint } from './urls.ts';

test('parseEndpoint normalizes localhost and 127.0.0.1', () => {
  const a = parseEndpoint('postgres://u:p@localhost:5432/app');
  const b = parseEndpoint('postgresql://u:p@127.0.0.1:5432/app');
  assert.deepEqual(a, b);
  assert.equal(a.host, '127.0.0.1');
  assert.equal(a.port, 5432);
  assert.equal(a.database, 'app');
});

test('assertSourceTargetDistinct refuses localhost vs 127.0.0.1 same db', () => {
  assert.throws(
    () =>
      assertSourceTargetDistinct(
        'postgres://u:p@localhost:5432/prod',
        'postgres://u:p@127.0.0.1:5432/prod',
      ),
    /different databases/i,
  );
});

test('assertSourceTargetDistinct allows same host different database', () => {
  assert.doesNotThrow(() =>
    assertSourceTargetDistinct(
      'postgres://u:p@127.0.0.1:5432/prod',
      'postgres://u:p@127.0.0.1:5432/staging',
    ),
  );
});

test('assertSourceTargetDistinct allows same db name on different ports', () => {
  assert.doesNotThrow(() =>
    assertSourceTargetDistinct(
      'postgres://u:p@127.0.0.1:5432/app',
      'postgres://u:p@127.0.0.1:5433/app',
    ),
  );
});
