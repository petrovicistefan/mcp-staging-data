import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactError } from '../src/redact.ts';

test('redact removes postgres connection URIs', () => {
  const msg = 'connect failed postgres://user:s3cret@db.example:5432/prod';
  const out = redact(msg);
  assert.equal(out.includes('s3cret'), false);
  assert.equal(out.includes('postgres://'), false);
  assert.match(out, /\[REDACTED_URI\]/);
});

test('redact removes password= style secrets', () => {
  const out = redact('password=hunter2 hmac_key=abc123');
  assert.equal(out.includes('hunter2'), false);
  assert.equal(out.includes('abc123'), false);
});

test('redact strips Postgres DETAIL key/value payloads', () => {
  const msg =
    'duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(alice@corp.example) already exists.';
  const out = redact(msg);
  assert.equal(out.includes('alice@corp.example'), false);
  assert.match(out, /\[REDACTED_VALUE\]/);
});

test('redactError wraps unknown values', () => {
  const err = redactError(new Error('dsn=postgresql://a:b@localhost/db'));
  assert.equal(err.message.includes('postgresql://'), false);
});
