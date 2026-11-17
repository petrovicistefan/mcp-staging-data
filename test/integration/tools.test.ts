import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.ts';
import { extractTool } from '../../src/tools/extract.ts';
import { inspectSchema } from '../../src/tools/inspect_schema.ts';
import { planSubsetTool } from '../../src/tools/plan_subset.ts';
import { setRules } from '../../src/tools/set_rules.ts';
import { verifyTool } from '../../src/tools/verify.ts';
import { openTarget } from '../../src/db/target.ts';
import { resetDatabase, SOURCE_URL, TARGET_URL, waitForPostgres } from './helpers.ts';

import { FIXTURE_PII } from '../fixtures/pii.ts';

const HMAC = 'test-hmac-key-32chars-minimum!!';

function testConfig(rulesPath: string) {
  return loadConfig({
    STAGING_DATA_SOURCE_URL: SOURCE_URL,
    STAGING_DATA_TARGET_URL: TARGET_URL,
    STAGING_DATA_HMAC_KEY: HMAC,
    STAGING_DATA_RULES_PATH: rulesPath,
  });
}

before(async () => {
  await waitForPostgres(SOURCE_URL);
  await waitForPostgres(TARGET_URL);
  await resetDatabase(SOURCE_URL, true);
  await resetDatabase(TARGET_URL, false);
});

test('inspect_schema returns tables and PII flags without fixture emails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'staging-rules-'));
  const rulesPath = join(dir, 'rules.json');
  const result = await inspectSchema(testConfig(rulesPath));
  assert.equal(result.isError, undefined);
  const text = result.content[0]?.text ?? '';
  for (const value of FIXTURE_PII) {
    assert.equal(text.includes(value), false, `leaked ${value}`);
  }
  const body = result.structuredContent as { piiColumns: unknown[]; tables: unknown[] };
  assert.ok(body.tables.length >= 4);
  assert.ok(body.piiColumns.length >= 1);
});

test('set_rules writes staging-data.rules.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'staging-rules-'));
  const rulesPath = join(dir, 'staging-data.rules.json');
  const result = await setRules(testConfig(rulesPath), {
    columns: {
      'users.email': { type: 'fake_email' },
      'users.full_name': { type: 'fake_name' },
    },
  });
  assert.equal(result.isError, undefined);
  const saved = JSON.parse(readFileSync(rulesPath, 'utf8')) as {
    columns: Record<string, { type: string }>;
  };
  assert.equal(saved.columns['users.email']?.type, 'fake_email');
});

test('plan_subset returns counts only', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'staging-rules-'));
  const result = await planSubsetTool(testConfig(join(dir, 'rules.json')), {
    table: 'orders',
    primaryKey: [10],
  });
  assert.equal(result.isError, undefined);
  const body = result.structuredContent as { totalRows: number; tables: Array<{ table: string; rowCount: number }> };
  assert.ok(body.totalRows >= 5);
  const text = result.content[0]?.text ?? '';
  for (const value of FIXTURE_PII) assert.equal(text.includes(value), false);
});

test('extract refuses without rules for PII columns', async () => {
  await resetDatabase(TARGET_URL, false);
  const dir = mkdtempSync(join(tmpdir(), 'staging-rules-'));
  const rulesPath = join(dir, 'empty.json');
  writeFileSync(rulesPath, '{"version":1,"columns":{}}\n');
  const result = await extractTool(testConfig(rulesPath), { table: 'orders', primaryKey: [10] });
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? '', /refused|PII/i);
});

test('extract anonymizes and verify passes; no source PII in tool output', async () => {
  await resetDatabase(TARGET_URL, false);
  const dir = mkdtempSync(join(tmpdir(), 'staging-rules-'));
  const rulesPath = join(dir, 'rules.json');
  writeFileSync(rulesPath, readFileSync(new URL('../fixtures/rules.json', import.meta.url), 'utf8'));

  const extracted = await extractTool(testConfig(rulesPath), { table: 'orders', primaryKey: [10] });
  assert.equal(extracted.isError, undefined, extracted.content[0]?.text);
  const extractText = extracted.content[0]?.text ?? '';
  for (const value of FIXTURE_PII) assert.equal(extractText.includes(value), false);

  const verified = await verifyTool(testConfig(rulesPath), {});
  assert.equal(verified.isError, undefined);
  const body = verified.structuredContent as { ok: boolean; missingRules: string[]; unmaskedColumns: string[] };
  assert.equal(body.ok, true, JSON.stringify(body));

  const target = await openTarget(TARGET_URL);
  try {
    const emails = await target.query('SELECT email, full_name FROM users');
    assert.equal(emails.rows.length, 1);
    assert.notEqual(emails.rows[0].email, 'alice@corp.example');
    assert.match(String(emails.rows[0].email), /@example\.test$/);
    assert.notEqual(emails.rows[0].full_name, 'Alice Example');
  } finally {
    await target.end();
  }
});
