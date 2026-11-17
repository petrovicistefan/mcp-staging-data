import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.ts';
import { openTarget } from '../../src/db/target.ts';
import { assertSourceTargetDistinct } from '../../src/db/urls.ts';
import { extractTool } from '../../src/tools/extract.ts';
import { inspectSchema } from '../../src/tools/inspect_schema.ts';
import { verifyTool } from '../../src/tools/verify.ts';
import { FIXTURE_PII } from '../fixtures/pii.ts';
import { resetDatabase, SOURCE_URL, TARGET_URL, waitForPostgres } from './helpers.ts';

const HMAC = 'test-hmac-key-32chars-minimum!!';

const FULL_RULES = {
  version: 1 as const,
  columns: {
    'users.id': { type: 'keep' as const },
    'users.email': { type: 'fake_email' as const },
    'users.full_name': { type: 'fake_name' as const },
    'users.phone': { type: 'fake_phone' as const },
    'users.created_at': { type: 'keep' as const },
    'orders.id': { type: 'keep' as const },
    'orders.user_id': { type: 'keep' as const },
    'orders.status': { type: 'keep' as const, reason: 'not personal' },
    'orders.total_cents': { type: 'keep' as const },
    'order_items.id': { type: 'keep' as const },
    'order_items.order_id': { type: 'keep' as const },
    'order_items.product_id': { type: 'keep' as const },
    'order_items.quantity': { type: 'keep' as const },
    'products.id': { type: 'keep' as const },
    'products.name': { type: 'keep' as const, reason: 'not personal' },
    'products.sku': { type: 'keep' as const, reason: 'not personal' },
  },
};

function cfg(rulesPath: string) {
  return loadConfig({
    STAGING_DATA_SOURCE_URL: SOURCE_URL,
    STAGING_DATA_TARGET_URL: TARGET_URL,
    STAGING_DATA_HMAC_KEY: HMAC,
    STAGING_DATA_RULES_PATH: rulesPath,
  });
}

function assertClean(text: string) {
  for (const value of FIXTURE_PII) {
    assert.equal(text.includes(value), false, `leaked ${value}`);
  }
  assert.equal(text.includes(SOURCE_URL), false);
  assert.equal(text.includes(TARGET_URL), false);
  assert.equal(text.includes(HMAC), false);
  assert.equal(/postgres(ql)?:\/\//i.test(text), false);
}

before(async () => {
  await waitForPostgres(SOURCE_URL);
  await waitForPostgres(TARGET_URL);
  await resetDatabase(SOURCE_URL, true);
  await resetDatabase(TARGET_URL, false);
});

test('connection strings and HMAC never appear in tool output', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'staging-safety-'));
  const rulesPath = join(dir, 'rules.json');
  writeFileSync(rulesPath, JSON.stringify(FULL_RULES));

  const inspected = await inspectSchema(cfg(rulesPath));
  assertClean(inspected.content[0]?.text ?? '');

  // Force an error that would otherwise include the URL (bad table name path via extract after rules ok).
  const bad = await extractTool(cfg(rulesPath), { table: 'no_such_table', primaryKey: [1] });
  assert.equal(bad.isError, true);
  assertClean(bad.content[0]?.text ?? '');
});

test('extract refuses when target equals source', async () => {
  assert.throws(
    () =>
      assertSourceTargetDistinct(
        'postgres://staging:staging@localhost:55432/source_db',
        'postgres://staging:staging@127.0.0.1:55432/source_db',
      ),
    /different databases/i,
  );

  const dir = mkdtempSync(join(tmpdir(), 'staging-safety-'));
  const rulesPath = join(dir, 'rules.json');
  writeFileSync(rulesPath, JSON.stringify(FULL_RULES));
  const same = loadConfig({
    STAGING_DATA_SOURCE_URL: SOURCE_URL,
    STAGING_DATA_TARGET_URL: SOURCE_URL.replace('127.0.0.1', 'localhost'),
    STAGING_DATA_HMAC_KEY: HMAC,
    STAGING_DATA_RULES_PATH: rulesPath,
  });
  const result = await extractTool(same, { table: 'orders', primaryKey: [10] });
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? '', /different databases/i);
  assertClean(result.content[0]?.text ?? '');
});

test('extract refuses with an unruled PII column', async () => {
  await resetDatabase(TARGET_URL, false);
  const dir = mkdtempSync(join(tmpdir(), 'staging-safety-'));
  const rulesPath = join(dir, 'rules.json');
  writeFileSync(rulesPath, JSON.stringify({ version: 1, columns: {} }));
  const result = await extractTool(cfg(rulesPath), { table: 'orders', primaryKey: [10] });
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? '', /refused|PII/i);
  assertClean(result.content[0]?.text ?? '');
});

test('verify catches an unmasked PII column in the target', async () => {
  await resetDatabase(TARGET_URL, false);
  const dir = mkdtempSync(join(tmpdir(), 'staging-safety-'));
  const rulesPath = join(dir, 'rules.json');
  writeFileSync(rulesPath, JSON.stringify(FULL_RULES));

  // Seed target with clear email while rules claim fake_email.
  const target = await openTarget(TARGET_URL);
  try {
    await target.query(
      `INSERT INTO users (id, email, full_name, phone) VALUES (1, 'alice@corp.example', 'Alice Example', '+1-555-0100')`,
    );
  } finally {
    await target.end();
  }

  const verified = await verifyTool(cfg(rulesPath), { tables: ['users'] });
  assert.equal(verified.isError, undefined);
  const body = verified.structuredContent as { ok: boolean; unmaskedColumns: string[] };
  assert.equal(body.ok, false);
  assert.ok(body.unmaskedColumns.includes('users.email'));
  assertClean(verified.content[0]?.text ?? '');
});
