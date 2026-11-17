import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExtractCoverage } from './coverage.ts';
import type { Catalog } from '../plan/types.ts';

const catalog: Catalog = {
  tables: [
    { name: 'users', primaryKey: ['id'] },
    { name: 'orders', primaryKey: ['id'] },
  ],
  columns: [
    { table: 'users', name: 'id', dataType: 'integer', isNullable: false, ordinalPosition: 1 },
    { table: 'users', name: 'email', dataType: 'text', udtName: 'text', isNullable: false, ordinalPosition: 2 },
    { table: 'orders', name: 'id', dataType: 'integer', isNullable: false, ordinalPosition: 1 },
    { table: 'orders', name: 'status', dataType: 'text', udtName: 'varchar', isNullable: false, ordinalPosition: 2 },
  ],
  foreignKeys: [],
};

test('checkExtractCoverage refuses unruled PII columns', () => {
  const issues = checkExtractCoverage(catalog, ['users'], { version: 1, columns: {} });
  assert.ok(issues.some(i => i.kind === 'missing_rule' && i.column === 'email'));
});

test('checkExtractCoverage accepts ruled PII columns', () => {
  const issues = checkExtractCoverage(catalog, ['users'], {
    version: 1,
    columns: { 'users.email': { type: 'fake_email' } },
  });
  assert.deepEqual(issues, []);
});

test('checkExtractCoverage requires reason for keep on PII', () => {
  const issues = checkExtractCoverage(catalog, ['users'], {
    version: 1,
    columns: { 'users.email': { type: 'keep' } },
  });
  assert.ok(issues.some(i => i.kind === 'keep_without_reason'));
});
