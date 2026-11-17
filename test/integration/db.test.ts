import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../../src/db/catalog.ts';
import { openSource, withReadOnlyTransaction } from '../../src/db/source.ts';
import { openTarget, writeBatches } from '../../src/db/target.ts';
import { assertSourceTargetDistinct } from '../../src/db/urls.ts';
import { createPgLookup } from '../../src/db/lookup.ts';
import { planSubset } from '../../src/plan/subset.ts';
import { resetDatabase, SOURCE_URL, TARGET_URL, waitForPostgres } from './helpers.ts';

before(async () => {
  await waitForPostgres(SOURCE_URL);
  await waitForPostgres(TARGET_URL);
  await resetDatabase(SOURCE_URL, true);
  await resetDatabase(TARGET_URL, false);
});

after(async () => {
  // containers stay up for subsequent local runs; compose down is manual
});

test('source session rejects INSERT (read-only)', async () => {
  const source = await openSource(SOURCE_URL);
  try {
    await assert.rejects(
      () => source.query(`INSERT INTO users (email, full_name) VALUES ('x@y.z', 'X')`),
      /read-only|readonly|cannot execute/i,
    );
  } finally {
    await source.end();
  }
});

test('withReadOnlyTransaction also rejects writes', async () => {
  const source = await openSource(SOURCE_URL);
  try {
    await assert.rejects(
      () =>
        withReadOnlyTransaction(source, async query => {
          await query(`UPDATE users SET full_name = 'nope' WHERE id = 1`);
        }),
      /read-only|readonly|cannot execute/i,
    );
  } finally {
    await source.end();
  }
});

test('extract path refuses when target equals source including localhost vs 127.0.0.1', () => {
  assert.throws(
    () =>
      assertSourceTargetDistinct(
        'postgres://staging:staging@localhost:55432/source_db',
        'postgres://staging:staging@127.0.0.1:55432/source_db',
      ),
    /different databases/i,
  );
  assert.doesNotThrow(() => assertSourceTargetDistinct(SOURCE_URL, TARGET_URL));
});

test('catalog loads tables and foreign keys from source', async () => {
  const source = await openSource(SOURCE_URL);
  try {
    const catalog = await loadCatalog(source);
    const names = catalog.tables.map(t => t.name).sort();
    assert.deepEqual(names, ['order_items', 'orders', 'products', 'users']);
    assert.ok(catalog.foreignKeys.some(fk => fk.fromTable === 'orders' && fk.toTable === 'users'));
  } finally {
    await source.end();
  }
});

test('plan + FK-safe write copies a subset into the target', async () => {
  await resetDatabase(TARGET_URL, false);
  const source = await openSource(SOURCE_URL);
  const target = await openTarget(TARGET_URL);
  try {
    assertSourceTargetDistinct(SOURCE_URL, TARGET_URL);
    const catalog = await loadCatalog(source);
    const pkByTable = new Map(catalog.tables.map(t => [t.name, t.primaryKey]));
    const lookup = createPgLookup(source, pkByTable);
    const plan = await planSubset({
      catalog,
      seeds: [{ table: 'orders', primaryKeyValues: [10] }],
      lookup,
    });
    assert.equal(plan.truncated, false);
    assert.ok(plan.totalRows >= 5);

    // Build insert batches from source keys (clear fixture data — anonymization lands in M4).
    const batches = [];
    for (const planned of plan.tables) {
      const pk = pkByTable.get(planned.table)!;
      const cols = catalog.columns.filter(c => c.table === planned.table).map(c => c.name);
      const rows: unknown[][] = [];
      for (const rowKey of planned.rowKeys) {
        const pkValues = JSON.parse(rowKey) as unknown[];
        const equals: Record<string, unknown> = {};
        pk.forEach((col, i) => {
          equals[col] = pkValues[i];
        });
        const keys = await lookup.findKeys(planned.table, equals);
        assert.equal(keys.length, 1);
        const values = await lookup.getColumns(planned.table, pkValues, cols);
        rows.push(values);
      }
      batches.push({ table: planned.table, columns: cols, rows });
    }

    const { inserted } = await writeBatches(target, catalog, batches);
    assert.ok((inserted.orders ?? 0) >= 1);
    assert.ok((inserted.users ?? 0) >= 1);

    const count = await target.query('SELECT count(*)::int AS n FROM orders');
    assert.equal(count.rows[0].n, 1);
    const email = await target.query('SELECT email FROM users');
    // M3 copies fixture values; anonymization is M4. Still never returned to agent tools.
    assert.equal(email.rows[0].email, 'alice@corp.example');
  } finally {
    await source.end();
    await target.end();
  }
});
