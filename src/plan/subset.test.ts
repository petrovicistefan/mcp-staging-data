import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSubset, type RowLookup } from './subset.ts';
import { encodeRowKey, type Catalog } from './types.ts';

type Row = Record<string, unknown>;

function memoryLookup(data: Record<string, Row[]>, pks: Record<string, string[]>): RowLookup {
  return {
    findKeys(table, equals) {
      const rows = data[table] ?? [];
      const pk = pks[table] ?? ['id'];
      return rows
        .filter(row => Object.entries(equals).every(([col, val]) => row[col] === val))
        .map(row => pk.map(col => row[col]));
    },
    getColumns(table, primaryKeyValues, columns) {
      const pk = pks[table] ?? ['id'];
      const rows = data[table] ?? [];
      const row = rows.find(r => pk.every((col, i) => r[col] === primaryKeyValues[i]));
      if (!row) return columns.map(() => null);
      return columns.map(col => (row[col] as unknown) ?? null);
    },
  };
}

const catalog: Catalog = {
  tables: [
    { name: 'users', primaryKey: ['id'] },
    { name: 'orders', primaryKey: ['id'] },
    { name: 'order_items', primaryKey: ['id'] },
    { name: 'products', primaryKey: ['id'] },
  ],
  columns: [],
  foreignKeys: [
    {
      name: 'orders_user_id_fkey',
      fromTable: 'orders',
      fromColumns: ['user_id'],
      toTable: 'users',
      toColumns: ['id'],
    },
    {
      name: 'order_items_order_id_fkey',
      fromTable: 'order_items',
      fromColumns: ['order_id'],
      toTable: 'orders',
      toColumns: ['id'],
    },
    {
      name: 'order_items_product_id_fkey',
      fromTable: 'order_items',
      fromColumns: ['product_id'],
      toTable: 'products',
      toColumns: ['id'],
    },
  ],
};

const data = {
  users: [
    { id: 1, email: 'a@example.com' },
    { id: 2, email: 'b@example.com' },
  ],
  orders: [
    { id: 10, user_id: 1 },
    { id: 11, user_id: 2 },
  ],
  order_items: [
    { id: 100, order_id: 10, product_id: 5 },
    { id: 101, order_id: 10, product_id: 6 },
    { id: 102, order_id: 11, product_id: 5 },
  ],
  products: [
    { id: 5, name: 'Widget' },
    { id: 6, name: 'Gadget' },
    { id: 7, name: 'Unused' },
  ],
};

const pks = {
  users: ['id'],
  orders: ['id'],
  order_items: ['id'],
  products: ['id'],
};

test('planSubset walks parents and children from a root order', async () => {
  const plan = await planSubset({
    catalog,
    seeds: [{ table: 'orders', primaryKeyValues: [10] }],
    lookup: memoryLookup(data, pks),
  });

  const byTable = Object.fromEntries(plan.tables.map(t => [t.table, t.rowKeys]));
  assert.deepEqual(byTable.orders, [encodeRowKey([10])]);
  assert.deepEqual(byTable.users, [encodeRowKey([1])]);
  assert.deepEqual(byTable.order_items?.sort(), [encodeRowKey([100]), encodeRowKey([101])].sort());
  assert.deepEqual(byTable.products?.sort(), [encodeRowKey([5]), encodeRowKey([6])].sort());
  assert.equal(plan.totalRows, 6);
  assert.equal(plan.truncated, false);
  // Unrelated user/order/product excluded
  assert.equal(byTable.users?.includes(encodeRowKey([2])), false);
  assert.equal(byTable.products?.includes(encodeRowKey([7])), false);
});

test('planSubset is cycle-safe on self-referential FKs', async () => {
  const treeCatalog: Catalog = {
    tables: [{ name: 'nodes', primaryKey: ['id'] }],
    columns: [],
    foreignKeys: [
      {
        name: 'nodes_parent_fkey',
        fromTable: 'nodes',
        fromColumns: ['parent_id'],
        toTable: 'nodes',
        toColumns: ['id'],
      },
    ],
  };
  const tree = {
    nodes: [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 2 },
    ],
  };
  const plan = await planSubset({
    catalog: treeCatalog,
    seeds: [{ table: 'nodes', primaryKeyValues: [3] }],
    lookup: memoryLookup(tree, { nodes: ['id'] }),
  });
  assert.equal(plan.totalRows, 3);
  assert.deepEqual(
    plan.tables[0]?.rowKeys.sort(),
    [encodeRowKey([1]), encodeRowKey([2]), encodeRowKey([3])].sort(),
  );
});

test('planSubset respects maxRows and sets truncated', async () => {
  const plan = await planSubset({
    catalog,
    seeds: [{ table: 'orders', primaryKeyValues: [10] }],
    lookup: memoryLookup(data, pks),
    maxRows: 2,
  });
  assert.equal(plan.totalRows, 2);
  assert.equal(plan.truncated, true);
});
