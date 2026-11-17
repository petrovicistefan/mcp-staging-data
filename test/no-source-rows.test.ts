import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../src/tools/result.ts';
import { FIXTURE_PII } from './fixtures/pii.ts';

function assertNoFixturePii(text: string, label: string) {
  for (const value of FIXTURE_PII) {
    assert.equal(text.includes(value), false, `${label} leaked fixture PII: ${value}`);
  }
}

test('tool ok() JSON never embeds fixture PII values', () => {
  const result = ok({
    tables: [{ table: 'users', rowCount: 1 }],
    note: 'subset ready',
  });
  assertNoFixturePii(result.content[0]?.text ?? '', 'ok()');
});

test('tool fail() redacts connection strings from errors', () => {
  const result = fail(
    new Error('connect ECONNREFUSED postgres://staging:staging@127.0.0.1:55432/source_db'),
  );
  const text = result.content[0]?.text ?? '';
  assert.equal(text.includes('postgres://'), false);
  assert.equal(text.includes('staging:staging'), false);
  assert.match(text, /REDACTED/);
});
